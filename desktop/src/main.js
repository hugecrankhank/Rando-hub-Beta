/*
 * Rando Hub for Windows: the Rando Hub web app in its own desktop window.
 *
 * The app's files (web/, the same files as the website and the release zip)
 * are served from a small web server inside this program, on
 * http://127.0.0.1:47067 (loopback only, so no firewall prompt and nothing
 * reachable from the network). A real http://127.0.0.1 address matters: the
 * seed relays accept it, service workers and WebAssembly work, and the app's
 * saves (IndexedDB / localStorage) stay put between runs.
 *
 * Pop-out tracker windows, stream windows, timer and broadcast windows open
 * as native windows of their own. Links to other sites open in your browser.
 *
 * Menu → Version lets you switch to the live website instead (always the
 * newest version). The two keep separate saves, like two different sites.
 */
'use strict';

const { app, BrowserWindow, Menu, shell, dialog, net, screen, session, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const WEB_ROOT = path.join(__dirname, 'web');
const ICON = path.join(__dirname, 'icon.png');
// desktop.json (from desktop/config.json): which Rando Hub this is. The beta
// has its own name, port, saves, website and releases, so both can be installed.
const CFG = Object.assign({
  productName: 'Rando Hub', appId: 'com.hugecrankhank.randohub', repo: 'hugecrankhank/Rando-hub',
  website: 'https://hugecrankhank.github.io/Rando-hub/', port: 47067, assetPrefix: 'Rando-Hub-Windows',
}, (() => { try { return require('./desktop.json'); } catch (e) { return {}; } })());
const NAME = CFG.productName;
const WEBSITE = CFG.website.replace(/\/?$/, '/');
const WEBSITE_ORIGIN = new URL(WEBSITE).origin;
const WEBSITE_PATH = new URL(WEBSITE).pathname;          // e.g. /Rando-hub/
const REPO = 'https://github.com/' + CFG.repo;
const PORT_BASE = CFG.port;
const BG = '#161b22';

// ── portable mode: a "data" folder next to Rando Hub.exe keeps everything there
if (app.isPackaged) {
  const portable = path.join(path.dirname(process.execPath), 'data');
  if (fs.existsSync(portable)) app.setPath('userData', portable);
}

// ── an emulator must keep running when its window isn't in front ────────────
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
if (process.platform === 'win32') app.setAppUserModelId(CFG.appId);

if (!app.requestSingleInstanceLock()) { app.quit(); }

// ── settings ────────────────────────────────────────────────────────────────
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'desktop-settings.json');
let settings = { source: 'builtin', bounds: null, skipVersion: '' };
function loadSettings() {
  try { settings = Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'))); } catch (e) { /* first run */ }
}
function saveSettings() {
  try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch (e) { /* not fatal */ }
}

function bundledVersion() {
  try {
    const m = fs.readFileSync(path.join(WEB_ROOT, 'index.html'), 'utf8').match(/<meta name="version" content="([^"]+)">/);
    return m ? m[1] : app.getVersion();
  } catch (e) { return app.getVersion(); }
}
const BUNDLED = bundledVersion();

