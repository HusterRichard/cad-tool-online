import { describe, expect, it, vi } from 'vitest';
import type { MassProperties } from './types';
import { MassPropertiesCoordinator } from '../../../src/webview/massPropertiesCoordinator';

function createMassProps(seed: number): MassProperties {
    return {
        mass: seed,
        volume: seed * 10,
        surfaceArea: seed * 100,
        density: 7850,
        centerOfMass: { x: seed, y: seed + 1, z: seed + 2 },
        inertia: {
            ixx: seed + 3,
            iyy: seed + 4,
            izz: seed + 5,
            ixy: seed + 6,
            ixz: seed + 7,
            iyz: seed + 8
        },
        inertiaMatrix: {
            m: [
                seed + 3, seed + 6, seed + 7,
                seed + 6, seed + 4, seed + 8,
                seed + 7, seed + 8, seed + 5
            ]
        }
    };
}

describe('MassPropertiesCoordinator', () => {
    it('schedules async lookup for uncached shape', () => {
        const queue: Array<() => void> = [];
        const schedule = (task: () => void): void => {
            queue.push(task);
        };
        const getMass = vi.fn(() => createMassProps(1));
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator(schedule);
        const result = coordinator.request(
            { uiShapeId: 'ui-1', kernelShapeId: 'shape-1' },
            { hasShape, getMass },
            onResolved
        );

        expect(result.state).toBe('scheduled');
        expect(getMass).not.toHaveBeenCalled();
        expect(queue).toHaveLength(1);

        queue[0]();
        expect(getMass).toHaveBeenCalledTimes(1);
        expect(onResolved).toHaveBeenCalledWith('ui-1', createMassProps(1));
    });

    it('drops stale result when selection changes quickly', () => {
        const queue: Array<() => void> = [];
        const schedule = (task: () => void): void => {
            queue.push(task);
        };
        const getMass = vi.fn((id: string) => createMassProps(id === 'shape-1' ? 1 : 2));
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator(schedule);
        coordinator.request(
            { uiShapeId: 'ui-1', kernelShapeId: 'shape-1' },
            { hasShape, getMass },
            onResolved
        );
        coordinator.request(
            { uiShapeId: 'ui-2', kernelShapeId: 'shape-2' },
            { hasShape, getMass },
            onResolved
        );

        expect(queue).toHaveLength(2);
        queue[0]();
        queue[1]();

        expect(onResolved).toHaveBeenCalledTimes(1);
        expect(onResolved).toHaveBeenCalledWith('ui-2', createMassProps(2));
    });

    it('returns cached value immediately for repeated selection', () => {
        const queue: Array<() => void> = [];
        const schedule = (task: () => void): void => {
            queue.push(task);
        };
        const value = createMassProps(3);
        const getMass = vi.fn(() => value);
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator(schedule);
        coordinator.request(
            { uiShapeId: 'ui-3', kernelShapeId: 'shape-3' },
            { hasShape, getMass },
            onResolved
        );
        queue[0]();

        const second = coordinator.request(
            { uiShapeId: 'ui-3', kernelShapeId: 'shape-3' },
            { hasShape, getMass },
            onResolved
        );

        expect(second.state).toBe('cached');
        expect(second.massProperties).toEqual(value);
        expect(getMass).toHaveBeenCalledTimes(1);
        expect(queue).toHaveLength(1);
    });

    it('clear() invalidates pending work and cache', () => {
        const queue: Array<() => void> = [];
        const schedule = (task: () => void): void => {
            queue.push(task);
        };
        const value = createMassProps(4);
        const getMass = vi.fn(() => value);
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator(schedule);
        coordinator.request(
            { uiShapeId: 'ui-4', kernelShapeId: 'shape-4' },
            { hasShape, getMass },
            onResolved
        );
        coordinator.clear();

        queue[0]();
        expect(onResolved).not.toHaveBeenCalled();

        const result = coordinator.request(
            { uiShapeId: 'ui-4', kernelShapeId: 'shape-4' },
            { hasShape, getMass },
            onResolved
        );
        expect(result.state).toBe('scheduled');
        expect(queue).toHaveLength(2);
    });
});
