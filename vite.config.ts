import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';

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
export default defineConfig({
  root: 'app',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    // ========================= TWO ENTRIES, ONE REPOSITORY =========================
    // Measured, in `spike/2d-weight/`: a flat board needs 104 KB and the Zdog one needs 146. As a
    // MODE the flat board would have carried the renderer it never draws with. As a second entry
    // it carries what it uses, and the shared half — rules, search, declaration, HUD, i18n — is
    // one chunk both pages fetch.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./app/index.html', import.meta.url)),
        flat: fileURLToPath(new URL('./app/2d.html', import.meta.url)),
        solid: fileURLToPath(new URL('./app/3d.html', import.meta.url)),
      },
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
});
