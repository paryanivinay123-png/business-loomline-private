// ============================================================
// Google Apps Script for Business Loomline (Balooo)
// Business decision layer — The Hullabalooo x The Pappy Show
//
// Matches the live spreadsheet structure:
//   MASTER      config/metadata (last_updated, brands, fiscal_start_month, currency)
//   BRANDS      reference (brand_id, brand_name, color_primary, status)
//   REVENUE     weekly actuals (date, brand_id, channel, category, collection,
//               geography, revenue, units_sold)
//   COSTS       operating expenses (date, brand_id, cost_category, department, amount)
//   INVENTORY   SKU stock (sku, brand_id, quantity_on_hand, reorder_level,
//               unit_cost, warehouse, ...)
//   CHANNELS    platform performance (date, channel_name, impressions, clicks,
//               conversions, cost)
//   CUSTOMERS   cohorts (cohort_month, new_customers, repeat_rate, avg_ltv,
//               acquisition_cost)
//   ALERTS      action items (title, owner, status, action_required, due_date)
//
// Optional tabs the dashboard also understands if you add them later:
//   COMPETITORS (date, competitor, type, title, detail, price_point, channel, link)
//   INDUSTRY    (date, title, source, category, sentiment, score, insight, link)
//   TARGETS     (month, brand_id, revenue_target, units_target, new_customers_target)
//
// Rows with a brand_id are served with the resolved brand_name attached,
// so the dashboard never shows raw ids.
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1bY2_I44g5bI0Gfwnn-I_7zD8HouhoH1ZOgXMneBvdHA',
  SHEETS: {
    master: 'MASTER',
    brands: 'BRANDS',
    revenue: 'REVENUE',
    costs: 'COSTS',
    inventory: 'INVENTORY',
    channels: 'CHANNELS',
    customers: 'CUSTOMERS',
    alerts: 'ALERTS',
    materials: 'MATERIALS',
    sku_materials: 'SKU_MATERIALS',
    competitors: 'COMPETITORS',
    industry: 'INDUSTRY',
    targets: 'TARGETS'
  },
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
  CLAUDE_API_KEY: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || ''
};

// ============================================================
// Main entry points
// ============================================================

// GET ?mode=all            -> every table in one payload (dashboard startup)
// GET ?mode=<sheet key>    -> one table (revenue, inventory, channels, ...)
function doGet(e) {
  try {
    const mode = (e && e.parameter && e.parameter.mode) || 'all';

    if (mode === 'all') {
      const brandMap = readBrandMap();
      const payload = {};
      Object.keys(CONFIG.SHEETS).forEach(function (key) {
        payload[key] = withBrandNames(readSheet(CONFIG.SHEETS[key]), brandMap);
      });
      return createJsonResponse(payload);
    }

    if (CONFIG.SHEETS[mode]) {
      return createJsonResponse(withBrandNames(readSheet(CONFIG.SHEETS[mode]), readBrandMap()));
    }

    return createErrorResponse('Unknown mode: ' + mode);
  } catch (error) {
    return createErrorResponse(error.message);
  }
}

// POST actions:
//   { action: 'ask', system, prompt, model }   -> Claude answer
//   { action: 'addAction', card: {...} }       -> append row to ALERTS
//   { action: 'updateAction', id, status }     -> update an ALERTS row's status
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'ask') {
      return askClaude(data.system, data.prompt, data.model);
    }
    if (data.action === 'addAction') {
      return addActionCard(data.card || {});
    }
    if (data.action === 'updateAction') {
      return updateActionCard(data.id, data.status);
    }

    return createErrorResponse('Unknown action');
  } catch (error) {
    return createErrorResponse(error.message);
  }
}

// ============================================================
// Sheet reading
// ============================================================

// Reads a tab into an array of objects keyed by the header row (lowercased).
// Missing tabs return []. Empty rows are skipped. Dates become ISO strings.
function readSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (cell) { return cell === '' || cell === null; })) continue;

    const obj = {};
    headers.forEach(function (header, col) {
      if (!header) return;
      let value = row[col];
      if (value instanceof Date) value = value.toISOString();
      obj[header] = value;
    });
    rows.push(obj);
  }
  return rows;
}

// brand_id -> {name, color} from the BRANDS tab
function readBrandMap() {
  const map = {};
  readSheet(CONFIG.SHEETS.brands).forEach(function (b) {
    const id = String(b.brand_id || '').trim();
    if (id) map[id] = { name: b.brand_name || id, color: b.color_primary || '' };
  });
  return map;
}

// Attach brand_name (and brand_color) to any row carrying brand_id
function withBrandNames(rows, brandMap) {
  return rows.map(function (r) {
    if (r.brand_id != null && r.brand_name == null) {
      const hit = brandMap[String(r.brand_id).trim()];
      if (hit) {
        r.brand_name = hit.name;
        if (hit.color) r.brand_color = hit.color;
      }
    }
    return r;
  });
}

// ============================================================
// ALERTS writes (the dashboard's action board)
// Column-order independent: rows are written by header name, so extra
// or reordered columns in ALERTS are fine. If you add an `id` column,
// cards get stable ids; otherwise the title is used to find rows.
// ============================================================

function addActionCard(card) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.alerts);
  if (!sheet) return createErrorResponse('ALERTS sheet not found');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });

  const id = 'act_' + new Date().getTime();
  const byHeader = {
    id: id,
    title: card.title || '',
    owner: card.owner || '',
    status: card.status || 'To do',
    action_required: card.source || '',
    due_date: card.due || '',
    created: new Date().toISOString()
  };
  sheet.appendRow(headers.map(function (h) { return byHeader[h] != null ? byHeader[h] : ''; }));
  return createJsonResponse({ success: true, id: id });
}

function updateActionCard(id, status) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.alerts);
  if (!sheet) return createErrorResponse('ALERTS sheet not found');

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const idCol = headers.indexOf('id');
  const titleCol = headers.indexOf('title');
  const statusCol = headers.indexOf('status');
  if (statusCol === -1) return createErrorResponse('ALERTS has no status column');

  for (let i = 1; i < values.length; i++) {
    const matchesId = idCol > -1 && String(values[i][idCol]) === String(id);
    const matchesTitle = titleCol > -1 && String(values[i][titleCol]) === String(id);
    if (matchesId || matchesTitle) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      return createJsonResponse({ success: true });
    }
  }
  return createErrorResponse('Action not found: ' + id);
}

// ============================================================
// Claude
// ============================================================

function askClaude(system, prompt, model) {
  if (!CONFIG.CLAUDE_API_KEY) {
    return createErrorResponse('ANTHROPIC_API_KEY not set in Script Properties');
  }

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: model || CONFIG.ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: system || 'You are a retail business analyst for two Indian fashion brands.',
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());
  if (result.error) return createErrorResponse(result.error.message);

  return createJsonResponse({
    success: true,
    answer: result.content && result.content[0] ? result.content[0].text : ''
  });
}

// ============================================================
// Response helpers
// ============================================================

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Diagnostics — run from the Apps Script editor
// ============================================================

function testConnection() {
  Object.keys(CONFIG.SHEETS).forEach(function (key) {
    const rows = readSheet(CONFIG.SHEETS[key]);
    Logger.log(CONFIG.SHEETS[key] + ': ' + rows.length + ' rows' +
      (rows.length ? ' · columns: ' + Object.keys(rows[0]).join(', ') : ''));
  });
}
