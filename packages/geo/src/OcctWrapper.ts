import type { MeshData } from '@cadtool-online/core';
import type { MassProperties, StepReadResult, MeshResult, MassPropertiesResult, FaceNormalResult } from './types';

// WASM module interface (extended with new functions)
interface CadGeoModule {
    // Primitive creation
    makeBox(dx: number, dy: number, dz: number, id: string): string;
    makeBoxAt(dx: number, dy: number, dz: number, x: number, y: number, z: number, id: string): string;
    makeCylinder(radius: number, height: number, id: string): string;
    makeCylinderAt(radius: number, height: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, id: string): string;
    makeSphere(radius: number, id: string): string;
    makeSphereAt(radius: number, x: number, y: number, z: number, id: string): string;
    makeCone(r1: number, r2: number, height: number, id: string): string;

    // Boolean operations
    booleanFuse(id1: string, id2: string, resultId: string): string;
    booleanCut(id1: string, id2: string, resultId: string): string;
    booleanCommon(id1: string, id2: string, resultId: string): string;

    // Shape management
    removeShape(id: string): void;
    hasShape(id: string): boolean;
    clearShapes(): void;
    getShapeCount(): number;

    // T2.2: STEP file reading
    readStepFromBuffer(buffer: string, baseId: string): string;

    // T2.3: Mesh generation
    meshShape(id: string, linearDeflection: number, angularDeflection: number): string;
    meshShapeDefault(id: string): string;

    // T2.4: Mass properties
    calculateMassProperties(id: string, density: number): string;
    calculateMassPropertiesDefault(id: string): string;

    // T2.5: Face normal calculation
    getFaceNormalAtPoint(id: string, rayOriginX: number, rayOriginY: number, rayOriginZ: number,
                         rayDirX: number, rayDirY: number, rayDirZ: number): string;
}

export interface IOcctWrapper {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    readStep(data: ArrayBuffer, baseId?: string): Promise<StepReadResult>;
    getMesh(shapeId: string, linearDeflection?: number, angularDeflection?: number): MeshData | null;
    getMassProperties(shapeId: string, density?: number): MassProperties | null;
    getFaceNormalAtPoint(shapeId: string, rayOrigin: { x: number; y: number; z: number }, rayDir: { x: number; y: number; z: number }): FaceNormalResult | null;
    deleteShape(shapeId: string): void;
    hasShape(shapeId: string): boolean;
    clearShapes(): void;
    getShapeCount(): number;
}

let wasmModule: CadGeoModule | null = null;
let shapeCounter = 0;

export class OcctWrapper implements IOcctWrapper {
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Dynamic import of WASM module
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const CadGeoFactory = (await import('../wasm/cad-geo.js' as any)).default;

            // Configure WASM file location for VSCode webview
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wasmBaseUrl = (globalThis as any).WASM_BASE_URL;
            const moduleConfig: Record<string, unknown> = {};

            if (wasmBaseUrl) {
                moduleConfig.locateFile = (path: string) => {
                    if (path.endsWith('.wasm')) {
                        return `${wasmBaseUrl}/${path}`;
                    }
                    return path;
                };
            }

            wasmModule = await CadGeoFactory(moduleConfig);
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize OCCT WASM module:', error);
            throw new Error(`Failed to initialize OCCT WASM: ${error}`);
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    private ensureInitialized(): void {
        if (!this.initialized || !wasmModule) {
            throw new Error('OcctWrapper not initialized. Call initialize() first.');
        }
    }

    private generateShapeId(prefix: string = 'shape'): string {
        return `${prefix}_${++shapeCounter}`;
    }

    // ========================================================================
    // T2.2: STEP File Reading
    // ========================================================================

    async readStep(data: ArrayBuffer, baseId?: string): Promise<StepReadResult> {
        this.ensureInitialized();

        const id = baseId ?? this.generateShapeId('step');

        // Convert ArrayBuffer to string for WASM
        const uint8Array = new Uint8Array(data);
        const decoder = new TextDecoder('utf-8');
        const stepString = decoder.decode(uint8Array);

        const resultJson = wasmModule!.readStepFromBuffer(stepString, id);
        const result: StepReadResult = JSON.parse(resultJson);

        return result;
    }

    // ========================================================================
    // T2.3: Mesh Generation
    // ========================================================================

