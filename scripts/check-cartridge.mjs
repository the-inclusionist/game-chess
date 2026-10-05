// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT A CARTRIDGE MAY ASK FOR, AND WHAT IT MAY CARRY =========================
// Two facts about the library build have to agree and live in different files, which is the shape of
// drift this repository keeps finding:
//
//   · `vite.config.ts` decides what is EMITTED as a bare import (`rollupOptions.external`).
//   · `package.json` decides what a consumer is asked to INSTALL (`peerDependencies`).
//
// Either one alone is silent when they disagree. Externalising a package nobody declares gives an
// install that resolves nothing, and the error arrives at the platform's build rather than ours.
// Declaring a peer nothing imports asks every consumer for a package they never load — which was
// true here for `three`: it is INLINED into `view-solid`, so the copy that runs is ours and the copy
// they installed sat in `node_modules` unread.
//
// ⚠️ AND THE SECOND CHECK IS A DEFECT ALREADY MADE. The first cartridge build came out at 7.6 MB, of
// which 7.1 was `app/public/vendor/` — Vite copies `publicDir` into EVERY build, so the package was
// carrying the 7.3 MB opponent and the font files. ADR-0117 names exactly that: «a cartridge declares
// no delivery — no font file, no voice, no runtime in a game's own package or dist». The platform
// loads those once for all games, which is the whole arithmetic of one origin. `publicDir: false`
// fixed it; nothing but this says it stays fixed.
//
// Run after `vite build --mode cartridge`, as part of `npm run validate`.
//
// 📌 AND IT IS NOT THE ENGINE'S CHECKER, which runs beside it. `inclusionist-check-cartridge` IMPORTS the
// built cartridge and applies the refusals `createGame` and `mount()` apply at boot — is there a default
// export, does the declaration conform. This one never imports anything: it READS THE EMITTED TEXT for bare
// specifiers and compares that set with `peerDependencies`. Neither can see what the other sees, which is why
// both run.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIB = 'dist-lib';
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const peers = Object.keys(manifest.peerDependencies ?? {});

/** What a game must never ship: the platform delivers these once, for everyone. */
const DELIVERY = /\.(wasm|woff2?|ttf|otf|eot|mp3|ogg|wav|onnx)$/i;

const problems = [];

if (!existsSync(LIB)) {
  problems.push(`${LIB} is missing — run \`vite build --mode cartridge\` first`);
} else {
  /** Every file under `dist-lib`, at any depth. */
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  const files = walk(LIB);

  for (const path of files) {
    if (DELIVERY.test(path)) problems.push(`${path} is delivery, and a cartridge declares none (ADR-0117)`);
  }

  /*
   * The bare specifiers the build actually emitted. A relative one is our own chunk; anything else
   * is a package the consumer has to resolve, and therefore something we have to have asked for.
   *
   * ⚠️ MATCHED ON THE EMITTED TEXT rather than parsed, because that is the artifact the consumer
   * gets. A parser would be answering a question about our source; this answers the question about
   * the file on disk.
   */
  const asked = new Set();
  for (const path of files.filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(path, 'utf8');
    for (const [, spec] of code.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      // The package, not the subpath: `@scope/name/deep/file.js` is still one dependency.
      const parts = spec.split('/');
      asked.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
    }
  }

  for (const name of asked) {
    if (!peers.includes(name)) {
      problems.push(`${name} is imported by name but is not a peerDependency — the consumer has nothing to resolve`);
    }
  }
  for (const name of peers) {
    if (!asked.has(name)) {
      problems.push(`${name} is a peerDependency the build never imports — an install asked for and never read`);
    }
  }
}

if (problems.length > 0) {
  console.error('check-cartridge FAILED');
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

console.log(`check-cartridge ok — ${peers.length} peers, every one imported, nothing delivered`);
