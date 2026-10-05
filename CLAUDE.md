# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                  # vite dev server
npm run typecheck            # tsc --noEmit — zero errors, no budget
npm test                     # both Vitest projects
npm run test:node            # logic only, no DOM
npm run test:browser         # real Chromium (Playwright provider)
npm run build                # the app (standalone PWA) → dist/
npm run build:cartridge      # the cartridge → dist-lib/
npm run validate             # the whole chain, in the order CI runs it
```

One test file: `npx vitest run --project node tests/opening-notes.node.test.ts`.
One case: add `-t 'part of the test name'`.

**The gates are not tests and do not run under Vitest.** They drive the BUILT `dist/` in a real
browser, so `npm run build` has to have run first or they measure the previous build:

```bash
node scripts/check-precache.mjs    # the opponent really is in the service worker's manifest
node scripts/check-rendered.mjs    # the page draws what it computed, in all three views
node scripts/check-axe.mjs         # axe-core, WCAG 2.2 A+AA, no allow-list
node scripts/check-cartridge.mjs   # emitted bare imports vs `peerDependencies`
npx inclusionist-check-cartridge   # the engine's own boot refusals, on the built cartridge
```

`npm run test:a11y` chains the first three. That name is load-bearing: the shared CI workflow
offers exactly one post-build hook, and it is this script — anything that must run against the
built page in CI has to hang off it.

## Two targets from one source tree

ADR-0140 §1. `vite.config.ts` describes **only the app**; the cartridge is the engine's build:

```ts
export default defineGameBuild({ cartridge: 'src/index.ts', config: appConfig });
```

`vite build` → the standalone PWA. `vite build --mode cartridge` → `dist-lib/cartridge.js` +
`cartridge.d.ts`, with the engine and Zdog external. Four decisions (externals as **prefixes**, no
`publicDir`, no service worker, types emitted) belong to `@the-inclusionist/engine/build` and must
not be re-made here — five games wrote five of them once, which is what ADR-0253 ended.

The standalone artifact is a development, test, audit and demonstration route. **Delivery to
children is the platform's job**, because Cache Storage partitions by origin and a child's
accessibility profile has to follow her between games.

## The cartridge contract

`src/index.ts` default-exports `{ slug, declaration, hooks, create }` (ADR-0139 §2). Two things
about it are easy to get wrong and both were measured:

- **The hooks are a nested FIELD, not spread.** `createGame` reads them flat (a host already spread
  them); `inclusionist-check-cartridge` reads `cartridge.hooks`. Written flat, the gate reports
  `accommodations: missing` about an object that is demonstrably present.
- **There are two declarations, and that is the design.** The module-level one
  (`app/js/declaration/cartridge-answers.ts`) is built from a fresh game with **no DOM** and is read
  once, at import, as the conformance statement — `conformanceProblems` checks *shape, not truth*.
  The live one reads `rules()`, `state()` and `cursor()` and reaches the engine through
  `ctx.engine.mount()` on the last line of `create`.

Importing the cartridge must need no page. `tests/cartridge-contract.node.test.ts` runs in the
`node` project for exactly that reason: a `document` at module scope fails at the import.

## Composition and the three views

`app/js/boot/game-shell.ts` is the composition root — every panel, the clock, the HUD, the
declaration and the hooks are built there, and it is long on purpose. `boot/standalone.ts` is the
page's half: it builds the cartridge, calls `createGame`, then `cartridge.create(engine)` — in that
order, because `createGame` needs the declaration as a value.

The three renderers are **dynamic imports** behind `boot/views.ts` (flat 0.8 kB, Zdog 38.2 kB, solid
540.7 kB). Anything that needs a view must await it; the cartridge's own construction stays
synchronous. Tests hand in a fake view instead (`tests/helpers/shell-fixture.ts`).

`#game-region` is **the board plus the side panel**, and the whole stage is 16:9 with nothing drawn
outside it. Panels under the board live in `#below-board`, which is `flex: 0 0 auto` inside
`#stage-wrap` — every pixel drawn there is a pixel the board gives back.

## i18n, in three layers

1. `app/js/i18n/{pt,en,es}.ts` — ~25 labels every page needs at boot, imported statically.
2. `app/js/i18n/teach/` — lesson prose, fetched when APRENDER opens.
3. `app/js/i18n/openings/` — opening notes, fetched on the first move with the opening book.

Layers 2 and 3 arrive through `i18n.extend(locale, …)`, filed under the language they are written
in. `t()`'s last fallback is the key itself, which is a documented contract some callers rely on.

**Locale authority: remembered → the host's `locale` dep → the browser.** The engine owns the
visible language door (🌐 on its bar) and this game follows it — so when a language was *chosen*,
the game tells the engine, once, after `localeReady()`. Without that a child who picked Portuguese
on an `en-US` device watched the board turn English 400 ms after it loaded.

## 🔴 Nothing may measure the machine

The hardest-won rule here, paid for three times in two days once CI started running elsewhere:

- **Never read `navigator.language` to decide behaviour.** It is the same fault ADR-0139 §4 named
  for `location.search`: the device answers, not the host.
- **Never locate an element by the words in it.** Use `#splash-play`, `[data-view="2.5d"]`,
  `[data-field="board-theme"]`. A gate that measures pixels must not fail because a runner is
  English. Positional ids (`hud-opt-0`) are no better — that order has already changed once.
- Browser tests pass `locale: 'pt'` explicitly; `tests/starting-locale.browser.test.ts` has
  `deviceSpeaks(tag)` to reproduce a runner. ⚠️ Vitest's browser provider **ignores** `context.locale`
  (measured twice); raw Playwright honours it, which is why the gates pin it and the tests redefine
  the property instead.

A green run on this machine proves nothing about a runner. Mutate the fix and watch the test go red
before believing it.

## Deployment

`npm run build:pages` reads `INCL_BASE` from `wrangler.toml` and empties `dist/` first (without
that, the game is published twice). Cloudflare Pages serves `game-chess-cfo.pages.dev` — note the
`-cfo`; the `.pages.dev` namespace is global and the plain name belongs to someone else.

**The pretty URL is not configured in this repository.** `o-inclusionista.jrocha.dev.br/game-chess`
is served by a Router Worker that lives in `game-platformer/cloudflare/router-worker/`, and a game
appears there only when its slug is in that Worker's `GAMES` map and has two routes (`/<slug>` and
`/<slug>/*` — the first does not match the second).

## Constraints worth knowing before you touch them

- **The Hartwig set is not public domain until 2027-01-01.** `docs/LICENSES.md` carries the
  arithmetic and the Dev's decision of 2026-10-04: repository private until then, the game reachable
  to invited guests only. Read that section before anything that widens distribution.
- **Opening names are not translated**, deliberately, and moves are written in the English SAN the
  move list prints — a note saying `Cf3` points at a move the screen does not show.
- Prose, identifiers, comments and documentation in this repository are **English**; the UI strings
  are not (they are the three catalogues).
- Plans live in `.claude/plans/`, and the Dev reads them as the record of what is still missing.