    getMesh(shapeId: string, linearDeflection: number = 0.1, angularDeflection: number = 0.5): MeshData | null {
        this.ensureInitialized();

        const resultJson = wasmModule!.meshShape(shapeId, linearDeflection, angularDeflection);
        const result: MeshResult = JSON.parse(resultJson);

        if (!result.success) {
            console.error('Mesh generation failed:', result.error);
            return null;
        }

        // Convert to MeshData format for three.js
        return {
            vertices: new Float32Array(result.vertices),
            normals: new Float32Array(result.normals),
            indices: new Uint32Array(result.indices)
        };
    }

    // ========================================================================
    // T2.4: Mass Properties Calculation
    // ========================================================================

    getMassProperties(shapeId: string, density: number = 7850.0): MassProperties | null {
        this.ensureInitialized();

        const resultJson = wasmModule!.calculateMassProperties(shapeId, density);
        const result: MassPropertiesResult = JSON.parse(resultJson);

        if (!result.success) {
            console.error('Mass properties calculation failed:', result.error);
            return null;
        }

        // Convert to MassProperties format
        return {
            mass: result.mass,
            volume: result.volume,
            surfaceArea: result.surfaceArea,
            density: result.density,
            centerOfMass: result.centerOfMass,
            inertia: result.inertia,
            inertiaMatrix: {
                m: [
                    result.inertia.ixx, result.inertia.ixy, result.inertia.ixz,
                    result.inertia.ixy, result.inertia.iyy, result.inertia.iyz,
                    result.inertia.ixz, result.inertia.iyz, result.inertia.izz
                ]
            }
        };
    }

    // ========================================================================
    // T2.5: Face Normal Calculation for Marker Creation
    // ========================================================================

    getFaceNormalAtPoint(
        shapeId: string,
        rayOrigin: { x: number; y: number; z: number },
        rayDir: { x: number; y: number; z: number }
    ): FaceNormalResult | null {
        this.ensureInitialized();

        const resultJson = wasmModule!.getFaceNormalAtPoint(
            shapeId,
            rayOrigin.x, rayOrigin.y, rayOrigin.z,
            rayDir.x, rayDir.y, rayDir.z
        );
        const result: FaceNormalResult = JSON.parse(resultJson);

        if (!result.success) {
            console.error('Face normal calculation failed:', result.error);
            return null;
        }

        return result;
    }

    // ========================================================================
    // Shape Management
    // ========================================================================

    deleteShape(shapeId: string): void {
        this.ensureInitialized();
        wasmModule!.removeShape(shapeId);
    }

    hasShape(shapeId: string): boolean {
        this.ensureInitialized();
        return wasmModule!.hasShape(shapeId);
    }

    clearShapes(): void {
        this.ensureInitialized();
        wasmModule!.clearShapes();
    }

    getShapeCount(): number {
        this.ensureInitialized();
        return wasmModule!.getShapeCount();
    }

    // ========================================================================
    // Primitive Creation (convenience methods)
    // ========================================================================

    makeBox(dx: number, dy: number, dz: number, id?: string): string {
        this.ensureInitialized();
        const shapeId = id ?? this.generateShapeId('box');
        return wasmModule!.makeBox(dx, dy, dz, shapeId);
    }

    makeCylinder(radius: number, height: number, id?: string): string {
        this.ensureInitialized();
        const shapeId = id ?? this.generateShapeId('cylinder');
        return wasmModule!.makeCylinder(radius, height, shapeId);
    }

    makeSphere(radius: number, id?: string): string {
        this.ensureInitialized();
        const shapeId = id ?? this.generateShapeId('sphere');
        return wasmModule!.makeSphere(radius, shapeId);
    }

    makeCone(r1: number, r2: number, height: number, id?: string): string {
        this.ensureInitialized();
        const shapeId = id ?? this.generateShapeId('cone');
        return wasmModule!.makeCone(r1, r2, height, shapeId);
    }

    // Boolean operations
    booleanFuse(id1: string, id2: string, resultId?: string): string {
        this.ensureInitialized();
        const shapeId = resultId ?? this.generateShapeId('fuse');
        return wasmModule!.booleanFuse(id1, id2, shapeId);
    }

    booleanCut(id1: string, id2: string, resultId?: string): string {
        this.ensureInitialized();
        const shapeId = resultId ?? this.generateShapeId('cut');
        return wasmModule!.booleanCut(id1, id2, shapeId);
    }

    booleanCommon(id1: string, id2: string, resultId?: string): string {
        this.ensureInitialized();
        const shapeId = resultId ?? this.generateShapeId('common');
        return wasmModule!.booleanCommon(id1, id2, shapeId);
    }
}

export const occtWrapper = new OcctWrapper();
