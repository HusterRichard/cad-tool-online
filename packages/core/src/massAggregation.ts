import type { Mat3, Vec3 } from './types';

export interface MassAggregationItem {
    mass: number;
    volume: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
}

export interface MassAggregationResult {
    mass: number;
    volume: number;
    density: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
}

function createZeroMatrix(): number[] {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function addMatrices(left: number[], right: number[]): number[] {
    return left.map((value, index) => value + (right[index] ?? 0));
}

function createParallelAxisShiftMatrix(mass: number, delta: Vec3): number[] {
    const dx = delta.x;
    const dy = delta.y;
    const dz = delta.z;
    return [
        mass * (dy * dy + dz * dz), mass * (-dx * dy), mass * (-dx * dz),
        mass * (-dx * dy), mass * (dx * dx + dz * dz), mass * (-dy * dz),
        mass * (-dx * dz), mass * (-dy * dz), mass * (dx * dx + dy * dy)
    ];
}

export function aggregateMassProperties(items: MassAggregationItem[]): MassAggregationResult | null {
    const validItems = items.filter((item) => {
        const matrix = item.inertiaMatrix?.m;
        return Number.isFinite(item.mass)
            && Number.isFinite(item.volume)
            && Number.isFinite(item.centerOfMass.x)
            && Number.isFinite(item.centerOfMass.y)
            && Number.isFinite(item.centerOfMass.z)
            && Array.isArray(matrix)
            && matrix.length === 9
            && matrix.every((value) => Number.isFinite(value));
    });

    if (validItems.length === 0) {
        return null;
    }

    const totalMass = validItems.reduce((sum, item) => sum + item.mass, 0);
    const totalVolume = validItems.reduce((sum, item) => sum + item.volume, 0);
    const weightedCenter = validItems.reduce((sum, item) => ({
        x: sum.x + item.centerOfMass.x * item.mass,
        y: sum.y + item.centerOfMass.y * item.mass,
        z: sum.z + item.centerOfMass.z * item.mass
    }), { x: 0, y: 0, z: 0 });

    const centerOfMass: Vec3 = totalMass > 0
        ? {
            x: weightedCenter.x / totalMass,
            y: weightedCenter.y / totalMass,
            z: weightedCenter.z / totalMass
        }
        : { x: 0, y: 0, z: 0 };

    let inertiaMatrix = createZeroMatrix();
    validItems.forEach((item) => {
        const delta: Vec3 = {
            x: item.centerOfMass.x - centerOfMass.x,
            y: item.centerOfMass.y - centerOfMass.y,
            z: item.centerOfMass.z - centerOfMass.z
        };
        inertiaMatrix = addMatrices(
            inertiaMatrix,
            addMatrices(item.inertiaMatrix.m, createParallelAxisShiftMatrix(item.mass, delta))
        );
    });

    return {
        mass: totalMass,
        volume: totalVolume,
        density: totalVolume > 0 ? totalMass / totalVolume : 0,
        centerOfMass,
        inertiaMatrix: { m: inertiaMatrix }
    };
}
