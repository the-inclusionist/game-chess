import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE IS A LINKED DEPENDENCY ============================
// `file:../SP-the-inclusionist-tracer` makes npm symlink the engine into node_modules. Vite does
// not pre-bundle linked packages, which is exactly what this needs: the engine's `exports` map
// points at raw `.ts`, and those sources must go through the normal transform pipeline.
// `exclude` states that rather than relying on it happening. Proved in docs/spike-1.
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
