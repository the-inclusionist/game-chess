// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT THIS FILE IS FOR =========================
// The Dev, 2026-10-04: "no tabuleiro 3D nem e possivel jogar com ele, as pecas parecem estatuas
// numa maquete, sem qualquer possibilidade de interacao". Every mark in the solid view was drawn
// UNDERNEATH the board. Clicking had always worked; seeing the result of it never had.
//
// ⚠️ IT WAS NOT A FAILURE OF ARITHMETIC, which is why nothing caught it. The renderer was asked to
// draw a mark and drew one, on the square it was told, in the right shape and the right colour.
// What nothing asserted was whether the result could be SEEN — and without a camera there is
// exactly one way to ask that: WHICH SIDE OF THE BOARD the mark is on.
import { describe, expect, it } from 'vitest';
import { createScene3d } from '../app/js/render3d/scene.ts';
import { squareIndex } from '../app/js/render/board-geometry.ts';
import { TILE } from '../app/js/render/resolution.ts';
import type { Marker } from '../app/js/render/board-geometry.ts';
import type { Square } from '../app/js/chess/types.ts';

const index = (x: number, y: number): number => squareIndex({ x, y } as Square);

describe('[3D marks] ⚠️ on the side of the board the player is looking at', () => {
  /*
   * ========================= THE ARITHMETIC THAT WENT WRONG =========================
   * Each square is a `BoxGeometry(TILE, 1, TILE)` centred at y = 0.5, so it occupies y from 0 to
   * 1. This scene keeps the table's convention and ⚠️ Y POINTS DOWN, so the face a player looks at
   * is the one at y = 0 and the face at y = 1 is the UNDERSIDE. The marks were at y = +1.05.
   *
   * One wrong word in a comment — "the board's top face, which is at y = 1" — and every mark in
   * the view went under the table. The proof it was wrong was already in the codebase: the hint
   * arrows in `boot/view-solid.ts` sit at y = -0.15 and have always been visible.
   */
  const stage = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    document.body.appendChild(canvas);
    return canvas;
  };

  /** Every flat mark mesh the scene is holding, with the height it was laid at. */
  const laid = (s: ReturnType<typeof createScene3d>): { y: number }[] => {
    const out: { y: number }[] = [];
    s.scene.traverse((node) => {
      const mesh = node as { isMesh?: boolean; rotation?: { x: number }; position?: { y: number } };
      // The marks are the flat meshes laid face-up; the board, the plinth and the pieces are not.
      if (mesh.isMesh && Math.abs((mesh.rotation?.x ?? 0) + Math.PI / 2) < 1e-6) {
        out.push({ y: mesh.position!.y });
      }
    });
    return out;
  };

  const KINDS: Marker[] = [
    'cursor', 'selected', 'move', 'capture', 'check', 'lesson', 'lessonRight', 'lessonWrong',
  ];

  it('⚠️ lays every kind of mark ABOVE the board, not under it', () => {
    const scene = createScene3d({ canvas: stage() });

    for (const kind of KINDS) {
      scene.setMarkers(new Map([[index(4, 4), kind]]));
      const marks = laid(scene);
      expect(marks.length, `${kind} draws something`).toBeGreaterThan(0);
      for (const mark of marks) {
        /*
         * ⚠️ STRICTLY LESS THAN ZERO. The board's visible face is y = 0 and up is NEGATIVE here,
         * so this is the whole assertion: a mark at y >= 0 is inside the board or below it, and a
         * player sees nothing. The old value was +1.05.
         */
        expect(`${kind} at y=${mark.y}, above the face? ${mark.y < 0}`)
          .toBe(`${kind} at y=${mark.y}, above the face? true`);
        // And resting on it rather than floating off towards the camera.
        expect(mark.y, `${kind} hovers`).toBeGreaterThan(-TILE);
      }
    }
    scene.destroy();
  });
});
