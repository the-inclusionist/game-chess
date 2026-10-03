// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE OPPONENT IS IN THE PRECACHE, OR THE BUILD IS A LIE =========================
// ADR-0116 §2 states the rule this checks: «precached at install, never fetched lazily at first use».
// A service worker that ships without the engine's `.wasm` still registers, still reports itself
// installed, and still fails the first time a child plays offline — and the Dev's line settles why
// that matters here rather than being a nicety: «sem IA não há nem modo professor».
//
// ⚠️ AND THE FAILURE IT GUARDS IS SILENT BY DESIGN. Workbox drops any file over
// `maximumFileSizeToCacheInBytes` — 2 MiB by default — WITHOUT a warning. The 7.3 MB opponent would
// simply not be in the list, the build would be green, and the number in `vite.config.ts` would look
// like it had done its job. A number in a config is not evidence; this is.
//
// Run after `vite build`, as the last step of `npm run validate`.
import { readFileSync, existsSync } from 'node:fs';

/*
 * ⚠️ `INCL_BASE`-AWARE (Wave «Publicar», 2026-10-02): `vite build` writes to `dist${INCL_BASE}` so
 * the CF Pages Pages picks the right output root up. The dev build still writes to `dist/`, so an
 * empty `INCL_BASE` resolves back to the previous paths.
 */
const subpath = (process.env.INCL_BASE ?? '').replace(/\/+$/, '');
const SW = `dist${subpath}/sw.js`;
const MANIFEST = `dist${subpath}/manifest.webmanifest`;

/** What has to be in the precache, and why each one is named rather than counted. */
const REQUIRED = [
  // The opponent. Without it there is no game against a machine and no teaching mode.
  'stockfish-18-lite-single.wasm',
  // Its loader: the `.wasm` alone is unreachable.
  'stockfish-18-lite-single.js',
  /*
   * The page. ⚠️ THERE WERE THREE, one per view, and this list named all of them because a PWA that
   * installs one and 404s the others is worse than none. The views are renderers chosen inside one
   * document now, so there is one page and the other two would be names of files that do not exist
   * — a gate that guards a file nobody ships passes forever and protects nothing.
   */
  'index.html',
];

const problems = [];

if (!existsSync(SW)) {
  problems.push(`${SW} is missing — the app build did not produce a service worker`);
} else {
  const sw = readFileSync(SW, 'utf8');
  for (const name of REQUIRED) {
    if (!sw.includes(name)) problems.push(`${name} is NOT in the precache manifest`);
  }
}

if (!existsSync(MANIFEST)) {
  problems.push(`${MANIFEST} is missing — the app build is not installable`);
} else {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  /*
   * ⚠️ These two are checked because ADR-0140 records them as mistakes ALREADY MADE, in the
   * platformer's manifest: `scope: "/"` claims the whole origin for one game, and `lang: "en"`
   * is wrong for a product delivered in Portuguese. A record naming a defect is worth a gate.
   */
  if (manifest.lang !== 'pt-BR') problems.push(`manifest lang is ${manifest.lang}, not pt-BR`);
  if (manifest.scope === '/') problems.push('manifest scope claims the whole origin');
  if (!manifest.icons?.length) problems.push('manifest has no icons');
}

if (problems.length > 0) {
  console.error('check-precache FAILED');
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

console.log(`check-precache ok — ${REQUIRED.length} required entries present, manifest is pt-BR`);
