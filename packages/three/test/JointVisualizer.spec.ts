import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MbsJointType } from '@cadtool-online/geo';

import { JointVisualizer } from '../src/JointVisualizer';

describe('JointVisualizer', () => {
    it('creates joints with mapped metadata, position, quaternion, and selection state', () => {
        const scene = new THREE.Scene();
        const visualizer = new JointVisualizer(scene, { jointSize: 6, showAxis: true });

        const group = visualizer.addJoint({
            id: 'joint-1',
            name: 'Prismatic Joint',
            type: MbsJointType.Prismatic,
            position: { x: 4, y: 5, z: 6 },
            axis: { x: 0, y: 1, z: 0 },
            selected: true
        });

        expect(scene.children).toContain(group);
        expect(visualizer.getAllJointIds()).toEqual(['joint-1']);
        expect(group.name).toBe('joint_joint-1');
        expect(group.position.toArray()).toEqual([4, 5, 6]);
        expect(group.userData).toMatchObject({
            jointId: 'joint-1',
            jointName: 'Prismatic Joint',
            jointType: MbsJointType.Prismatic,
            jointSelected: true
        });
        expect(group.scale.x).toBeCloseTo(1.12);

        const rotatedAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
        expect(rotatedAxis.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);

        visualizer.setJointVisible('joint-1', false);
        expect(group.visible).toBe(false);

        visualizer.setJointSelected('joint-1', false);
        expect(group.userData.jointSelected).toBe(false);
        expect(group.scale.x).toBeCloseTo(1);
    });

    it('replaces updated joints and filters visibility by type', () => {
        const scene = new THREE.Scene();
        const visualizer = new JointVisualizer(scene);

        const first = visualizer.addJoint({
            id: 'joint-2',
            name: 'Revolute',
            type: MbsJointType.Revolute,
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });

        visualizer.addJoint({
            id: 'joint-3',
            name: 'Fixed',
            type: MbsJointType.Fixed,
            position: { x: 1, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });

        visualizer.updateJoint({
            id: 'joint-2',
            name: 'Planar',
            type: MbsJointType.Planar,
            position: { x: 2, y: 3, z: 4 },
            axis: { x: 1, y: 0, z: 0 }
        });

        const updated = visualizer.getJoint('joint-2');
        expect(updated).toBeDefined();
        expect(updated).not.toBe(first);
        expect(updated?.position.toArray()).toEqual([2, 3, 4]);
        expect(updated?.userData.jointType).toBe(MbsJointType.Planar);

        visualizer.setJointTypeVisible(MbsJointType.Fixed, false);
        expect(visualizer.getJoint('joint-3')?.visible).toBe(false);
        expect(updated?.visible).toBe(true);

        visualizer.clear();
        expect(visualizer.getAllJointIds()).toEqual([]);
        expect(scene.children).toHaveLength(0);
    });
});
