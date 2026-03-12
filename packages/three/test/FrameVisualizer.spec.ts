import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { FrameVisualizer } from '../src/FrameVisualizer';

describe('FrameVisualizer', () => {
    it('adds frame groups to the scene with mirrored metadata and selection styling', () => {
        const scene = new THREE.Scene();
        const visualizer = new FrameVisualizer(scene, { axisLength: 12 });

        const group = visualizer.addFrame({
            id: 'frame-1',
            name: 'Primary Frame',
            position: { x: 1, y: 2, z: 3 },
            orientation: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
            visible: false,
            isPrimary: true,
            selected: true
        });

        expect(scene.children).toContain(group);
        expect(visualizer.getFrame('frame-1')).toBe(group);
        expect(visualizer.getAllFrameIds()).toEqual(['frame-1']);
        expect(group.name).toBe('frame_frame-1');
        expect(group.position.toArray()).toEqual([1, 2, 3]);
        expect(group.visible).toBe(false);
        expect(group.userData).toMatchObject({
            frameId: 'frame-1',
            frameName: 'Primary Frame',
            selectionAppearance: 'frame',
            frameSelected: true,
            visible: false
        });
        expect(group.userData.orientation).toEqual({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1] });

        const coreAccent = group.children[3].children.find(
            (child) => child instanceof THREE.Mesh && child.userData.frameAccentRole === 'core'
        ) as THREE.Mesh;
        const ringAccent = group.children[3].children.find(
            (child) => child instanceof THREE.Mesh && child.userData.frameAccentRole === 'ring'
        ) as THREE.Mesh;

        expect((coreAccent.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xf59e0b);
        expect((ringAccent.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.92);
    });

    it('updates visibility and rebuilds frames when axis length changes', () => {
        const scene = new THREE.Scene();
        const visualizer = new FrameVisualizer(scene, { axisLength: 10 });

        visualizer.addFrame({
            id: 'frame-2',
            name: 'Ref Frame',
            position: { x: 0, y: 0, z: 0 },
            orientation: { m: [0, 1, 0, 1, 0, 0, 0, 0, -1] },
            isPrimary: false
        });

        visualizer.setFrameVisible('frame-2', false);
        expect(visualizer.getFrame('frame-2')?.visible).toBe(false);

        const before = visualizer.getFrame('frame-2');
        visualizer.setAxisLength(24);
        const after = visualizer.getFrame('frame-2');

        expect(after).toBeDefined();
        expect(after).not.toBe(before);
        expect(after?.visible).toBe(false);

        visualizer.removeFrame('frame-2');
        expect(visualizer.getFrame('frame-2')).toBeUndefined();
        expect(scene.children).toHaveLength(0);
    });
});
