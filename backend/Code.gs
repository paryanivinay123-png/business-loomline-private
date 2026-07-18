// ============================================================
// Google Apps Script for Business Loomline (Balooo)
// Business decision layer — The Hullabalooo x The Pappy Show
//
// One spreadsheet, seven tabs. Each tab is one clean table:
// row 1 = headers, every row below = one record. No merged
// cells, no formatting-as-data, no blank header columns.
//
//   Sales        weekly sales facts (the core table)
//   Products     SKU master + live inventory
//   Channels     weekly channel/customer metrics
//   Competitors  competitor tracker entries
//   Industry     industry watch feed (can be fed by Loomline)
//   Actions      action board cards
//   Targets      monthly targets per brand (for deltas)
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: 'PASTE_YOUR_SPREADSHEET_ID_HERE',
  SHEETS: {
    sales: 'Sales',
    products: 'Products',
    channels: 'Channels',
    competitors: 'Competitors',
    industry: 'Industry',
    actions: 'Actions',
    targets: 'Targets'
  },
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
  CLAUDE_API_KEY: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || ''
};

// ============================================================
// Main entry points
// ============================================================

// GET  ?mode=sales | products | channels | competitors | industry | actions | targets
// GET  ?mode=all   -> every table in one payload (what the dashboard loads on open)
// GET  (no mode)   -> same as mode=all
function doGet(e) {
  try {
    const mode = (e && e.parameter && e.parameter.mode) || 'all';

    if (mode === 'all') {
      const payload = {};
      Object.keys(CONFIG.SHEETS).forEach(function (key) {
        payload[key] = readSheet(CONFIG.SHEETS[key]);
      });
      return createJsonResponse(payload);
    }

    if (CONFIG.SHEETS[mode]) {
      return createJsonResponse(readSheet(CONFIG.SHEETS[mode]));
    }

    return createErrorResponse('Unknown mode: ' + mode);
  } catch (error) {
    return createErrorResponse(error.message);
  }
}

// POST actions:
//   { action: 'ask', system, prompt, model }        -> Claude answer
//   { action: 'addAction', card: {...} }            -> append card to Actions
//   { action: 'updateAction', id, status }          -> move a card on the board
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

// Reads a tab into an array of objects keyed by the header row.
// Empty rows are skipped; Date cells become ISO strings.
function readSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function (h) { return String(h).trim(); });
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

// ============================================================
// Action board writes
// ============================================================

function addActionCard(card) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.actions);
  if (!sheet) return createErrorResponse('Actions sheet not found');

  const id = 'act_' + new Date().getTime();
  sheet.appendRow([
    id,
    card.title || '',
    card.owner || '',
    card.due || '',
    card.source || '',
    card.status || 'To do',
    new Date().toISOString()
  ]);
  return createJsonResponse({ success: true, id: id });
}

function updateActionCard(id, status) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.actions);
  if (!sheet) return createErrorResponse('Actions sheet not found');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.getRange(i + 1, 6).setValue(status); // column F = Status
      return createJsonResponse({ success: true });
    }
  }
  return createErrorResponse('Action card not found: ' + id);
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
    Logger.log(CONFIG.SHEETS[key] + ': ' + rows.length + ' rows');
  });
}
