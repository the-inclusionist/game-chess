import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';

// ========================== THE ENGINE COMES FROM THE REGISTRY ==========================
// ⚠️ THIS PARAGRAPH DESCRIBED A SYMLINK THAT NO LONGER EXISTS. It read: "`file:../SP-the-
// inclusionist-tracer` makes npm symlink the engine into node_modules… the engine's `exports` map
// points at raw `.ts`, and those sources must go through the normal transform pipeline". Both
// halves are now false. The dependency is `@the-inclusionist/engine@^8.0.0` from npm, and the
// published `exports` map points at built `dist-pkg/*.js` — there is no TypeScript to transform.
//
// ⚠️ `exclude` IS KEPT, AND KEPT WITHOUT A MEASUREMENT TO JUSTIFY IT — which is the honest state
// and is why it is written down. Its original reason is gone with the symlink; whether pre-bundling
// the published package would now be better, worse or identical has not been tested. What argues
// against finding out casually is the record: this repository has already paid for browser-suite
// intermittency caused by dependency discovery mid-run (see `include: ['zdog']` below), so changing
// how the engine is served is a change that needs its own run and its own evidence, not a tidy-up.
//
// One consequence worth knowing: `dist/` carries a 26.8 MB WASM asset, the ONNX runtime behind the
// engine's neural voice. It is reached through a dynamic import gated on an engine selection that
// defaults to the browser's own speech, so nothing fetches it at boot. It is deploy weight, not
// load weight. See docs/spike-1-file-dependency.md.
/*
 * ========================= THE SECOND TARGET, AND WHY IT EXISTS =========================
 * ADR-0140 §1: one source tree, two builds, switched by mode.
 *
 *   · APP (default) — `app/index.html` and its two siblings, engine BUNDLED, PWA on. This
 *     repository's own artifact: a development, test, audit and demonstration route.
 *   · LIB (`--mode lib`) — `src/index.ts`, the cartridge. Engine and Zdog EXTERNAL. No HTML, no
 *     service worker, nothing that assumes it owns a page.
 *
 * ⚠️ ONE INSTALLED ENGINE STILL TRAVELS N TIMES IF N BUNDLES INLINE IT, which is the leak this
 * target closes and `peerDependencies` does not. Declaring a peer decides what is INSTALLED;
 * `external` decides what is EMITTED. The cartridge writes a literal
 * `import … from '@the-inclusionist/engine'` and leaves resolution to whoever consumes it, so the
 * platform's single Rollup pass can emit the engine once into a chunk every game shares.
 *
 * 📌 WHAT IS EXTERNAL AND WHAT IS NOT, and the line is the one the record draws: the engine and
 * the SHARED render libraries. Zdog is shared — whackwhack draws with it too. Three is this
 * game's alone, with no sharing to win, so it stays inside the bundle; the architecture
 * document's answer for its 743.9 KB is the 3D view becoming a lazily imported chunk, which is a
 * different mechanism for a different problem. `chess.js` is this game's own rules.
 */
const LIB_BUILD = {
  outDir: '../dist-lib',
  emptyOutDir: true,
  target: 'es2022',
  lib: {
    entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    formats: ['es' as const],
    fileName: 'index',
  },
  rollupOptions: {
    external: [/^@the-inclusionist\/engine/, 'zdog'],
  },
};

