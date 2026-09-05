import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
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
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: {
    exclude: ['@pm-monte/inclusionist-engine'],
    // Zdog is CommonJS, so it must be pre-bundled. Naming it here stops Vitest's browser mode
    // from discovering it mid-run and reloading the page under a suite that is already going.
    include: ['zdog', 'pixi.js'],
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