function newer(a, b) {   // is version a newer than b?
  const pa = String(a).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

// ── the built-in web server ─────────────────────────────────────────────────
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glsl': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8', '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml',
  '.zip': 'application/zip', '.whl': 'application/zip', '.tar': 'application/x-tar',
  '.bin': 'application/octet-stream', '.bps': 'application/octet-stream', '.ips': 'application/octet-stream',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

function handle(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400).end(); return; }
  // Muffins' tracker (mfns-tracker/app/) is built for the website's address
  // (/Rando-hub/… or /Rando-hub-Beta/…); here the app is at /, so that part is dropped.
  if (WEBSITE_PATH !== '/' && p.startsWith(WEBSITE_PATH)) p = p.slice(WEBSITE_PATH.length - 1);
  const root = path.resolve(WEB_ROOT);
  let file = path.resolve(path.join(root, p));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!p.endsWith('/')) {   // like GitHub Pages: /glr → /glr/ so relative links work
        const q = req.url.indexOf('?');
        res.writeHead(301, { Location: req.url.slice(0, q < 0 ? undefined : q).replace(/\/?$/, '/') + (q < 0 ? '' : req.url.slice(q)) }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
      const headers = {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes',
        'Last-Modified': st2.mtime.toUTCString(),
      };
      let start = 0, end = st2.size - 1, status = 200;
      const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (range && st2.size > 0) {
        if (range[1] === '' && range[2] !== '') { start = Math.max(0, st2.size - Number(range[2])); }
        else { start = Number(range[1] || 0); if (range[2] !== '') end = Math.min(end, Number(range[2])); }
        if (start > end || start >= st2.size) { res.writeHead(416, { 'Content-Range': `bytes */${st2.size}` }).end(); return; }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${st2.size}`;
      }
      headers['Content-Length'] = st2.size === 0 ? 0 : end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || st2.size === 0) { res.end(); return; }
      fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    let port = PORT_BASE, tries = 0;
    const server = http.createServer(handle);
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries++ < 20) { port++; server.listen(port, '127.0.0.1'); return; }
      reject(e);
    });
    server.listen(port, '127.0.0.1', () => resolve(port));
  });
}

// ── windows ─────────────────────────────────────────────────────────────────
let mainWin = null;
let localOrigin = '';

const WEB_PREFS = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  backgroundThrottling: false,
  spellcheck: false,
};

function startUrl() { return settings.source === 'website' ? WEBSITE : localOrigin + '/'; }

function isAppUrl(url) {
  if (!url || url === 'about:blank') return true;
  if (localOrigin && (url === localOrigin || url.startsWith(localOrigin + '/'))) return true;
  return url === WEBSITE.slice(0, -1) || url.startsWith(WEBSITE);
}

// Other web apps the hub opens in a window of their own (not the browser):
// ZQuest Classic's player (Zelda Classic; ../zclassic.js). They keep their own
// site's address, saves and headers, get no preload, and can outlive the hub.
const PARTNERS = ['https://web.zquestclassic.com/'];
const isPartnerUrl = (url) => !!url && PARTNERS.some((p) => url === p.slice(0, -1) || url.startsWith(p));
const partnerWindows = new WeakSet();

function openOutside(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url).catch(() => {});
}

function onScreen(b) {
  if (!b || typeof b.x !== 'number') return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 50 && b.x + b.width > a.x + 50 && b.y >= a.y - 10 && b.y < a.y + a.height - 50;
  });
}

function createMainWindow() {
  const b = settings.bounds || {};
  const opts = {
    width: b.width || 1400, height: b.height || 900, minWidth: 480, minHeight: 360,
    backgroundColor: BG, title: NAME, icon: ICON, show: false, autoHideMenuBar: true,
    webPreferences: WEB_PREFS,
  };
  if (onScreen(b)) { opts.x = b.x; opts.y = b.y; }
  mainWin = new BrowserWindow(opts);
  mainWin.once('ready-to-show', () => { if (b.maximized) mainWin.maximize(); mainWin.show(); });

  let boundsTimer = null;
  const keepBounds = (now) => {
    clearTimeout(boundsTimer);
    const save = () => {
      if (!mainWin || mainWin.isDestroyed() || mainWin.isMinimized() || mainWin.isFullScreen()) return;
      settings.bounds = Object.assign(mainWin.getNormalBounds(), { maximized: mainWin.isMaximized() });
      saveSettings();
    };
    if (now === true) save(); else boundsTimer = setTimeout(save, 600);
  };
  ['resize', 'move', 'maximize', 'unmaximize'].forEach((ev) => mainWin.on(ev, keepBounds));
  mainWin.on('close', () => keepBounds(true));
  mainWin.on('closed', () => {
    mainWin = null;
    // The pop-outs only work with the main window: close them too (not ZQuest Classic).
    BrowserWindow.getAllWindows().forEach((w) => { if (!w.isDestroyed() && !partnerWindows.has(w)) w.destroy(); });
  });

  mainWin.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;   // -3: aborted (a normal redirect/reload)
    if (settings.source === 'website') {
      dialog.showMessageBox(mainWin, {
        type: 'warning', title: NAME, buttons: ['Use the built-in version', 'Try again'], defaultId: 0, cancelId: 1,
        message: `Couldn't reach the ${NAME} website.`,
        detail: `${desc} (${code}). The built-in version v${BUNDLED} works without internet (its saves are separate from the website's).`,
      }).then(({ response }) => { if (response === 0) setSource('builtin', true); else mainWin.loadURL(startUrl()); });
    }
  });

  mainWin.loadURL(startUrl());
}

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isPartnerUrl(url)) {
      return {
        action: 'allow',
        outlivesOpener: true,
        overrideBrowserWindowOptions: {
          icon: ICON, backgroundColor: '#000000', autoHideMenuBar: true, width: 1100, height: 860,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false },
        },
      };
    }
    if (isAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          icon: ICON, backgroundColor: BG, autoHideMenuBar: true,
          webPreferences: Object.assign({}, WEB_PREFS),
        },
      };
    }
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (w, { url }) => { if (isPartnerUrl(url)) partnerWindows.add(w); });
  contents.on('will-navigate', (e, url) => {
    if (isPartnerUrl(url)) return;                       // ZQuest Classic stays in its window
    const w = BrowserWindow.fromWebContents(contents);
    const partner = (w && partnerWindows.has(w)) || isPartnerUrl(contents.getURL());
    if (partner || !isAppUrl(url)) { e.preventDefault(); openOutside(url); }
  });
  // The hub only saves on leaving; never let it hold a window open. A partner
  // (ZQuest Classic's editor, say) may have unsaved work: ask.
  contents.on('will-prevent-unload', (e) => {
    const w = BrowserWindow.fromWebContents(contents);
    if (!w || !partnerWindows.has(w)) { e.preventDefault(); return; }
    const pick = dialog.showMessageBoxSync(w, { type: 'question', buttons: ['Leave', 'Stay'], defaultId: 1, cancelId: 1,
      title: w.getTitle(), message: 'Leave this page?', detail: 'Changes you haven’t saved may be lost.' });
    if (pick === 0) e.preventDefault();
  });
  contents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    const win = BrowserWindow.fromWebContents(contents);
    if (!win || win !== mainWin) return;
    dialog.showMessageBox(win, {
      type: 'error', title: NAME, buttons: ['Reload', 'Close'], defaultId: 0,
      message: `${NAME} stopped unexpectedly.`, detail: `Reason: ${details.reason}`,
    }).then(({ response }) => { if (response === 0 && !win.isDestroyed()) win.reload(); else if (!win.isDestroyed()) win.close(); });
  });
});

