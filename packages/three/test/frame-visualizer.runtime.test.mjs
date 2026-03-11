import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FrameVisualizer } from '../dist/FrameVisualizer.js';

test('frame visualizer orients the ring normal with the frame Z axis', () => {
  const scene = new THREE.Scene();
  const visualizer = new FrameVisualizer(scene);
  const orientation = {
    m: [
      0, 0, 1,
      0, 1, 0,
      -1, 0, 0
    ]
  };
  const group = visualizer.addFrame({
    id: 'frame-test',
    name: 'frame-test',
    position: { x: 0, y: 0, z: 0 },
    orientation,
    isPrimary: true,
    visible: true
  });

  let ring = null;
  group.traverse((child) => {
    if (child.userData?.frameAccentRole === 'ring') {
      ring = child;
    }
  });
  assert.ok(ring, 'expected a ring child');

  const ringNormal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(ring.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  const expectedZAxis = new THREE.Vector3(
    orientation.m[6],
    orientation.m[7],
    orientation.m[8]
  ).normalize();

  assert.ok(ringNormal.distanceTo(expectedZAxis) < 1e-6);
});

test('frame visualizer keeps x y z arrows orthogonal', () => {
  const scene = new THREE.Scene();
  const visualizer = new FrameVisualizer(scene);
  const group = visualizer.addFrame({
    id: 'frame-axes',
    name: 'frame-axes',
    position: { x: 0, y: 0, z: 0 },
    orientation: {
      m: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ]
    },
    isPrimary: true,
    visible: true
  });

  const arrows = group.children.filter((child) => child instanceof THREE.ArrowHelper);
  assert.equal(arrows.length, 3, 'expected x/y/z arrows');

  const directions = arrows.map((arrow) =>
    new THREE.Vector3(0, 1, 0)
      .applyQuaternion(arrow.getWorldQuaternion(new THREE.Quaternion()))
      .normalize()
  );

  assert.ok(Math.abs(directions[0].dot(directions[1])) < 1e-6);
  assert.ok(Math.abs(directions[0].dot(directions[2])) < 1e-6);
  assert.ok(Math.abs(directions[1].dot(directions[2])) < 1e-6);
});
