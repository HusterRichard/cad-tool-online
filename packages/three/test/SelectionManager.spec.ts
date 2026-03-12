import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { SelectionManager } from '../src/SelectionManager';

type FakeDomElement = HTMLElement & {
    listeners: Record<string, Array<(event: MouseEvent) => void>>;
};

function createDomElement(): FakeDomElement {
    const listeners: Record<string, Array<(event: MouseEvent) => void>> = {};
    return {
        clientWidth: 300,
        clientHeight: 150,
        listeners,
        addEventListener: vi.fn((type: string, callback: (event: MouseEvent) => void) => {
            listeners[type] ??= [];
            listeners[type].push(callback);
        }),
        removeEventListener: vi.fn((type: string, callback: (event: MouseEvent) => void) => {
            listeners[type] = (listeners[type] ?? []).filter((registered) => registered !== callback);
        }),
        getBoundingClientRect: vi.fn(() => ({
            left: 10,
            top: 20,
            width: 300,
            height: 150
        }))
    } as unknown as FakeDomElement;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SelectionManager', () => {
    it('tracks selection lifecycle and emits callbacks', () => {
        const domElement = createDomElement();
        const manager = new SelectionManager(new THREE.Scene(), new THREE.PerspectiveCamera(), domElement);
        const cubeA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const cubeB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        const callback = vi.fn();

        manager.onSelectionChange(callback);
        manager.registerObject('a', cubeA);
        manager.registerObject('b', cubeB);

        manager.select('a');
        manager.toggleSelection('b');
        expect(manager.getSelectedIds().sort()).toEqual(['a', 'b']);
        expect(manager.isSelected('a')).toBe(true);
        expect(callback).toHaveBeenCalledWith({ type: 'select', objectId: 'a', object: cubeA });
        expect(callback).toHaveBeenCalledWith({ type: 'select', objectId: 'b', object: cubeB });

        manager.unregisterObject('a');
        expect(manager.getSelectedIds()).toEqual(['b']);
        expect(callback).toHaveBeenCalledWith({ type: 'deselect', objectId: 'a', object: cubeA });

        manager.clearSelection();
        expect(manager.getSelectedIds()).toEqual([]);
        expect(callback).toHaveBeenCalledWith({ type: 'deselect', objectId: 'b', object: cubeB });

        manager.dispose();
        expect(domElement.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it('maps descendant raycast hits back to the registered parent object id', () => {
        const domElement = createDomElement();
        const manager = new SelectionManager(new THREE.Scene(), new THREE.PerspectiveCamera(), domElement);
        const parent = new THREE.Group();
        const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        parent.add(child);
        manager.registerObject('parent-id', parent);

        vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
            { object: child } as THREE.Intersection
        ]);

        expect(manager.pickObjectIdAtScreenPoint(160, 95)).toBe('parent-id');

        manager.setViewportSize(640, 480);
        manager.setEnabled(false);
        manager.setHoverEnabled(false);
        manager.dispose();
    });
});
