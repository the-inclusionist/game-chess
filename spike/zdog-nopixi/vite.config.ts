// SPDX-License-Identifier: AGPL-3.0-or-later
// Deliberately a SEPARATE build, not a second input of the real one: two inputs in one build share
// chunks, and a shared chunk is exactly what this probe must not have. The question is what a
// 2D-only game weighs ALONE.
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  build: { outDir: '../../dist-zdog-probe', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: { exclude: ['@the-inclusionist/engine'] },
});
