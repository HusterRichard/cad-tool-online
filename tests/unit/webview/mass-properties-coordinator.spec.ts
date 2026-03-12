import { describe, expect, it, vi } from 'vitest';

import type { MassProperties } from '../../../packages/geo/src/types';
import { MassPropertiesCoordinator } from '../../../src/webview/massPropertiesCoordinator';

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

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
    it('schedules async lookup for uncached shape', async () => {
        const pending = createDeferred<MassProperties | null>();
        const requestMass = vi.fn(() => pending.promise);
        const clear = vi.fn();
        const getMass = vi.fn(() => createMassProps(1));
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator({ requestMass, clear } as never);
        const result = coordinator.request(
            { uiShapeId: 'ui-1', kernelShapeId: 'shape-1' },
            { hasShape, getMass },
            onResolved
        );

        expect(result.state).toBe('scheduled');
        expect(getMass).not.toHaveBeenCalled();
        expect(requestMass).toHaveBeenCalledWith('shape-1', 7850);
        expect(onResolved).not.toHaveBeenCalled();

        pending.resolve(createMassProps(1));
        await flushMicrotasks();
        expect(getMass).not.toHaveBeenCalled();
        expect(onResolved).toHaveBeenCalledWith('ui-1', createMassProps(1));
    });

    it('drops stale result when selection changes quickly', async () => {
        const first = createDeferred<MassProperties | null>();
        const second = createDeferred<MassProperties | null>();
        const requestMass = vi
            .fn<[], Promise<MassProperties | null>>()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const clear = vi.fn();
        const getMass = vi.fn((id: string) => createMassProps(id === 'shape-1' ? 1 : 2));
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator({ requestMass, clear } as never);
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

        first.resolve(createMassProps(1));
        await flushMicrotasks();
        second.resolve(createMassProps(2));
        await flushMicrotasks();

        expect(onResolved).toHaveBeenCalledTimes(1);
        expect(onResolved).toHaveBeenCalledWith('ui-2', createMassProps(2));
    });

    it('returns cached value immediately for repeated selection', async () => {
        const value = createMassProps(3);
        const requestMass = vi.fn().mockResolvedValue(value);
        const clear = vi.fn();
        const getMass = vi.fn(() => value);
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator({ requestMass, clear } as never);
        coordinator.request(
            { uiShapeId: 'ui-3', kernelShapeId: 'shape-3' },
            { hasShape, getMass },
            onResolved
        );
        await flushMicrotasks();

        const second = coordinator.request(
            { uiShapeId: 'ui-3', kernelShapeId: 'shape-3' },
            { hasShape, getMass },
            onResolved
        );

        expect(second.state).toBe('cached');
        expect(second.massProperties).toEqual(value);
        expect(getMass).not.toHaveBeenCalled();
        expect(requestMass).toHaveBeenCalledTimes(1);
    });

    it('clear() invalidates pending work and cache', async () => {
        const pending = createDeferred<MassProperties | null>();
        const requestMass = vi.fn().mockReturnValue(pending.promise);
        const clear = vi.fn();
        const value = createMassProps(4);
        const getMass = vi.fn(() => value);
        const hasShape = vi.fn(() => true);
        const onResolved = vi.fn();

        const coordinator = new MassPropertiesCoordinator({ requestMass, clear } as never);
        coordinator.request(
            { uiShapeId: 'ui-4', kernelShapeId: 'shape-4' },
            { hasShape, getMass },
            onResolved
        );
        coordinator.clear();
        expect(clear).toHaveBeenCalledTimes(1);

        pending.resolve(value);
        await flushMicrotasks();
        expect(onResolved).not.toHaveBeenCalled();

        const result = coordinator.request(
            { uiShapeId: 'ui-4', kernelShapeId: 'shape-4' },
            { hasShape, getMass },
            onResolved
        );
        expect(result.state).toBe('scheduled');
        expect(requestMass).toHaveBeenCalledTimes(2);
    });
});