// ── version: built-in or website ────────────────────────────────────────────
function setSource(source, quiet) {
  if (settings.source === source) return;
  const go = () => {
    settings.source = source; saveSettings();
    BrowserWindow.getAllWindows().forEach((w) => { if (w !== mainWin && !w.isDestroyed() && !partnerWindows.has(w)) w.destroy(); });
    if (mainWin) mainWin.loadURL(startUrl());
    buildMenu();
    findUpdate().catch(() => {});   // what counts as an update depends on the version played
  };
  if (quiet) { go(); return; }
  dialog.showMessageBox(mainWin, {
    type: 'question', title: NAME, buttons: ['Switch', 'Cancel'], defaultId: 0, cancelId: 1,
    message: source === 'website' ? `Use the ${NAME} website (always the newest version)?` : `Use the built-in ${NAME} v${BUNDLED}?`,
    detail: 'The built-in version and the website keep separate saves, presets and settings (the app sees them as two different sites). '
      + 'Switching back later brings the other set back. The website version needs internet the first time; after that it also opens offline.',
  }).then(({ response }) => { if (response === 0) go(); else buildMenu(); });
}

// ── updates ─────────────────────────────────────────────────────────────────
// Where updates come from: the latest GitHub release (its
// Rando-Hub-Desktop-v…-win-x64.zip is the download) and the website's version.
// Checked at start and every few hours; the header button and a one-time alert
// per version tell the player. The button in the page talks to this through
// preload.js.
const RELEASES_API = process.env.RANDOHUB_UPDATE_API || `https://api.github.com/repos/${CFG.repo}/releases/latest`;   // env: testing only
const DESKTOP_ASSET = new RegExp('^' + CFG.assetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-v[0-9][0-9.]*\\.zip$', 'i');
const CHECK_EVERY = 4 * 60 * 60 * 1000;
let update = { status: 'idle', current: BUNDLED, latest: '', download: '', downloadName: '', page: '', progress: 0, file: '', error: '' };
const alerted = new Set();

function sendUpdateState() {
  const state = Object.assign({ source: settings.source }, update);
  BrowserWindow.getAllWindows().forEach((w) => { if (!w.isDestroyed()) w.webContents.send('rh:update-state', state); });
}
function setUpdate(patch) { Object.assign(update, patch); sendUpdateState(); }

async function websiteVersion() {
  const res = await net.fetch(WEBSITE, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const m = (await res.text()).match(/<meta name="version" content="([^"]+)">/);
  if (!m) throw new Error('no version on the page');
  return m[1];
}

async function latestRelease() {
  const res = await net.fetch(RELEASES_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'RandoHub-Desktop/' + BUNDLED } });
  if (!res.ok) throw new Error('GitHub: HTTP ' + res.status);
  const j = await res.json();
  const asset = (j.assets || []).find((a) => DESKTOP_ASSET.test(a.name));
  return { version: String(j.tag_name || '').replace(/^v/i, ''), download: asset ? asset.browser_download_url : '', name: asset ? asset.name : '', page: j.html_url || REPO + '/releases/latest' };
}

