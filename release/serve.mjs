#!/usr/bin/env node
// Runs Rando Hub on this computer: a tiny web server for the app/ folder next
// to this file, then opens it in your browser. Needs Node.js 18 or newer and
// nothing else (no npm install). Stop it by closing this window (or Ctrl+C).
//
//   node serve.mjs            serve on http://localhost:8067 and open it
//   node serve.mjs 9000       use another port
//   node serve.mjs --no-open  don't open a browser

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'app');
const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
let port = Number(args.find((a) => /^\d+$/.test(a)) || 8067);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glsl': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.zip': 'application/zip', '.whl': 'application/zip', '.bin': 'application/octet-stream',
  '.bps': 'application/octet-stream', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`Can't find the app at ${ROOT}.\nRun this from the unzipped Rando Hub folder (not from inside the .zip).`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400).end(); return; }
  let file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { file = path.join(file, 'index.html'); }
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st2.size,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    });
  });
});

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

let tries = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && tries++ < 10) { port++; server.listen(port, '127.0.0.1'); return; }
  console.error('Could not start the web server:', e.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Rando Hub is running at ${url}`);
  console.log('Keep this window open while you play. Close it to stop.');
  if (!noOpen) openBrowser(url);
});
