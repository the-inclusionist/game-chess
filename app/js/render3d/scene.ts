// SPDX-License-Identifier: AGPL-3.0-or-later
// render3d/scene — the WebGL stage: renderer, camera, lights, board.
//
// ========================= ⚠️ Y POINTS DOWN HERE =========================
// The whole scene keeps Zdog's convention — a piece occupies NEGATIVE y and the board plane is
// y = 0 — so that `render/pieces/geometry.ts` can be read verbatim by both renderers. The camera
// is simply told that up is (0, −1, 0). See `render3d/pieces.ts` for why this beats mirroring.
//
// ========================= WHY THIS IS NOT THE ENGINE'S 320×180 =========================
// The Zdog view renders into the engine's fixed logical resolution and is upscaled by whole
// pixels, because a pseudo-3D drawing of flat shapes is a PIXEL image and a fractional upscale
// turns its outlines to mush. A WebGL scene is not: it is resolution-independent by construction,
// and rendering it at 320×180 to blow it up would throw away the one thing this view is for.
//
// So this view renders at the device's own resolution, capped at 2× so a retina laptop does not
// pay for four times the pixels to draw thirty-two matte solids.

import * as THREE from 'three';
import { TILE } from '../render/resolution.ts';
import type { Marker } from '../render/board-geometry.ts';
import {
  MARKER_CAPTURE, MARKER_CHECK, MARKER_CURSOR, MARKER_LESSON, MARKER_LESSON_HALO,
  MARKER_LESSON_RIGHT, MARKER_LESSON_WRONG, MARKER_MOVE, MARKER_SELECTED,
} from '../render/palette.ts';
import { squareCenter } from '../render/board-geometry.ts';
import type { Square } from '../chess/types.ts';

/** Eight squares plus a border, in Zdog units. */
export const BOARD_SPAN = TILE * 8;

/** Above 2 the pixels stop being visible and start being a battery bill. */
const MAX_PIXEL_RATIO = 2;

export interface Scene3dOptions {
  readonly canvas: HTMLCanvasElement;
  /** Looking from Black's side rather than White's. */
  readonly flipped?: boolean;
  /** Flat, unlit rendering for the high-contrast palettes. See `render3d/pieces.ts`. */
  readonly unlit?: boolean;
  readonly light?: string;
  readonly dark?: string;
  /** The plinth the eight-by-eight sits on, which is the theme's silhouette ink. */
  readonly rim?: string;
}

export interface Scene3d {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Where the pieces go. Cleared and rebuilt on a move, never per frame. */
  readonly pieces: THREE.Group;
  render(): void;
  resize(width: number, height: number): void;
  /** Turns the camera around the board. `yaw` in radians, `pitch` clamped above the board. */
  orbit(yaw: number, pitch: number): void;
  /**
   * Moves the camera along its own line of sight, in wheel notches: positive is further away.
   *
   * ⚠️ THE DISTANCE, NOT THE FIELD OF VIEW. Narrowing the lens would flatten the board's
   * perspective as it magnified it, which is the one thing this view exists to show.
   */
  dolly(notches: number): void;
  look(): { yaw: number; pitch: number };
  /**
   * The marks the game wants on the board: selection, legal moves, check, the cursor, a lesson.
   *
   * ⚠️ THIS VIEW HAD NONE OF THIS UNTIL NOW, and it was a gap rather than a decision — recorded in
   * `boot/view-solid.ts` and in the plan. A player here could not see which square was selected or
   * where the piece they were holding could go; those three facts reached them only through the
   * screen reader's labels, which is to say only if they were using one.
   */
  setMarkers(markers: ReadonlyMap<number, Marker>): void;
  /** The square under a point in canvas coordinates, or null. */
  pick(x: number, y: number, width: number, height: number): Square | null;
  /** Repaints the board. The pieces are rebuilt by their own layer, not here. */
  setBoard(light: string, dark: string, rim: string, unlit: boolean): void;
  destroy(): void;
}

/** The camera's distance and its limits, in Zdog units. */
const RADIUS = BOARD_SPAN * 1.35;
const PITCH_MIN = 0.20;
const PITCH_MAX = 1.35;

/*
 * ========================= HOW FAR THE WHEEL MAY GO =========================
 * Both ends are chosen against what the board still IS at that distance, not against a round
 * number. Nearer than 0.45 the near rank leaves the frame and the player is looking at four
 * squares with no way to know which four; further than 2.2 a piece is a few pixels tall and the
 * six silhouettes stop being distinguishable, which is the whole design.
 *
 * The step is a FACTOR, not an amount: a notch has to feel the same close up and far away, and a
 * fixed number of units is a nudge at one end and a jump at the other.
 */
