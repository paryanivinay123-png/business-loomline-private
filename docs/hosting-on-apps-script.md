# Hosting Balooo on Google Apps Script

This lets your fellows open **one link** and use the dashboard — no server, no
Netlify, no separate hosting. The same Apps Script project that reads your
Google Sheet also serves the app.

How it works: when someone opens the web-app URL in a browser, `doGet` returns
the **app** (the `App` HTML file). The app then reads its data by calling the
server function `getData()` directly through `google.script.run` — so there is
no cross-origin fetch and nothing to configure. Writing action cards works the
same way (`addAction` / `updateAction`).

> The same `index.html` still works if you ever host it elsewhere (GitHub Pages,
> Netlify, opened as a file): when `google.script.run` isn't present it falls
> back to `fetch(APPS_SCRIPT_URL)`. You don't have to choose now.

---

## One-time setup

1. **Open your Apps Script project** (the one bound to the sheet — Extensions ▸
   Apps Script from the spreadsheet, or open it from script.google.com).

2. **Update the code file.** Open `Code.gs` and replace its entire contents with
   the latest `backend/Code.gs` from this repo. Save.

3. **Add the app file.**
   - Click **＋** next to *Files* ▸ **HTML**.
   - Name it exactly **`App`** (Apps Script will store it as `App.html`). The
     name must match `createHtmlOutputFromFile('App')` in `Code.gs`.
   - Delete the placeholder content, then paste the **entire** contents of
     `backend/App.html` from this repo (it's a copy of `index.html`). Save.

4. **Deploy a new version.**
   - **Deploy ▸ Manage deployments ▸** pencil (edit) on your existing web app.
   - **Version: New version.** (This is the step that actually publishes your
     changes — editing the code alone does nothing until you cut a new version.)
   - **Execute as: Me** — so the app can read *your* sheet on everyone's behalf.
   - **Who has access:**
     - *Anyone with a Google account* → your fellows sign in with Google and can
       view; good default for a small team.
     - *Anyone within `<your org>`* → only appears if you're on Google Workspace;
       restricts to your organisation.
     - *Anyone* → truly public (anyone with the link). Only if you're fine with
       that.
   - **Deploy**, and copy the **Web app URL** (the `…/exec` one).

5. **Share the `…/exec` URL** with your fellows. Opening it shows the dashboard.

That's it. The URL stays the same across future updates — just repeat steps 2–4
(replace `Code.gs` / `App` file, then **Deploy ▸ New version**) whenever you
change the app.

---

## Notes

- **`App.html` is a copy of `index.html`.** When the dashboard changes, re-copy
  `index.html` into the Apps Script `App` file (and into `backend/App.html` in
  the repo) so they stay in sync.
- **First open asks for authorisation** — because the app runs as you and
  touches your sheet, Google shows a one-time consent screen to *you* when you
  deploy/test. Your fellows won't see the sheet directly; they only see the
  dashboard.
- **The `MATERIALS` and `SKU_MATERIALS` tabs** must exist in the sheet for those
  screens to fill in — they're already in `CONFIG.SHEETS`.
- **AI ask** (`doPost action:'ask'`) still needs `ANTHROPIC_API_KEY` in Script
  Properties; it's unrelated to hosting.