/** Look for a newer version. Returns true if one is available. */
async function findUpdate() {
  if (update.status === 'downloading') return true;
  setUpdate({ status: 'checking', error: '' });
  const [rel, site] = await Promise.allSettled([latestRelease(), websiteVersion()]);
  const r = rel.status === 'fulfilled' ? rel.value : null;
  const w = site.status === 'fulfilled' ? site.value : '';
  if (!r && !w) {
    setUpdate({ status: 'error', error: (rel.reason && rel.reason.message) || (site.reason && site.reason.message) || 'offline' });
    return false;
  }
  const hasDownload = !!(r && r.download && newer(r.version, BUNDLED));
  // Playing the website already means the newest web app: only a new desktop
  // download counts then. Otherwise a newer website version counts too.
  let latest = hasDownload ? r.version : '';
  if (settings.source !== 'website' && w && newer(w, latest || BUNDLED)) latest = w;
  if (!latest || !newer(latest, BUNDLED)) { setUpdate({ status: 'current', latest: w || (r && r.version) || BUNDLED }); return false; }
  setUpdate({
    status: update.file && update.latest === latest ? 'downloaded' : 'available', latest,
    download: hasDownload ? r.download : '', downloadName: hasDownload ? r.name : '', page: r ? r.page : REPO + '/releases/latest',
  });
  return true;
}

async function offerUpdate() {
  if (update.status === 'downloaded') { showDownloaded(); return; }
  if (update.status === 'downloading') return;
  const dl = !!update.download;
  const buttons = [];
  if (dl) buttons.push('Download update');
  if (settings.source !== 'website') buttons.push('Play the website version');
  if (!dl) buttons.push('Open download page');
  buttons.push('Later', 'Skip this version');
  const { response } = await dialog.showMessageBox(mainWin, {
    type: 'info', title: 'Update available', buttons, defaultId: 0, cancelId: buttons.indexOf('Later'), noLink: true,
    message: `${NAME} v${update.latest} is available`,
    detail: `You have v${BUNDLED}.\n\n`
      + (dl ? 'Download update gets the new version for you. Unzip it and replace your ${NAME} folder; your saves and settings are kept.'
            : 'The desktop download for this version isn’t ready yet. ')
      + (settings.source !== 'website' ? '\n\nPlay the website version switches to the live site right away (it keeps its own saves).' : ''),
  });
  const pick = buttons[response];
  if (pick === 'Download update') downloadUpdate();
  else if (pick === 'Play the website version') setSource('website');
  else if (pick === 'Open download page') shell.openExternal(update.page || REPO + '/releases/latest');
  else if (pick === 'Skip this version') { settings.skipVersion = update.latest; saveSettings(); }
}

function downloadUpdate() {
  if (!update.download || !mainWin) return;
  setUpdate({ status: 'downloading', progress: 0 });
  mainWin.webContents.downloadURL(update.download);
}

function showDownloaded() {
  dialog.showMessageBox(mainWin, {
    type: 'info', title: 'Update downloaded', buttons: ['Show the file', 'OK'], defaultId: 0, noLink: true,
    message: `${NAME} v${update.latest} is downloaded`,
    detail: `${update.file}\n\nTo update: close ${NAME}, unzip the file, and replace your current ${NAME} folder with the new one. Your saves and settings are kept.`,
  }).then(({ response }) => { if (response === 0) shell.showItemInFolder(update.file); });
}

function watchDownloads(sess) {
  sess.on('will-download', (_e, item) => {
    if (update.status !== 'downloading' || item.getURL() !== update.download && !item.getURLChain().includes(update.download)) return;   // other downloads: normal Save dialog
    const dir = app.getPath('downloads');
    let file = path.join(dir, update.downloadName || item.getFilename());
    for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, path.basename(update.downloadName || item.getFilename(), '.zip') + ` (${i}).zip`);
    item.setSavePath(file);
    item.on('updated', () => {
      const total = item.getTotalBytes();
      if (total) setUpdate({ progress: Math.round(item.getReceivedBytes() / total * 100) });
      if (mainWin && total) mainWin.setProgressBar(item.getReceivedBytes() / total);
    });
    item.once('done', (_ev, state) => {
      if (mainWin) mainWin.setProgressBar(-1);
      if (state === 'completed') { setUpdate({ status: 'downloaded', file, progress: 100 }); showDownloaded(); }
      else {
        setUpdate({ status: 'available', progress: 0 });
        dialog.showMessageBox(mainWin, { type: 'warning', title: NAME, message: 'The update didn’t finish downloading.', detail: `(${state}) You can try again, or get it from the download page.`, buttons: ['Open download page', 'OK'], noLink: true })
          .then(({ response }) => { if (response === 0) shell.openExternal(update.page || REPO + '/releases/latest'); });
      }
    });
  });
}

