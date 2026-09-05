// SPDX-License-Identifier: AGPL-3.0-or-later
// spike/three-weight — what a Three.js chess renderer costs, tree-shaken, before believing anyone.
//
// A minimal but HONEST scene: the renderer, a perspective camera, orbit-less controls omitted, a
// board of 64 meshes, pieces built from the same primitive vocabulary `PIECE_SPECS` already uses
// (box, cylinder, cone, sphere), two lights, and shadows — because "3D real e detalhado" without
// lighting and occlusion is just Zdog with more bytes.
import {
  AmbientLight, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry,
  DirectionalLight, Group, Mesh, MeshLambertMaterial, PCFSoftShadowMap,
  PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';

const renderer = new WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(640, 360, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(38, 640 / 360, 1, 500);
camera.position.set(0, 90, 90);
camera.lookAt(0, 0, 0);

scene.add(new AmbientLight(0xffffff, 0.5));
const sun = new DirectionalLight(0xffffff, 0.9);
sun.position.set(40, 90, 30);
sun.castShadow = true;
scene.add(sun);

const light = new MeshLambertMaterial({ color: 0xffe08a });
const dark = new MeshLambertMaterial({ color: 0x3f2b78 });

const board = new Group();
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    const square = new Mesh(new BoxGeometry(16, 2, 16), (x + y) % 2 ? dark : light);
    square.position.set((x - 3.5) * 16, -1, (y - 3.5) * 16);
    square.receiveShadow = true;
    board.add(square);
  }
}
scene.add(board);

// One of each primitive the specs already speak in, so the tree-shaker keeps what a real set needs.
for (const geometry of [
  new BoxGeometry(9, 9, 9),
  new CylinderGeometry(4, 5, 10, 16),
  new ConeGeometry(5, 9, 16),
  new SphereGeometry(4, 16, 12),
]) {
  const mesh = new Mesh(geometry, light);
  mesh.castShadow = true;
  scene.add(mesh);
}

renderer.render(scene, camera);
