import type { Vec3, Mat3 } from '@cadtool-online/core';

export type { MeshData } from '@cadtool-online/core';

export interface MassProperties {
    mass: number;
    volume: number;
    surfaceArea: number;
    density: number;
    centerOfMass: Vec3;
    inertia: {
        ixx: number;
        iyy: number;
        izz: number;
        ixy: number;
        ixz: number;
        iyz: number;
    };
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
    success: boolean;
    shapes: string[];
    count: number;
    error?: string;
}

export interface MeshResult {
    success: boolean;
    vertices: number[];
    normals: number[];
    indices: number[];
    vertexCount: number;
    triangleCount: number;
    error?: string;
}

export interface MassPropertiesResult {
    success: boolean;
    volume: number;
    surfaceArea: number;
    mass: number;
    density: number;
    centerOfMass: Vec3;
    inertia: {
        ixx: number;
        iyy: number;
        izz: number;
        ixy: number;
        ixz: number;
        iyz: number;
    };
    error?: string;
}
