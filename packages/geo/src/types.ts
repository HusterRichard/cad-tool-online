import type { Vec3, Mat3 } from '@cadtool-online/core';

export type { MeshData } from '@cadtool-online/core';

export interface MassProperties {
    mass: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
}

export interface ShapeInfo {
    id: string;
    type: 'solid' | 'shell' | 'face' | 'edge' | 'vertex';
    boundingBox: {
        min: Vec3;
        max: Vec3;
    };
}

export interface StepReadResult {
    shapes: ShapeInfo[];
    rootShapeId: string;
}
