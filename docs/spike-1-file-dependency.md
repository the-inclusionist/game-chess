# Spike 1 — the engine as a `file:` dependency

**Verdict: PASS.** Run 2026-09-04. `typecheck` clean, `build` clean, boots in the browser
with no console errors. This repository is the **first external consumer** the engine has
ever had, so everything below was unproven until now.

## What passed

| Check | Result |
|---|---|
| `npm install` with `file:../SP-the-inclusionist-tracer` | 19 packages, 25 s, symlink created |
| `tsc --noEmit` under `strict` + `noUnusedLocals` | **0 errors** |
| `vite build` | 43 modules, 655 ms |
| Boot in the browser | `createGame()` returns, `engine.problems` empty |
| `conformanceProblems(declaration)` | empty — the chess declaration is well-formed |
| CVD filters mounted | 6 |
| `tts` · `overlays` · `nav` · `keyboard` · `sonar` · `cenas` | all present |
| `distance(e2, e3)` | 1 — Chebyshev, the king's step, straight from the contract |

## Risks retired

**Risk #2 — raw `.ts` exports through a symlink.** The engine's `exports` map targets `.ts`
files with no `types` condition and no build step. Under `moduleResolution: "bundler"` plus
`allowImportingTsExtensions`, TypeScript resolves them, and Vite transforms them through the
normal pipeline because linked dependencies are never pre-bundled. `optimizeDeps.exclude`
makes that explicit instead of incidental.

**Risk #3 — `import.meta.glob('../i18n/*.ts')` inside node_modules.** This was the one most
likely to fail silently. It did not: the build emitted `en-*.js` (24.8 kB) and `es-*.js`
(26.7 kB) as separate chunks, exactly as it does inside the engine's own repo. Per-locale
lazy loading survives the symlink.

**A fourth thing, unlisted but worth recording:** the bundle contains **no PixiJS**. The
claim in `boot/create-game.ts` — that it "does not wire render, physics, tiles or the sonar"
— holds when measured from outside. `createGame` is genuinely an accessibility contract, and
the renderer is ours to bring.

## The seven fields carry chess

Verified live, with no chess logic behind them yet:

- `nameAt` → "peão branco", "torre preta", "cavalo preto". The contract's `gender` field is
  what makes the second and third correct; a gender-blind version says "torre preto".
- `roleAt(e8)` → `goal` (the enemy king is what the round asks for); `roleAt(e4)` → `free`.
- `topology: {kind:'grid', cols:8, rows:8}` with `tick: 'player'`.

## Findings to act on

**1. A 26.8 MB WASM asset lands in `dist/` — and it costs nothing at boot. RESOLVED: keep
it.** The build emits `ort-wasm-simd-threaded.jsep-*.wasm` at 26,827 kB, the ONNX runtime
behind the engine's neural TTS. It is **not** loaded by `createGame`:
`platform/tts.ts:83` reaches it through `import('@mintplex-labs/piper-tts-web')` — a dynamic
import — and `:74` returns early unless the selected engine is `piper`, while `:60` defaults
the selection to `webspeech`, the browser's own voice. So it is an async chunk behind an
explicit user choice, fetched only if someone picks the neural voice.

Because this repo declines `vite-plugin-pwa` (YAGNI, until offline is a stated requirement),
the asset is not precached either. It sits in `dist/` as deploy weight and nothing more. No
alias, no stub, no engine change: the local neural voice stays available as the offline
fallback it is meant to be. Revisit only if a PWA precache is ever added here — then it would
need an explicit `globIgnores`.

**2. Three Node core modules externalized** — `fs`, `path`, `crypto`, all imported by
`piper-tts-web`. Build-time warnings on a chunk that is never fetched at boot. Harmless.

**3. `INEFFECTIVE_DYNAMIC_IMPORT`** — the engine's `core/i18n.ts` both statically and
dynamically imports `i18n/pt.ts`, so `pt` cannot be split into its own chunk. Pre-existing
engine behaviour, deliberate (pt loads synchronously at boot). Noted, not ours to fix.

**4. The spike page uses `innerHTML`** for its diagnostic table. Fine for a throwaway report
built entirely from local constants; the real `ui/grid-mirror.ts` must build DOM nodes, since
it will carry piece names into a live region.

## Reproduce

```bash
cd SP-the-inclusionist-chess
NODE_OPTIONS=--use-system-ca npm install
npm run typecheck && npm run build
```

Preview: `.claude/launch.json` entry **`chess-dist`** (port 8195) at the session cwd —
`python -m http.server 8195 --directory SP-the-inclusionist-chess/dist`. The Vite dev server
does not run in this sandbox; build first, serve `dist/`.
