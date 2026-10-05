// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= ONE STATIC SERVER, FOR EVERY GATE THAT NEEDS ONE =========================
// `check-rendered.mjs` wrote this server first and kept it to itself. `check-axe.mjs` needs exactly
// the same thing — `dist/` over HTTP on a port nobody chose — and copying forty lines to get it is
// the shape ADR-0068 §4 refuses by name: «copies drift, and the ones that drift silently are the
// ones that STOP GATING».
//
// It is not hypothetical here. Two of the lines below are bug fixes with a date on them, and a copy
// made today would carry them while a copy made last week would not. The one that matters most is
// the Windows `normalize` ordering: get it wrong and `/` never resolves to `index.html`, the page
// comes back blank, and the gate's first symptom is a 404 that says nothing about why.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

/**
 * A static server over `dist/`, on whatever port the OS hands out.
 *
 * @returns {Promise<{ server: import('node:http').Server, port: number, origin: string }>}
 */
export async function serveDist() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // ⚠️ THE DIRECTORY CHECK COMES BEFORE `normalize`, and on Windows it has to: `normalize('/')`
    // answers `\`, so asking the normalised path whether it ends in a slash is always no and `/`
    // never resolves to index.html. The page came back blank and the first symptom was a 404.
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const path = normalize(pathname);
    // ⚠️ The join is guarded: a served tree is a served tree, even on a developer's laptop.
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return { server, port, origin: `http://127.0.0.1:${port}` };
}