/** Automatic check: the alert appears once per version (unless skipped). */
async function autoCheck() {
  if (!(await findUpdate())) return;
  if (settings.skipVersion === update.latest || alerted.has(update.latest) || update.status !== 'available') return;
  alerted.add(update.latest);
  offerUpdate();
}

/** Menu → Check for updates: always answers. */
async function checkForUpdates() {
  const found = await findUpdate();
  if (found) { offerUpdate(); return; }
  if (update.status === 'error') dialog.showMessageBox(mainWin, { type: 'warning', title: NAME, message: 'Couldn’t check for updates.', detail: `${update.error}\nCheck your internet connection and try again.` });
  else dialog.showMessageBox(mainWin, { type: 'info', title: NAME, message: 'You’re up to date.', detail: `You have ${NAME} v${BUNDLED}, the newest version.` });
}

ipcMain.on('rh:is-main-page', (e, href) => {
  let u; try { u = new URL(href); } catch (x) { e.returnValue = false; return; }
  const p = u.origin + u.pathname;
  e.returnValue = [localOrigin + '/', localOrigin + '/index.html', WEBSITE, WEBSITE + 'index.html'].includes(p);
});
ipcMain.handle('rh:update-state', () => Object.assign({ source: settings.source }, update));
ipcMain.handle('rh:update-click', async () => {
  if (['available', 'downloaded'].includes(update.status)) { offerUpdate(); return; }
  if (update.status === 'checking' || update.status === 'downloading') return;
  if (await findUpdate()) offerUpdate();
});

// ── menu ────────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: `Open ${NAME} website in browser`, click: () => shell.openExternal(WEBSITE) },
        { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomIn', accelerator: 'CommandOrControl+=', visible: false },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: 'Version',
      submenu: [
        { label: `Built-in v${BUNDLED} (works offline)`, type: 'radio', checked: settings.source !== 'website', click: () => setSource('builtin') },
        { label: 'Website (always the newest)', type: 'radio', checked: settings.source === 'website', click: () => setSource('website') },
        { type: 'separator' },
        { label: 'Check for updates…', click: () => checkForUpdates() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `${NAME} on GitHub`, click: () => shell.openExternal(REPO) },
        { label: 'Manual (README)', click: () => shell.openExternal(REPO + '#readme') },
        { label: 'What’s new (changelog)', click: () => shell.openExternal(REPO + '/blob/main/CHANGELOG.md') },
        { type: 'separator' },
        {
          label: `About ${NAME}`, click: () => dialog.showMessageBox(mainWin, {
            type: 'info', title: `About ${NAME}`, icon: ICON,
            message: `${NAME} v${BUNDLED}`,
            detail: `Desktop app (Electron ${process.versions.electron}, Chromium ${process.versions.chrome}).\n`
              + `Playing: ${settings.source === 'website' ? 'the website version' : 'the built-in version'}.\n`
              + `Data folder: ${app.getPath('userData')}\n\n`
              + 'Credits and licenses: see Credits in the app, and LICENSE.md / NOTICE.md next to the program.',
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── start ───────────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (!mainWin) { createMainWindow(); return; }   // only ZQuest Classic was still open
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.focus();
});

app.whenReady().then(async () => {
  loadSettings();
  try {
    const port = await startServer();
    localOrigin = `http://127.0.0.1:${port}`;
    if (port !== PORT_BASE) console.warn(`[desktop] port ${PORT_BASE} busy, using ${port} (saves made on another port won't show here)`);
  } catch (e) {
    dialog.showErrorBox(NAME, `Couldn't start the built-in server: ${e.message}`);
    if (settings.source !== 'website') { app.quit(); return; }
  }
  buildMenu();
  createMainWindow();
  watchDownloads(session.defaultSession);
  setTimeout(autoCheck, 5000);
  setInterval(autoCheck, CHECK_EVERY);
});

app.on('window-all-closed', () => app.quit());
