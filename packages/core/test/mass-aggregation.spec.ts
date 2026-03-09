import { describe, expect, it } from 'vitest';

import { aggregateMassProperties } from '../src/massAggregation';

describe('aggregateMassProperties', () => {
    it('returns null for empty input', () => {
        expect(aggregateMassProperties([])).toBeNull();
    });

    it('aggregates mass, volume, center of mass, and inertia with parallel-axis shift', () => {
        const result = aggregateMassProperties([
            {
                mass: 2,
                volume: 1,
                centerOfMass: { x: 0, y: 0, z: 0 },
                inertiaMatrix: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
            },
            {
                mass: 2,
                volume: 1,
                centerOfMass: { x: 2, y: 0, z: 0 },
                inertiaMatrix: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
            }
        ]);

        expect(result).not.toBeNull();
        expect(result?.mass).toBe(4);
        expect(result?.volume).toBe(2);
        expect(result?.density).toBe(2);
        expect(result?.centerOfMass).toEqual({ x: 1, y: 0, z: 0 });
        expect(result?.inertiaMatrix.m).toEqual([
            2, 0, 0,
            0, 6, 0,
            0, 0, 6
        ]);
    });
});
