import { defineConfig } from 'vite';
export default defineConfig({
  root: import.meta.dirname,
  build: { outDir: '../../dist-three-probe', emptyOutDir: true, target: 'es2022' },
});