export default defineConfig(({ mode }) => {
  // The one switch. Everything below reads it rather than being written twice.
  const lib = mode === 'lib';
  return {
  root: 'app',
  /*
   * ⚠️ NO `public/` IN THE CARTRIDGE, AND THIS WAS MEASURED AS A DEFECT RATHER THAN FORESEEN. The
   * first lib build came out at 7.6 MB, of which 7.1 MB was `vendor/` — Vite copies `publicDir`
   * into every build, so the cartridge was carrying the 7.3 MB Stockfish and the font files.
   *
   * ADR-0117's confirmation gate names exactly that: «A CARTRIDGE DECLARES NO DELIVERY — no font
   * file, no voice, no runtime in a game's own package or `dist`». The platform loads those once
   * for every cartridge, which is the whole arithmetic of one origin; a cartridge shipping its own
   * copy is the duplication the record exists to prevent, at 7 MB a game.
   *
   * The app build keeps them, because there the game IS the page and the opponent has to come from
   * somewhere — see the precache gate.
   */
  publicDir: lib ? false : undefined,
  /*
   * ========================= THE STANDALONE BUILD IS A PWA =========================
   * ADR-0140: a game is a standalone PWA *and* a cartridge, from one source, and five of the six
   * games were not PWAs. This is the app half of that record — and §3 of it draws the line this
   * config has to respect: the standalone artifact is a DEVELOPMENT, TEST, AUDIT AND DEMONSTRATION
   * route, never a delivery route to children. A game deployed to children is the platform's job,
   * because Cache Storage partitions by origin and a child's accessibility profile has to follow
   * her between games.
   *
   * ⚠️ THE OPPONENT IS PRECACHED, AND THE BUDGET OBJECTION TO IT WAS MINE AND WAS WRONG. I read
   * ADR-0116/0117 as putting a byte budget in the way of 7 MB of Stockfish. They do not: what those
   * records price is 244 MB of voice models across N origins, and ~32 MB of vendored runtime across
   * three hundred deploys. Neither is a sentence about one game's demo build. And the Dev settled
   * the substance in one line — «sem IA não há nem modo professor»: an opponent is not an extra
   * here, it is what makes the teaching mode exist.
   *
   * ⚠️ `maximumFileSizeToCacheInBytes` IS THE LINE THAT DECIDES WHETHER ANY OF THIS IS TRUE.
   * Workbox defaults to 2 MiB and SILENTLY DROPS anything larger, so the 7.3 MB `.wasm` would be
   * excluded from the precache without a warning — leaving a service worker that promises offline
   * and an opponent that only exists online. That is the failure ADR-0116 §2 names from the other
   * side: «precached at install, never fetched lazily at first use». The test asserts the file is
   * in the manifest, because a number in a config is not evidence.
   */
  plugins: lib ? [] : [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // `wasm` is not in Workbox's default list, and it is the whole opponent.
        globPatterns: ['**/*.{html,js,css,svg,wasm,woff2,txt}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Xadrez de Hartwig',
        short_name: 'Xadrez',
        description: 'Xadrez acessível em pixel art, com aulas, para aprender a jogar e a ler o tabuleiro.',
        /*
         * ⚠️ `pt-BR` AND A RELATIVE SCOPE, and both are corrections of a mistake already recorded:
         * ADR-0140 notes the platformer's manifest claiming `scope: "/"` — the whole origin, for one
         * game — and `lang: "en"` for a product delivered in Portuguese. Repeating either here would
         * be copying a defect the record was written to stop.
         */
        lang: 'pt-BR',
        dir: 'ltr',
        scope: './',
        start_url: './',
        display: 'standalone',
        background_color: '#05070f',
        theme_color: '#05070f',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  build: lib ? LIB_BUILD : {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    /*
     * ========================= ONE ENTRY, THREE VIEWS =========================
     * ⚠️ THIS WAS THREE ENTRIES, AND THE MEASUREMENT THAT JUSTIFIED THEM STILL STANDS — it is the
     * mechanism that changed. From `spike/2d-weight/`: a flat board needs 104 KB and the Zdog one
     * 146, so a single bundle with a switch would have made every player pay for all three. As
     * separate PAGES each carried only what it drew.
     *
     * Dynamic `import()` buys the same saving without the pages: measured on this build,
     * `view-flat` is 0.8 KB, `view-zdog` 38.2 KB and `view-solid` 540.7 KB, each a chunk nobody
     * parses unless they pick it. That is BETTER than three entries, where `3d.html` loaded Three.js
     * eagerly for anyone who opened it.
     *
     * And the reason it had to change is not weight at all: inside a platform a second HTML entry is
     * a second URL, not a second bundle (ADR-0139, which records this for this game by name).
     */
    rollupOptions: {
      input: { main: fileURLToPath(new URL('./app/index.html', import.meta.url)) },
    },
  },
  optimizeDeps: {
    exclude: ['@the-inclusionist/engine'],
    // Zdog is CommonJS, so it must be pre-bundled. Naming it here stops Vitest's browser mode
    // from discovering it mid-run and reloading the page under a suite that is already going.
    include: ['zdog'],
  },

  test: {
    projects: [
      {
        // Pure logic: rules, engine search, projection maths, the declaration, i18n catalogues.
        // Everything here must run without a DOM — which is also the pressure that keeps those
        // modules free of the renderer.
        test: {
          name: 'node',
          root: import.meta.dirname,
          environment: 'node',
          include: ['tests/**/*.node.test.{js,ts}'],
          /*
           * ================= ⚠️ THE EXHAUSTIVE TESTS DO NOT FIT A UNIT TEST'S BUDGET =================
           * Vitest defaults to five seconds, which assumes a test is a millisecond thing. Several
           * here are not, deliberately: they check a SHIPPED ARTEFACT against the rules, in full,
           * because a generated file is exactly the kind of thing that goes wrong quietly.
           *
           * Measured on this machine, node project alone:
           *
           *   openings — every one of the 2,833 lines is playable        4426 ms
           *   puzzle-lesson — every step's move is legal where it is     3175 ms
           *   teach-i18n — every sentence resolves in three languages     557 ms
           *   endgame — the square rule raced over ~12,000 positions      433 ms
           *
           * The first was inside 12% of the default. It failed whenever the browser project's
           * chromium ran beside it and took the CPU — reported as `Test timed out`, in a test
           * nobody had touched, on a commit that had nothing to do with it.
           *
           * ⚠️ RAISED RATHER THAN TRIMMED, and the numbers are written down so the next reader can
           * tell drift from noise. Making these tests cheaper means checking less of the data,
           * which is the one thing they exist to do.
           */
          testTimeout: 20_000,
        },
      },
      {
        // Anything that needs a real canvas or a real focus ring: the Zdog surface, the DOM grid
        // mirror, keyboard navigation, aria-live announcements.
        test: {
          name: 'browser',
          root: import.meta.dirname,
          include: ['tests/**/*.browser.test.{js,ts}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
  };
});
