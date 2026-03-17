import { describe, expect, it, vi } from 'vitest';

import { aggregateMassProperties } from '../../../packages/core/src/massAggregation';
import type { MassProperties } from '../../../packages/geo/src/types';
import { GroupMassPropertiesCoordinator } from '../../../src/webview/groupMassPropertiesCoordinator';

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
                seed + 3,
                seed + 6,
                seed + 7,
                seed + 6,
                seed + 4,
                seed + 8,
                seed + 7,
                seed + 8,
                seed + 5
            ]
        }
    };
}

describe('GroupMassPropertiesCoordinator', () => {
    it('schedules async lookups and aggregates group mass after all parts resolve', async () => {
        const first = createDeferred<MassProperties | null>();
        const second = createDeferred<MassProperties | null>();
        const requestMass = vi
            .fn<[], Promise<MassProperties | null>>()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const hasShape = vi.fn(() => true);
        const getMass = vi.fn();
        const onResolved = vi.fn();

        const coordinator = new GroupMassPropertiesCoordinator({ requestMass } as never);
        const result = coordinator.request(
            {
                groupId: 'group-1',
                parts: [
                    { partId: 'part-1', kernelShapeId: 'shape-1', density: 7800 },
                    { partId: 'part-2', kernelShapeId: 'shape-2', density: 2700 }
                ]
            },
            { hasShape, getMass },
            onResolved
        );

        expect(result.state).toBe('scheduled');
        expect(requestMass).toHaveBeenCalledTimes(2);
        expect(requestMass).toHaveBeenNthCalledWith(1, 'shape-1', 7800);
        expect(requestMass).toHaveBeenNthCalledWith(2, 'shape-2', 2700);
        expect(getMass).not.toHaveBeenCalled();

        const mass1 = createMassProps(1);
        const mass2 = createMassProps(2);
        first.resolve(mass1);
        second.resolve(mass2);
        await flushMicrotasks();

        expect(onResolved).toHaveBeenCalledWith('group-1', {
            totalPartCount: 2,
            computedPartCount: 2,
            missingPartIds: [],
            ...aggregateMassProperties([mass1, mass2])
        });
    });

    it('returns cached group summary for repeated request with the same parts and densities', async () => {
        const mass1 = createMassProps(3);
        const mass2 = createMassProps(4);
        const requestMass = vi
            .fn<[], Promise<MassProperties | null>>()
            .mockResolvedValueOnce(mass1)
            .mockResolvedValueOnce(mass2);
        const hasShape = vi.fn(() => true);
        const getMass = vi.fn();
        const onResolved = vi.fn();

        const coordinator = new GroupMassPropertiesCoordinator({ requestMass } as never);
        coordinator.request(
            {
                groupId: 'group-2',
                parts: [
                    { partId: 'part-1', kernelShapeId: 'shape-1', density: 7800 },
                    { partId: 'part-2', kernelShapeId: 'shape-2', density: 7800 }
                ]
            },
            { hasShape, getMass },
            onResolved
        );
        await flushMicrotasks();

        const cached = coordinator.request(
            {
                groupId: 'group-2',
                parts: [
                    { partId: 'part-1', kernelShapeId: 'shape-1', density: 7800 },
                    { partId: 'part-2', kernelShapeId: 'shape-2', density: 7800 }
                ]
            },
            { hasShape, getMass },
            onResolved
        );

        expect(cached.state).toBe('cached');
        expect(cached.massSummary).toEqual({
            totalPartCount: 2,
            computedPartCount: 2,
            missingPartIds: [],
            ...aggregateMassProperties([mass1, mass2])
        });
        expect(requestMass).toHaveBeenCalledTimes(2);
    });

    it('drops stale group results when a newer request supersedes them', async () => {
        const first = createDeferred<MassProperties | null>();
        const second = createDeferred<MassProperties | null>();
        const requestMass = vi
            .fn<[], Promise<MassProperties | null>>()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const hasShape = vi.fn(() => true);
        const getMass = vi.fn();
        const onResolved = vi.fn();

        const coordinator = new GroupMassPropertiesCoordinator({ requestMass } as never);
        coordinator.request(
            {
                groupId: 'group-old',
                parts: [{ partId: 'part-old', kernelShapeId: 'shape-old', density: 7800 }]
            },
            { hasShape, getMass },
            onResolved
        );
        coordinator.request(
            {
                groupId: 'group-new',
                parts: [{ partId: 'part-new', kernelShapeId: 'shape-new', density: 7800 }]
            },
            { hasShape, getMass },
            onResolved
        );

        first.resolve(createMassProps(5));
        await flushMicrotasks();
        second.resolve(createMassProps(6));
        await flushMicrotasks();

        expect(onResolved).toHaveBeenCalledTimes(1);
        expect(onResolved.mock.calls[0]?.[0]).toBe('group-new');
    });
});
