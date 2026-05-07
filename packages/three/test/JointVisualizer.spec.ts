import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MbsJointType } from '@cadtool-online/geo';

import { JointVisualizer } from '../src/JointVisualizer';

describe('JointVisualizer', () => {
    function collectLineColors(group: THREE.Group): number[] {
        const colors: number[] = [];
        group.traverse((child) => {
            const material = (child as THREE.Line).material;
            if (material instanceof THREE.LineBasicMaterial) {
                colors.push(material.color.getHex());
            }
        });
        return colors;
    }

    function hasJointRole(group: THREE.Group, role: string): boolean {
        let found = false;
        group.traverse((child) => {
            if (child.userData?.jointRole === role) {
                found = true;
            }
        });
        return found;
    }

    function findByJointRole<T extends THREE.Object3D>(
        group: THREE.Group,
        role: string
    ): T | undefined {
        let found: T | undefined;
        group.traverse((child) => {
            if (!found && child.userData?.jointRole === role) {
                found = child as T;
            }
        });
        return found;
    }

    function countByJointRole(group: THREE.Group, role: string): number {
        let count = 0;
        group.traverse((child) => {
            if (child.userData?.jointRole === role) {
                count += 1;
            }
        });
        return count;
    }

    function measureBounds(object: THREE.Object3D): {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        width: number;
        height: number;
    } {
        const box = new THREE.Box3().setFromObject(object);
        return {
            minX: box.min.x,
            maxX: box.max.x,
            minY: box.min.y,
            maxY: box.max.y,
            width: box.max.x - box.min.x,
            height: box.max.y - box.min.y
        };
    }

    function getLinePoints(object: THREE.Line | THREE.LineLoop): THREE.Vector3[] {
        const position = object.geometry.getAttribute('position');
        const points: THREE.Vector3[] = [];
        for (let index = 0; index < position.count; index += 1) {
            points.push(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
        }
        return points;
    }

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

    it('renders draft joints in white, created joints in light blue, and keeps screw distinct from cylindrical', () => {
        const scene = new THREE.Scene();
        const visualizer = new JointVisualizer(scene, { jointSize: 8, showAxis: true });

        const draft = visualizer.addJoint({
            id: '__draft_joint__',
            name: 'Draft Screw',
            type: MbsJointType.Cylindrical,
            connectorType: 'screw',
            displayState: 'draft',
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });
        const created = visualizer.addJoint({
            id: 'joint-4',
            name: 'Created Cylindrical',
            type: MbsJointType.Cylindrical,
            connectorType: 'cylindrical',
            displayState: 'created',
            position: { x: 1, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });

        expect(draft.userData).toMatchObject({
            jointConnectorType: 'screw',
            jointDisplayState: 'draft'
        });
        expect(created.userData).toMatchObject({
            jointConnectorType: 'cylindrical',
            jointDisplayState: 'created'
        });

        expect(hasJointRole(draft, 'helix')).toBe(true);
        expect(hasJointRole(created, 'helix')).toBe(false);
        expect(new Set(collectLineColors(draft))).toEqual(new Set([0xffffff]));
        expect(new Set(collectLineColors(created))).toEqual(new Set([0x74c9ff]));
    });

    it('renders fixed joints as a rotated lock body with dual shackle rails and a closed keyhole tail', () => {
        const scene = new THREE.Scene();
        const visualizer = new JointVisualizer(scene, { jointSize: 10, showAxis: false });

        const fixed = visualizer.addJoint({
            id: 'joint-fixed',
            name: 'Fixed',
            type: MbsJointType.Fixed,
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });

        const body = findByJointRole<THREE.Object3D>(fixed, 'body');
        const bodyOutline = findByJointRole<THREE.LineLoop>(fixed, 'body-outline');
        const outerShackle = findByJointRole<THREE.Line>(fixed, 'outer-shackle');
        const innerShackle = findByJointRole<THREE.Line>(fixed, 'inner-shackle');
        const keyholeHead = findByJointRole<THREE.LineLoop>(fixed, 'keyhole-head');
        const keyholeTail = findByJointRole<THREE.LineLoop>(fixed, 'keyhole-tail');

        expect(body, 'expected fixed joint body outline').toBeDefined();
        expect(bodyOutline, 'expected fixed joint body rectangle').toBeDefined();
        expect(outerShackle, 'expected outer shackle arc').toBeDefined();
        expect(innerShackle, 'expected inner shackle arc').toBeDefined();
        expect(keyholeHead, 'expected circular keyhole head').toBeDefined();
        expect(keyholeTail, 'expected tapered keyhole tail').toBeDefined();
        expect(hasJointRole(fixed, 'body-seam')).toBe(false);
        expect(countByJointRole(fixed, 'outer-shackle-leg')).toBe(2);
        expect(countByJointRole(fixed, 'inner-shackle-leg')).toBe(2);

        expect(Math.abs(keyholeHead?.position.x ?? 0)).toBeLessThan(0.3);
        expect(Math.abs(body?.rotation.z ?? 0)).toBeLessThan(0.18);

        const bodyBounds = measureBounds(body!);
        const bodyPoints = getLinePoints(bodyOutline!);
        const outerBounds = measureBounds(outerShackle!);
        const innerBounds = measureBounds(innerShackle!);
        const keyholeTailBounds = measureBounds(keyholeTail!);
        const keyholeTailPoints = getLinePoints(keyholeTail!);

        expect(Math.abs(bodyPoints[0]!.y - bodyPoints[1]!.y)).toBeLessThan(1e-6);
        expect(Math.abs(bodyPoints[2]!.y - bodyPoints[3]!.y)).toBeLessThan(1e-6);
        expect(bodyBounds.width).toBeGreaterThan(bodyBounds.height * 1.2);
        expect(outerBounds.width).toBeGreaterThan(bodyBounds.width * 0.58);
        expect(outerBounds.width).toBeLessThan(bodyBounds.width * 0.66);
        expect(innerBounds.width).toBeGreaterThan(bodyBounds.width * 0.4);
        expect(innerBounds.width).toBeLessThan(bodyBounds.width * 0.52);
        expect(outerBounds.maxY).toBeGreaterThan(bodyBounds.maxY + bodyBounds.height * 0.42);
        expect(keyholeTailBounds.minY).toBeGreaterThan(bodyBounds.minY + bodyBounds.height * 0.13);
        expect(keyholeTailPoints).toHaveLength(5);
        expect(keyholeTailPoints[2]!.y).toBeLessThan(keyholeTailPoints[1]!.y);
        expect(keyholeTailPoints[2]!.y).toBeLessThan(keyholeTailPoints[3]!.y);
        const tailTopWidth = Math.abs(keyholeTailPoints[4]!.x - keyholeTailPoints[0]!.x);
        const tailBottomWidth = Math.abs(keyholeTailPoints[3]!.x - keyholeTailPoints[1]!.x);
        expect(tailBottomWidth).toBeGreaterThan(tailTopWidth);
    });

    it('renders revolute joints as a hinge leaf with a pin, knuckles, and a single rotation arrow', () => {
        const scene = new THREE.Scene();
        const visualizer = new JointVisualizer(scene, { jointSize: 10, showAxis: true });

        const revolute = visualizer.addJoint({
            id: 'joint-revolute',
            name: 'Revolute',
            type: MbsJointType.Revolute,
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 }
        });

        const leaf = findByJointRole<THREE.LineLoop>(revolute, 'leaf-outline');
        const pin = findByJointRole<THREE.Line>(revolute, 'hinge-pin');
        const rotationHead = findByJointRole<THREE.Line>(revolute, 'rotation-head');

        expect(leaf, 'expected revolute leaf outline').toBeDefined();
        expect(pin, 'expected revolute hinge pin').toBeDefined();
        expect(rotationHead, 'expected revolute rotation arrow head').toBeDefined();
        expect(countByJointRole(revolute, 'hinge-knuckle')).toBe(4);
        expect(countByJointRole(revolute, 'leaf-hole')).toBe(6);
        expect(countByJointRole(revolute, 'rotation')).toBe(1);
        expect(countByJointRole(revolute, 'rotation-head')).toBe(1);
        expect(hasJointRole(revolute, 'plate')).toBe(false);

        const leafBounds = measureBounds(leaf!);
        const leafPoints = getLinePoints(leaf!);
        const pinPoints = getLinePoints(pin!);
        const arrowHeadPoints = getLinePoints(rotationHead!);

        expect(leafBounds.height).toBeGreaterThan(leafBounds.width * 1.55);
        expect(leafPoints[1]!.y).toBeGreaterThan(leafPoints[0]!.y);
        expect(leafPoints[2]!.y).toBeGreaterThan(leafPoints[3]!.y);
        expect(pinPoints[1]!.y).toBeGreaterThan(pinPoints[0]!.y);
        expect(pinPoints[1]!.y - pinPoints[0]!.y).toBeGreaterThan(2);
        expect(pinPoints[1]!.y - pinPoints[0]!.y).toBeLessThan(3.6);

        const arrowTip = arrowHeadPoints[1]!;
        expect(arrowTip.x).toBeGreaterThan(leafBounds.minX + leafBounds.width * 0.32);
        expect(arrowTip.x).toBeLessThan(leafBounds.minX + leafBounds.width * 0.62);
        expect(arrowTip.y).toBeGreaterThan(leafBounds.minY + leafBounds.height * 0.16);
        expect(arrowTip.y).toBeLessThan(leafBounds.minY + leafBounds.height * 0.42);
    });
});
