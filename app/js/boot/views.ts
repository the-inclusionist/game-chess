// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/views — the three renderers, as chunks nobody parses until somebody picks one.
//
// ========================= WHY A REGISTRY AND NOT THREE IMPORTS =========================
// Each view was reached by its own HTML entry importing its own module: `index.html` pulled Zdog,
// `2d.html` pulled nothing, `3d.html` pulled Three.js. That is right for three pages and wrong for
// a cartridge — inside a platform a second HTML entry is a second URL, not a second bundle, and a
// host cannot be asked to know what a Zdog view is in order to show a chess game.
//
// ⚠️ SO THE CARTRIDGE OWNS THE LIST, and the reasoning recorded beside those entries survives
// intact: the flat board was split out so it would not carry a renderer it never draws. A dynamic
// `import()` buys exactly the same saving — Rollup emits each factory into its own chunk, and the
// Three.js view in particular becomes something nobody downloads the cost of parsing unless they
// choose it. That is BETTER than the three pages, where `3d.html` loads 743.9 KB eagerly.
//
// ADR-0139 records this decision for this game by name.
import type { ViewFactory } from './view.ts';
import type { ViewKind } from '../ui/hud.ts';

/**
 * Kind to renderer, resolved on demand.
 *
 * ⚠️ THE `import()` CALLS ARE WRITTEN OUT ONE BY ONE, not built from a template string. A bundler
 * can only split what it can see: `import('./view-' + name + '.ts')` defeats static analysis and
 * either fails or drags all three into one chunk, which is the opposite of the point.
 */
export const VIEWS: Readonly<Record<ViewKind, () => Promise<ViewFactory>>> = {
  '2d': async () => (await import('./view-flat.ts')).createFlatView,
  '2.5d': async () => (await import('./view-zdog.ts')).createZdogView,
  '3d': async () => (await import('./view-solid.ts')).createSolidView,
};

/** The kinds this cartridge can draw, in the order a person reads them. */
export const VIEW_KINDS: readonly ViewKind[] = ['2d', '2.5d', '3d'];
