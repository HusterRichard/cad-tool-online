import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FrameVisualizer } from '../dist/FrameVisualizer.js';

test('frame visualizer orients the ring normal with the frame Z axis', () => {
  const scene = new THREE.Scene();
  const visualizer = new FrameVisualizer(scene);
  const group = visualizer.addFrame({
    id: 'frame-test',
    name: 'frame-test',
    position: { x: 0, y: 0, z: 0 },
    orientation: {
      m: [
        0, 0, 1,
        0, 1, 0,
        -1, 0, 0
      ]
    },
    isPrimary: true,
    visible: true
  });

  const frameBody = group.children.find((child) => child instanceof THREE.Group);
  assert.ok(frameBody, 'expected a local frame body group');

  const ring = frameBody.children.find((child) => child.userData?.frameAccentRole === 'ring');
  assert.ok(ring, 'expected a ring child');

  const ringNormal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(frameBody.quaternion)
    .normalize();

  assert.ok(ringNormal.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);
});
