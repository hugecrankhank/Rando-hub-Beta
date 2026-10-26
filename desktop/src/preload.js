/*
 * The desktop app's own button in Rando Hub's header (top right): check for
 * updates, and show when one is available or downloading. It talks to the
 * main process (main.js); the page itself is untouched.
 */
'use strict';
const { ipcRenderer } = require('electron');

function isMainPage() {
  if (window.top !== window) return false;
  try { return ipcRenderer.sendSync('rh:is-main-page', location.href) === true; } catch (e) { return false; }
}

const CSS = `
#rh-update { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font: inherit; font-size: 13px; }
#rh-update .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dim, #8b95a3); display: inline-block; }
#rh-update.available, #rh-update.downloaded { border-color: var(--accent, #5fbf6f) !important; color: var(--accent, #5fbf6f); font-weight: 600; }
#rh-update.available .dot, #rh-update.downloaded .dot { background: var(--accent, #5fbf6f); animation: rh-pulse 1.6s ease-in-out infinite; }
#rh-update.downloading .dot { background: var(--warn, #e3b341); }
#rh-update.error .dot { background: var(--bad, #e5534b); }
#rh-update.current .dot { background: var(--accent, #5fbf6f); }
@keyframes rh-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(95,191,111,.7); } 50% { box-shadow: 0 0 0 5px rgba(95,191,111,0); } }
`;

let btn = null, state = null, flashTimer = null, flashing = false;

function render() {
  if (!btn || !state) return;
  const s = state.status;
  let text = 'Check for updates', title = `Version ${state.current}. Click to check for a newer version.`;
  if (s === 'checking') text = 'Checking…';
  else if (s === 'available') { text = `Update v${state.latest}`; title = `Version ${state.latest} is available (you have v${state.current}). Click to update.`; }
  else if (s === 'downloading') { text = `Downloading ${state.progress || 0}%`; title = `Downloading v${state.latest}…`; }
  else if (s === 'downloaded') { text = `v${state.latest} downloaded`; title = 'Click to see how to install it.'; }
  else if (flashing && s === 'current') { text = 'Up to date'; title = `v${state.current} is the newest version.`; }
  else if (flashing && s === 'error') { text = 'Couldn’t check'; title = `Couldn't check for updates: ${state.error}`; }
  btn.className = (s === 'current' || s === 'error') && !flashing ? '' : s;
  btn.title = title;
  btn.lastChild.textContent = text;
}

function onState(next) {
  const prev = state && state.status;
  state = next;
  // After a check the button says "Up to date" / "Couldn't check" for a moment.
  if (prev === 'checking' && (next.status === 'current' || next.status === 'error')) {
    flashing = true; clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashing = false; render(); }, 4000);
  }
  render();
}

function addButton() {
  const header = document.querySelector('header');
  if (!header || document.getElementById('rh-update')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  btn = document.createElement('button');
  btn.id = 'rh-update';
  btn.type = 'button';
  btn.innerHTML = '<i class="dot"></i><span></span>';
  btn.addEventListener('click', () => ipcRenderer.invoke('rh:update-click'));
  const anchor = document.getElementById('link-status');
  if (anchor && anchor.parentNode === header) anchor.after(btn); else header.appendChild(btn);
  ipcRenderer.invoke('rh:update-state').then(onState);
}

ipcRenderer.on('rh:update-state', (_e, s) => onState(s));

if (isMainPage()) {
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', addButton);
  else addButton();
}
