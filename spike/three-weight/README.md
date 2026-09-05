# three-weight

⚠️ `three` is NOT a dependency of this repository. To run this probe:

```bash
npm install three --no-save
npx vite build --config spike/three-weight/vite.config.ts
```

Measured 2026-09-05: **508.75 KB raw, 125.97 KB gzip** — Three.js alone, tree-shaken, with a
renderer, a perspective camera, 64 board meshes, the four primitive geometries `PIECE_SPECS`
already speaks in, two lights and soft shadows. Kept for the evidence, not for the code.
