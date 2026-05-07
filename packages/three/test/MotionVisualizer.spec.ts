import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { MotionVisualizer } from '../src/MotionVisualizer';

describe('MotionVisualizer', () => {
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

    function getLinePoints(object: THREE.Line | THREE.LineLoop): THREE.Vector3[] {
        const position = object.geometry.getAttribute('position');
        const points: THREE.Vector3[] = [];
        for (let index = 0; index < position.count; index += 1) {
            points.push(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
        }
        return points;
    }

    function measureBounds(object: THREE.Object3D): {
        width: number;
        height: number;
    } {
        const box = new THREE.Box3().setFromObject(object);
        return {
            width: box.max.x - box.min.x,
            height: box.max.y - box.min.y
        };
    }

    it('renders translational motion as a drawn axial arrow outline', () => {
        const scene = new THREE.Scene();
        const visualizer = new MotionVisualizer(scene, { motionSize: 8 });

        const motion = visualizer.addMotion({
            id: 'motion-prismatic',
            name: 'Translation Motion',
            motionType: 'translational',
            displayState: 'created',
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 1, y: 0, z: 0 },
            size: 8
        });

        const outline = findByJointRole<THREE.LineLoop>(motion, 'motion-translational-outline');
        expect(outline, 'expected translational motion outline').toBeDefined();
        expect(findByJointRole<THREE.Mesh>(motion, 'icon')).toBeUndefined();
        expect(new Set(collectLineColors(motion))).toEqual(new Set([0xff5559]));

        motion.updateMatrixWorld(true);
        const worldPoints = getLinePoints(outline!).map(point => outline!.localToWorld(point.clone()));
        const tailMidpoint = worldPoints[0]!.clone().add(worldPoints[1]!).multiplyScalar(0.5);
        const axisDirection = worldPoints[4]!.clone().sub(tailMidpoint).normalize();

        expect(axisDirection.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-6);
    });

    it('renders rotational motion as a drawn arc arrow outline', () => {
        const scene = new THREE.Scene();
        const visualizer = new MotionVisualizer(scene, { motionSize: 8 });

        const motion = visualizer.addMotion({
            id: 'motion-revolute',
            name: 'Rotation Motion',
            motionType: 'rotational',
            displayState: 'draft',
            position: { x: 0, y: 0, z: 0 },
            axis: { x: 0, y: 0, z: 1 },
            size: 8
        });

        const outline = findByJointRole<THREE.Group>(motion, 'motion-rotational-outline');
        const headTop = findByJointRole<THREE.Line>(motion, 'motion-rotational-head-top');
        const headBottom = findByJointRole<THREE.Line>(motion, 'motion-rotational-head-bottom');
        expect(outline, 'expected rotational motion outline').toBeDefined();
        expect(headTop, 'expected rotational motion upper arrow edge').toBeDefined();
        expect(headBottom, 'expected rotational motion lower arrow edge').toBeDefined();
        expect(findByJointRole<THREE.Mesh>(motion, 'icon')).toBeUndefined();

        const bounds = measureBounds(outline!);
        expect(bounds.width).toBeGreaterThan(8);
        expect(bounds.height).toBeGreaterThan(8);

        const topPoints = getLinePoints(headTop!);
        const bottomPoints = getLinePoints(headBottom!);
        const tipPoint = topPoints[1]!;
        expect(tipPoint.distanceTo(bottomPoints[0]!)).toBeLessThan(1e-6);

        const incoming = topPoints[0]!.clone().sub(tipPoint).normalize();
        const outgoing = bottomPoints[1]!.clone().sub(tipPoint).normalize();
        const turnMagnitude = incoming.clone().cross(outgoing).length();

        expect(turnMagnitude).toBeGreaterThan(0.2);
    });

    it('keeps rotational motion oriented with a stable top and lower-right arrow head', () => {
        const scene = new THREE.Scene();
        const visualizer = new MotionVisualizer(scene, { motionSize: 8 });
        const axis = new THREE.Vector3(0, 0.85, -0.52).normalize();

        const motion = visualizer.addMotion({
            id: 'motion-revolute-oriented',
            name: 'Rotation Motion Oriented',
            motionType: 'rotational',
            displayState: 'created',
            position: { x: 0, y: 0, z: 0 },
            axis: { x: axis.x, y: axis.y, z: axis.z },
            size: 8
        });

        const headTop = findByJointRole<THREE.Line>(motion, 'motion-rotational-head-top');
        expect(headTop, 'expected rotational motion upper arrow edge').toBeDefined();

        motion.updateMatrixWorld(true);

        const projectedUp = new THREE.Vector3(0, 1, 0)
            .sub(axis.clone().multiplyScalar(axis.y))
            .normalize();
        const worldLocalY = new THREE.Vector3(0, 1, 0).applyQuaternion(motion.quaternion).normalize();
        expect(worldLocalY.dot(projectedUp)).toBeGreaterThan(0.999);

        const right = projectedUp.clone().cross(axis).normalize();
        const tipPoint = headTop!.localToWorld(getLinePoints(headTop!)[1]!.clone());
        expect(tipPoint.dot(right)).toBeGreaterThan(0);
        expect(tipPoint.dot(projectedUp)).toBeLessThan(0);
    });
});
