import type { Vec3, Mat3 } from '@cadtool-online/core';

export type { MeshData, EdgeData } from '@cadtool-online/core';

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

export interface StepNode {
    id: string;
    name: string;
    type: 'assembly' | 'part' | 'solid';
    shapeId?: string;
    color?: string;
    children?: StepNode[];
    transform?: {
        translation: Vec3;
        rotation: number[];
    };
}

export interface StepReadResult {
    success: boolean;
    shapes: string[];
    count: number;
    rootNodes?: StepNode[];
    error?: string;
}

export interface MeshResult {
    success: boolean;
    vertices: number[];
    normals: number[];
    indices: number[];
    colors?: number[];
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

export interface FaceNormalResult {
    success: boolean;
    position: Vec3;
    normal: Vec3;
    distance: number;
    surfaceType?: string;
    snapKind?: 'cylinder-axis' | 'sphere-center';
    snapPoint?: Vec3;
    snapDirection?: Vec3;
    snapConfidence?: number;
    cylinderRadius?: number;
    cylinderAxisStart?: Vec3;
    cylinderAxisEnd?: Vec3;
    inferredFeature?: 'cylinderAxis' | 'sphereCenter';
    inferredPosition?: Vec3;
    inferredDirection?: Vec3;
    error?: string;
}
