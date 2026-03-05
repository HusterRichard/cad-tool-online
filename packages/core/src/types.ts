// Basic type definitions for CadToolOnline

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Mat3 {
    m: number[]; // 9 elements, row-major
}

export interface Mat4 {
    m: number[]; // 16 elements, row-major
}

export interface MeshData {
    vertices: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
}

export interface EdgeData {
    // Flattened line-segment endpoints: [x1,y1,z1,x2,y2,z2,...]
    vertices: Float32Array;
}

export interface BoundingBox {
    min: Vec3;
    max: Vec3;
}

export enum JointType {
    Revolute = 0,
    Prismatic = 1,
    Cylindrical = 2,
    Spherical = 3,
    Universal = 4,
    Planar = 5,
    Fixed = 6
}

export enum MotionType {
    Displacement = 0,
    Velocity = 1,
    Acceleration = 2,
    Angular = 3,
    Force = 4,
    Torque = 5
}

export const OCCT_MIN_ACCURACY = 1e-6;
export const OCCT_MAX_ACCURACY = 1e+6;
