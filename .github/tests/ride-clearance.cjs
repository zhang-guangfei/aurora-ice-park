'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

const ref = process.env.SOURCE_REF || 'HEAD';
const file = path => execFileSync('git', ['show', ref + ':' + path], { encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 });
const world = vm.createContext({ console });
for (const path of ['vendor/three.min.js', 'src/materials.js', 'src/rides.js']) {
  vm.runInContext(file(path), world, { filename: path });
}
const T = world.THREE;
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const rides = world.buildRides(T, { snow: material, metal: () => material, ice: () => material, glow: () => material });
rides.group.updateMatrixWorld(true);

function trianglesOf(root) {
  const items = [];
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    const vertices = Array.from({ length: positions.count }, (_, i) =>
      new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
    const indices = mesh.geometry.index?.array || vertices.map((_, i) => i);
    items.push({ vertices, indices, bounds: new T.Box3().setFromPoints(vertices) });
  });
  return items;
}

const supports = trianglesOf(rides.group.getObjectByName('Slide supports and access tower'));
assert.ok(supports.length > 100);
const slice = new T.Box3(), broad = new T.Box3(), triangle = new T.Triangle();
const samples = Math.ceil(rides.slideLength / 0.14);
for (let i = 0; i <= samples; i++) {
  const u = i / samples, p = rides.slidePoint(u);
  const direction = rides.slidePoint(Math.min(1, u + 0.0005)).sub(rides.slidePoint(Math.max(0, u - 0.0005)));
  const length = Math.hypot(direction.x, direction.z), tx = direction.x / length, tz = direction.z / length;
  const width = 2.03 + 0.38 * Math.max(0, (u - 0.82) / 0.18) + 0.15;
  const depth = 0.12, height = 2.35;
  slice.min.set(-width, 0.055, -depth); slice.max.set(width, height, depth);
  const extentX = Math.abs(tz) * width + Math.abs(tx) * depth;
  const extentZ = Math.abs(tx) * width + Math.abs(tz) * depth;
  broad.min.set(p.x - extentX, p.y + 0.055, p.z - extentZ);
  broad.max.set(p.x + extentX, p.y + height, p.z + extentZ);
  function toSlice(v, out) {
    const x = v.x - p.x, z = v.z - p.z;
    return out.set(-tz * x + tx * z, v.y - p.y, tx * x + tz * z);
  }
  for (const mesh of supports) {
    if (!broad.intersectsBox(mesh.bounds)) continue;
    for (let j = 0; j < mesh.indices.length; j += 3) {
      toSlice(mesh.vertices[mesh.indices[j]], triangle.a);
      toSlice(mesh.vertices[mesh.indices[j + 1]], triangle.b);
      toSlice(mesh.vertices[mesh.indices[j + 2]], triangle.c);
      assert.ok(!slice.intersectsTriangle(triangle), 'A structural triangle enters the slide at ' + (u * rides.slideLength).toFixed(2) + ' m');
    }
  }
}
console.log('Full slide width and 2.35 m headroom clear in ' + (samples + 1) + ' overlapping sections over ' + rides.slideLength.toFixed(2) + ' m.');

const wheel = rides.group.children[0];
const landmarks = [new T.Vector3(0, 19, -45), new T.Vector3(-1, 7, 10)];
const ray = new T.Raycaster();
let clear = 0;
for (let i = 0; i < 16; i++) {
  rides.update(rides.wheelPeriod * i / 16);
  rides.group.updateMatrixWorld(true);
  const eye = rides.wheelSeat(0).add(rides.panoramaOffset);
  for (const target of landmarks) {
    const direction = target.clone().sub(eye);
    ray.near = 0.065; ray.far = direction.length() - 0.2;
    ray.set(eye, direction.normalize());
    if (!ray.intersectObject(wheel, true).length) clear++;
  }
}
assert.equal(clear, 32, 'The wheel frame blocks the exterior view towards a landmark.');
console.log('Unobstructed lines of sight to the palace and plaza at all 16 sampled exterior camera positions.');