const ZOOM_NEAREST = 0.45;
const ZOOM_FARTHEST = 2.2;
const ZOOM_STEP = 1.1;

export function createScene3d(options: Scene3dOptions): Scene3d {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const camera = new THREE.PerspectiveCamera(38, 1, 1, BOARD_SPAN * 8);
  // ⚠️ UP IS DOWN. The scene keeps the table's convention, so the camera is told so once, here,
  // and nothing else in this view ever has to think about it again.
  camera.up.set(0, -1, 0);

  let yaw = options.flipped ? Math.PI : 0;
  let pitch = 0.85;
  let radius = RADIUS;

  const place = (): void => {
    const horizontal = Math.cos(pitch) * radius;
    camera.position.set(
      Math.sin(yaw) * horizontal,
      -Math.sin(pitch) * radius,
      Math.cos(yaw) * horizontal,
    );
    camera.lookAt(0, 0, 0);
  };
  place();

  /*
   * ========================= THREE LIGHTS, AND WHY NOT ONE =========================
   * A single directional light leaves every face turned away from it in pure black, which on a
   * board is half the pieces on half the squares. The ambient is what keeps those faces readable;
   * the second directional, from behind and weaker, is what keeps a piece's silhouette from
   * merging with the square behind it when the camera is turned round.
   *
   * ⚠️ NONE OF THIS APPLIES IN HIGH CONTRAST, where the materials are unlit on purpose — see
   * `render3d/pieces.ts`. The lights stay in the scene and simply have nothing to do.
   */
  const ambient = new THREE.AmbientLight(0xffffff, 1.7);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-BOARD_SPAN, -BOARD_SPAN * 1.4, BOARD_SPAN * 0.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(BOARD_SPAN, -BOARD_SPAN * 0.8, -BOARD_SPAN);
  scene.add(ambient, key, fill);

  const board = new THREE.Group();
  const pieces = new THREE.Group();
  scene.add(board, pieces);

  /** One flat quad per square, plus a plinth so the board is an object and not a decal. */
  const squares: THREE.Mesh[] = [];
  const buildBoard = (light: string, dark: string, rim: string, unlit: boolean): void => {
    for (const mesh of squares) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      board.remove(mesh);
    }
    squares.length = 0;

    const make = (colour: string): THREE.Material => (unlit
      ? new THREE.MeshBasicMaterial({ color: colour })
      : new THREE.MeshLambertMaterial({ color: colour }));
    const lightMat = make(light);
    const darkMat = make(dark);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const square: Square = { x, y };
        const { x: cx, z: cz } = squareCenter(square, TILE);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(TILE, 1, TILE),
          (x + y) % 2 === 0 ? lightMat : darkMat,
        );
        // The board sits just BELOW y = 0 so a piece's base rests exactly on its face.
        mesh.position.set(cx, 0.5, cz);
        mesh.userData.square = square;
        board.add(mesh);
        squares.push(mesh);
      }
    }

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_SPAN + TILE * 0.5, 2, BOARD_SPAN + TILE * 0.5),
      make(rim),
    );
    plinth.position.set(0, 1.8, 0);
    board.add(plinth);
    squares.push(plinth);
  };
  buildBoard(options.light ?? '#f0d9b5', options.dark ?? '#9C7555',
    options.rim ?? '#17110a', options.unlit ?? false);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  /*
   * ========================= THE MARKS, IN THE SAME VOCABULARY THE OTHER BOARDS USE =========================
   * `render/board-geometry.ts` sets the rule and it is not this file's to reinvent: the marks that
   * co-occur in a turn are told apart by SHAPE, never by colour alone. A filled disc is a move, a
   * ring is a capture, both together is the selection — so a colour-blind player, or one on a
   * washed-out projector, reads the same board as everybody else.
   *
   * Built on demand and thrown away, the way the projected board's lesson marks are: a turn lights
   * a handful of squares, and sixty-four hidden meshes would be a standing cost in a scene that is
   * re-rendered every frame.
   */
  const marks = new THREE.Group();
  scene.add(marks);

  /** Just clear of the board's top face, which is at y = 1. Any less and they z-fight. */
  const MARK_Y = 1.05;

  const flatMaterial = (colour: string): THREE.Material => new THREE.MeshBasicMaterial({
    color: colour,
    // ⚠️ UNLIT AND DOUBLE-SIDED WHATEVER THE BOARD IS. A mark is a diagram drawn ON the position,
    // not an object in it: shading one would make "is that square lit?" depend on where the camera
    // happens to be standing.
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });

  const lay = (mesh: THREE.Mesh, cx: number, cz: number): THREE.Mesh => {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, MARK_Y, cz);
    marks.add(mesh);
    return mesh;
  };

  const disc = (cx: number, cz: number, r: number, colour: string): void => {
    lay(new THREE.Mesh(new THREE.CircleGeometry(r, 24), flatMaterial(colour)), cx, cz);
  };
  const ring = (cx: number, cz: number, r: number, colour: string): void => {
    lay(new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 24), flatMaterial(colour)), cx, cz);
  };
  const square = (cx: number, cz: number, side: number, colour: string): void => {
    lay(new THREE.Mesh(new THREE.PlaneGeometry(side, side), flatMaterial(colour)), cx, cz);
  };

  const LESSON_INK: Record<'lesson' | 'lessonRight' | 'lessonWrong', string> = {
    lesson: MARKER_LESSON, lessonRight: MARKER_LESSON_RIGHT, lessonWrong: MARKER_LESSON_WRONG,
  };

  function drawMark(kind: Marker, cx: number, cz: number): void {
    if (kind === 'lesson' || kind === 'lessonRight' || kind === 'lessonWrong') {
      /*
       * ⚠️ THE BLACK HALO IS WHAT SATISFIES 1.4.11 — measured in `render/palette.ts`, where no hue
       * clears 3:1 against every square this game draws. And `lessonWrong` is a RING while the
       * other two are filled, because blue and red measure 1.06:1 against each other: to a reader
       * going by lightness they are one mark unless the shape differs.
       */
      square(cx, cz, TILE * 0.60, MARKER_LESSON_HALO);
      if (kind === 'lessonWrong') ring(cx, cz, TILE * 0.30, LESSON_INK[kind]);
      else square(cx, cz, TILE * 0.52, LESSON_INK[kind]);
      return;
    }
    if (kind === 'move' || kind === 'selected') disc(cx, cz, TILE * 0.16, MARKER_MOVE);
    if (kind === 'capture') ring(cx, cz, TILE * 0.42, MARKER_CAPTURE);
    if (kind === 'selected') ring(cx, cz, TILE * 0.42, MARKER_SELECTED);
    if (kind === 'check') ring(cx, cz, TILE * 0.42, MARKER_CHECK);
    if (kind === 'cursor') ring(cx, cz, TILE * 0.46, MARKER_CURSOR);
  }

  return {
    scene,
    camera,
    pieces,

    render() {
      renderer.render(scene, camera);
    },

    setMarkers(wanted) {
      // Thrown away and rebuilt. Geometries and materials are disposed, because a scene rendered
      // every frame will not forgive a leak of one mesh per move.
      for (const child of [...marks.children]) {
        marks.remove(child);
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      }
      for (const [index, kind] of wanted) {
        if (index < 0 || index >= 64) continue;
        const { x: cx, z: cz } = squareCenter({ x: index % 8, y: Math.floor(index / 8) }, TILE);
        drawMark(kind, cx, cz);
      }
    },

    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    },

    orbit(byYaw, byPitch) {
      yaw += byYaw;
      // ⚠️ Clamped ABOVE the board, exactly as the Zdog camera is. Letting the pitch cross zero
      // puts the camera under the table, where the board is a thin line and every piece is
      // upside down — and getting back is not obvious to anybody.
      pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch + byPitch));
      place();
    },

    dolly(notches) {
      radius = Math.min(
        RADIUS * ZOOM_FARTHEST,
        Math.max(RADIUS * ZOOM_NEAREST, radius * ZOOM_STEP ** notches),
      );
      place();
    },

    look: () => ({ yaw, pitch }),

    pick(x, y, width, height) {
      pointer.set((x / width) * 2 - 1, -((y / height) * 2 - 1));
      raycaster.setFromCamera(pointer, camera);
      // ⚠️ THE SQUARES, not the pieces. A piece is picked THROUGH the square it stands on, which
      // is how a chess interface has to work anyway: you point at a square, and whatever is on it
      // is what you meant. Raycasting the pieces would make a tall king harder to select than a
      // pawn, and would make an empty square unclickable.
      for (const hit of raycaster.intersectObjects(board.children, false)) {
        const square = hit.object.userData.square as Square | undefined;
        if (square) return square;
      }
      return null;
    },

    setBoard(light, dark, rim, unlit) {
      buildBoard(light, dark, rim, unlit);
    },

    destroy() {
      renderer.dispose();
    },
  };
}
