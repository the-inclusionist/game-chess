// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHAT THIS FILE IS FOR =========================
// Two defects reported by the Dev on 2026-10-04, both about marks on the board, both of which the
// whole suite was green through:
//
//   1. "no tabuleiro 3D nem e possivel jogar com ele, as pecas parecem estatuas numa maquete, sem
//      qualquer possibilidade de interacao" — every mark in the solid view was drawn UNDERNEATH
//      the board. Clicking had always worked; seeing the result of it never had.
//
//   2. "quando o cursor esta sob uma casa marcada como casa possivel de andar, o cursor some" —
//      the cursor was an entry in a map that holds ONE KIND PER SQUARE, so it was silenced on
//      exactly the squares a player is walking towards.
//
// ⚠️ NEITHER WAS A FAILURE OF ARITHMETIC, which is why nothing caught them. Both renderers were
// asked to draw a mark and both drew one, in the place they were told, in the right shape and the
// right colour. What nothing asserted was whether the result could be SEEN. These tests ask that
// one question twice, in the only two terms available without a camera: which side of the board a
// mark is on, and whether two marks that must coexist both exist.
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard } from '../app/js/render/board.ts';
import { createZdogStage, type ZdogStage } from '../app/js/render/zdog-stage.ts';
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

  it('⚠️ keeps the cursor when the square is already a legal move', () => {
    /*
     * The Dev's exact report. `move` and `cursor` on ONE square have to produce TWO marks — a dot
     * saying "you may go here" and a ring saying "you are here". While the cursor lived in the
     * marker map this was impossible by construction: one kind per square, and `move` won.
     */
    const scene = createScene3d({ canvas: stage() });
    const square = { x: 4, y: 4 } as Square;

    scene.setMarkers(new Map([[index(4, 4), 'move' as Marker]]), null);
    const moveOnly = laid(scene).length;

    scene.setMarkers(new Map([[index(4, 4), 'move' as Marker]]), square);
    const withCursor = laid(scene).length;

    expect(moveOnly, 'a legal move draws something').toBeGreaterThan(0);
    expect(withCursor, 'the cursor adds to it rather than replacing it')
      .toBeGreaterThan(moveOnly);
    scene.destroy();
  });

  it('keeps it on a capture too, where both marks are rings', () => {
    // The harder case: `capture` is itself a ring, so this is the one a "draw a ring" fix would
    // pass while still leaving the player unable to tell the two apart.
    const scene = createScene3d({ canvas: stage() });
    const square = { x: 2, y: 5 } as Square;

    scene.setMarkers(new Map([[index(2, 5), 'capture' as Marker]]), null);
    const captureOnly = laid(scene).length;
    scene.setMarkers(new Map([[index(2, 5), 'capture' as Marker]]), square);
    expect(laid(scene).length).toBeGreaterThan(captureOnly);

    scene.destroy();
  });
});

describe('[2.5D marks] the cursor has its own ring, and does not borrow the square\'s', () => {
  /*
   * ⚠️ WHY A RING OF ITS OWN RATHER THAN THE SQUARE'S OUTLINE. Each square in the projected board
   * owns exactly one dot and one outline. `move` wants the dot; `capture`, `selected` and `check`
   * all want the outline. A cursor that borrowed the outline would be silenced by any of those
   * three — the same defect as the marker map's, one layer further down.
   */
  let stage: ZdogStage | null = null;

  afterEach(() => {
    stage?.destroy();
    stage = null;
    document.body.replaceChildren();
  });

  const build = () => {
    stage = createZdogStage();
    return { stage, board: createBoard(stage.root) };
  };

  /*
   * ⚠️ TYPED STRUCTURALLY, NOT AS `Zdog.Rect`. The package ships a default export and no type
   * NAMESPACE, so `Zdog.Rect` is a value here and not a type — it compiles in the renderer only
   * because that file uses it to construct.
   */
  type Node = { children?: unknown[] };
  type Ring = { width?: number; translate: { x: number; z: number } };

  /** The cursor ring is the only shape in the graph 0.96 of a tile wide. */
  const cursorRings = (root: unknown): Ring[] => {
    const out: Ring[] = [];
    const walk = (node: Node): void => {
      for (const child of node.children ?? []) {
        const rect = child as Ring;
        if (typeof rect.width === 'number' && Math.abs(rect.width - TILE * 0.96) < 1e-6) {
          out.push(rect);
        }
        walk(child as Node);
      }
    };
    walk(root as Node);
    return out;
  };

  const dotsVisible = (root: unknown): number => {
    let n = 0;
    const walk = (node: Node): void => {
      for (const child of node.children ?? []) {
        const shape = child as { visible?: boolean; stroke?: number; width?: number };
        // A marker dot is a stroked Shape with no width, unlike every Rect in the graph.
        if (shape.visible && shape.width === undefined
          && Math.abs((shape.stroke ?? 0) - TILE * 0.32) < 1e-6) n += 1;
        walk(child as Node);
      }
    };
    walk(root as Node);
    return n;
  };

  it('⚠️ draws the move dot AND the cursor on the same square', () => {
    const { board } = build();
    const square = { x: 3, y: 3 } as Square;

    board.setMarkers(new Map([[index(3, 3), 'move' as Marker]]), null);
    expect(dotsVisible(board.anchor), 'the legal-move dot').toBe(1);
    expect(cursorRings(board.anchor).length, 'no cursor asked for').toBe(0);

    board.setMarkers(new Map([[index(3, 3), 'move' as Marker]]), square);
    expect(dotsVisible(board.anchor), 'the dot survives the cursor').toBe(1);
    expect(cursorRings(board.anchor).length, 'and the cursor is drawn too').toBe(1);
  });

  it('puts the cursor ring where it was asked for, not on the first square', () => {
    const { board } = build();
    // Not a restatement: a ring that is always drawn at a1 would pass the test above.
    board.setMarkers(new Map(), { x: 6, y: 1 } as Square);
    const [ring] = cursorRings(board.anchor);
    expect(ring, 'a ring to place').toBeDefined();

    board.setMarkers(new Map(), { x: 0, y: 7 } as Square);
    const [other] = cursorRings(board.anchor);
    expect(other.translate.x, 'x follows the square').not.toBe(ring.translate.x);
    expect(other.translate.z, 'z follows the square').not.toBe(ring.translate.z);
  });

  it('throws the previous ring away rather than stacking them', () => {
    const { board } = build();
    for (let i = 0; i < 5; i++) board.setMarkers(new Map(), { x: i, y: 2 } as Square);
    expect(cursorRings(board.anchor).length, 'one cursor, however many moves').toBe(1);
    board.setMarkers(new Map(), null);
    expect(cursorRings(board.anchor).length, 'and none when there is none').toBe(0);
  });
});
