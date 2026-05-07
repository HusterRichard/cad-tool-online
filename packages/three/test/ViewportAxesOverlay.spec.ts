import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { ViewportAxesOverlay } from '../src/ViewportAxesOverlay';

describe('ViewportAxesOverlay', () => {
    it('places the overlay in the bottom-left corner and keeps it inside the canvas', () => {
        const overlay = new ViewportAxesOverlay({ viewportSize: 96, margin: 12 });

        expect(overlay.getViewportRect(800, 600)).toEqual({
            x: 12,
            y: 12,
            width: 96,
            height: 96
        });
        expect(overlay.getViewportRect(90, 70)).toEqual({
            x: 12,
            y: 12,
            width: 46,
            height: 46
        });
    });

    it('updates the triad with the inverse of the source camera orientation', () => {
        const overlay = new ViewportAxesOverlay();
        const sourceCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        sourceCamera.quaternion.setFromEuler(new THREE.Euler(0.35, -0.6, 0.2));

        overlay.updateFromCamera(sourceCamera);

        const expected = sourceCamera.quaternion.clone().invert();
        const actual = overlay.getRoot().quaternion.clone();
        expect(actual.angleTo(expected)).toBeLessThan(1e-6);
    });

    it('renders X/Y/Z labels as transparent sprites instead of thin line glyphs', () => {
        const overlay = new ViewportAxesOverlay();
        const xLabel = overlay.getRoot().getObjectByName('viewport_axis_label_x');
        const yLabel = overlay.getRoot().getObjectByName('viewport_axis_label_y');
        const zLabel = overlay.getRoot().getObjectByName('viewport_axis_label_z');

        expect(xLabel).toBeInstanceOf(THREE.Sprite);
        expect(yLabel).toBeInstanceOf(THREE.Sprite);
        expect(zLabel).toBeInstanceOf(THREE.Sprite);
        expect((xLabel as THREE.Sprite).material).toBeInstanceOf(THREE.SpriteMaterial);
        expect(((xLabel as THREE.Sprite).material as THREE.SpriteMaterial).transparent).toBe(true);
    });

    it('renders as a transparent overlay without clearing a square background', () => {
        const overlay = new ViewportAxesOverlay();
        const sourceCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const autoClearStates: boolean[] = [];
        const renderer = {
            autoClear: true,
            getScissorTest: () => false,
            getViewport: (target: THREE.Vector4) => target.set(0, 0, 800, 600),
            getScissor: (target: THREE.Vector4) => target.set(0, 0, 800, 600),
            clearDepth: () => undefined,
            setScissorTest: () => undefined,
            setViewport: () => undefined,
            setScissor: () => undefined,
            render: () => {
                autoClearStates.push(renderer.autoClear);
            }
        } as unknown as THREE.WebGLRenderer;

        overlay.render(renderer, sourceCamera, 800, 600);

        expect(autoClearStates).toEqual([false]);
        expect(renderer.autoClear).toBe(true);
    });

    it('keeps axis labels inside the overlay viewport across common camera rotations', () => {
        const overlay = new ViewportAxesOverlay();
        const overlayCamera = (overlay as unknown as { camera: THREE.PerspectiveCamera }).camera;
        const halfFov = THREE.MathUtils.degToRad(overlayCamera.fov * 0.5);
        const sourceCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const labelNames = ['x', 'y', 'z'];
        const orientations = [
            new THREE.Euler(0, 0, 0),
            new THREE.Euler(0.45, 0.9, 0.2),
            new THREE.Euler(-0.35, -1.1, 0.3),
            new THREE.Euler(0.75, -0.4, -0.55)
        ];

        for (const orientation of orientations) {
            sourceCamera.quaternion.setFromEuler(orientation);
            overlay.updateFromCamera(sourceCamera);

            for (const name of labelNames) {
                const label = overlay.getRoot().getObjectByName(
                    `viewport_axis_label_${name}`
                ) as THREE.Sprite;
                const centerWorld = new THREE.Vector3();
                const centerCamera = new THREE.Vector3();
                label.getWorldPosition(centerWorld);
                centerCamera.copy(centerWorld).applyMatrix4(overlayCamera.matrixWorldInverse);

                const depth = -centerCamera.z;
                const projectedCenter = centerWorld.clone().project(overlayCamera);
                const projectedHalfSpan =
                    (label.scale.x * 0.5) / (depth * Math.tan(halfFov));

                expect(Math.abs(projectedCenter.x) + projectedHalfSpan).toBeLessThan(0.98);
                expect(Math.abs(projectedCenter.y) + projectedHalfSpan).toBeLessThan(0.98);
            }
        }
    });

    it('draws axis labels without outline or shadow stroke', () => {
        const fillText = vi.fn();
        const strokeText = vi.fn();
        const clearRect = vi.fn();
        const fakeContext = {
            clearRect,
            fillText,
            strokeText,
            font: '',
            textAlign: 'left',
            textBaseline: 'alphabetic',
            fillStyle: ''
        };
        const fakeCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => fakeContext)
        };
        const globals = globalThis as typeof globalThis & {
            document?: { createElement: (tagName: string) => unknown };
        };
        const originalDocument = globals.document;
        globals.document = {
            createElement: vi.fn(() => fakeCanvas)
        };

        try {
            new ViewportAxesOverlay();
        } finally {
            globals.document = originalDocument;
        }

        expect(fillText).toHaveBeenCalledTimes(3);
        expect(strokeText).not.toHaveBeenCalled();
        expect(clearRect).toHaveBeenCalledTimes(3);
    });
});
