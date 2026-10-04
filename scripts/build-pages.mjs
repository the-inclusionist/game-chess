#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE BUILD CLOUDFLARE PAGES RUNS =========================
// One command that produces exactly what `o-inclusionista.jrocha.dev.br/game-chess/` needs:
// `vite build` under the right `base`, then `post-build-cloudflare.mjs` for `dist/_headers`.
//
// ⚠️ IT EXISTS BECAUSE NEITHER HALF WAS RELIABLY HAPPENING. `npm run build` is `vite build` and
// nothing else, so `_headers` — the file that keeps `sw.js` and `index.html` out of the edge cache
// — was never written by it. And the subpath came from an environment variable a human had to
// remember to set, which is the kind of step that works on the machine where it was invented.
//
// ⚠️ AND `[vars]` IN `wrangler.toml` IS A RUNTIME BINDING, NOT A BUILD VARIABLE. It is read by the
// Pages FUNCTION, after the build, in the Worker runtime. Whether a Pages BUILD also sees it is a
// question this repository should not have to be right about: the base is read from the file here
// and exported into the child process, so the answer does not matter.
//
// So: one source of truth for the path (`wrangler.toml`), one command for the build, and the same
// bytes whether it runs here or on their builder.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

/**
 * The game's path under the shared origin, read from `wrangler.toml`.
 *
 * ⚠️ PARSED RATHER THAN DUPLICATED. Writing `/game-chess/` here as well would be a second place
 * for it to be wrong, and the one that is wrong is always the one nobody looked at. A full TOML
 * parser is not worth a dependency for one line, and the shape of that line is fixed by the
 * platform's own convention (ADR-0117).
 */
function baseFromWrangler() {
  const file = join(REPO, 'wrangler.toml');
  if (!existsSync(file)) {
    throw new Error('build-pages: wrangler.toml is missing — it is where the game\'s path lives');
  }
  const match = /^\s*INCL_BASE\s*=\s*"([^"]+)"\s*$/m.exec(readFileSync(file, 'utf8'));
  if (!match) {
    throw new Error('build-pages: wrangler.toml has no `INCL_BASE = "…"` under [vars]');
  }
  const value = match[1];
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error(`build-pages: INCL_BASE must start and end with "/" — got ${JSON.stringify(value)}`);
  }
  return value;
}

const base = baseFromWrangler();
const env = { ...process.env, INCL_BASE: base };

const run = (what, args) => {
  // ⚠️ `shell: true` ON WINDOWS, because `npx`/`vite` are `.cmd` shims there and `spawnSync`
  // refuses to execute them directly. Harmless on the Linux builder, where it is a plain exec.
  const result = spawnSync(what, args, { stdio: 'inherit', env, cwd: REPO, shell: true });
  if (result.status !== 0) {
    console.error(`build-pages: \`${what} ${args.join(' ')}\` exited ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

/*
 * ========================= ⚠️ FROM AN EMPTY `dist/`, ALWAYS =========================
 * Vite's `emptyOutDir` empties the OUT dir, which under a subpath is `dist/game-chess` — not
 * `dist`. So a root build (`npm run build`) followed by this one leaves BOTH in the tree, and
 * Pages serves whatever is there: the whole game a second time at the ORIGIN ROOT, on a domain
 * that is meant to carry three hundred of them under their own slugs.
 *
 * Measured on this machine before this line: 83 files and 19 MB, which is the game twice over.
 * The builder checks out fresh and would never have shown it; a `wrangler pages deploy` from a
 * developer's tree would have published it.
 */
console.log(`build-pages: building for ${base}`);
rmSync(join(REPO, 'dist'), { recursive: true, force: true });
run('npx', ['vite', 'build']);
run('node', ['scripts/post-build-cloudflare.mjs']);
console.log(`build-pages: dist${base.replace(/\/$/, '')}/ is ready, dist/_headers written`);
