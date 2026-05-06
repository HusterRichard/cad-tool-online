import type { MeshData, EdgeData } from '@cadtool-online/core';
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
    readStepFromBuffer(buffer: Uint8Array, baseId: string): string;

    // T2.3: Mesh generation
    meshShapeData?: (id: string, linearDeflection: number, angularDeflection: number) => {
        success: boolean;
        vertices: number[];
        normals: number[];
        indices: number[];
        colors?: number[];
        vertexCount: number;
        triangleCount: number;
        error?: string;
    };
    meshShapesData?: (shapeIds: string[], linearDeflection: number, angularDeflection: number) => Array<{
        success: boolean;
        vertices: number[];
        normals: number[];
        indices: number[];
        colors?: number[];
        vertexCount: number;
        triangleCount: number;
        error?: string;
    }>;
    meshShape(id: string, linearDeflection: number, angularDeflection: number): string;
    meshShapeDefault(id: string): string;
    brepEdgesData?: (id: string, linearDeflection: number) => {
        success: boolean;
        vertices: number[];
        segmentCount: number;
        error?: string;
    };

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
    getMeshes(shapeIds: string[], linearDeflection?: number, angularDeflection?: number): Map<string, MeshData | null>;
    getBrepEdges(shapeId: string, linearDeflection?: number): EdgeData | null;
    getMassProperties(shapeId: string, density?: number): MassProperties | null;
    getFaceNormalAtPoint(shapeId: string, rayOrigin: { x: number; y: number; z: number }, rayDir: { x: number; y: number; z: number }): FaceNormalResult | null;
    deleteShape(shapeId: string): void;
    hasShape(shapeId: string): boolean;
    clearShapes(): void;
    getShapeCount(): number;
}

let wasmModule: CadGeoModule | null = null;
let shapeCounter = 0;

// OCCT mass properties are computed in model-space length units.
// Current STEP import pipeline uses millimeters as model length.
// Convert all derived properties to SI for UI/export consistency.
const MODEL_LENGTH_TO_METER = 1e-3;
const MODEL_AREA_TO_M2 = MODEL_LENGTH_TO_METER * MODEL_LENGTH_TO_METER;
const MODEL_VOLUME_TO_M3 = MODEL_AREA_TO_M2 * MODEL_LENGTH_TO_METER;
const MODEL_INERTIA_TO_KG_M2 = MODEL_VOLUME_TO_M3 * MODEL_AREA_TO_M2;

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

        // Pass binary data directly to WASM to avoid UTF-8/base64 conversion overhead
        const uint8Array = new Uint8Array(data);
        const resultJson = wasmModule!.readStepFromBuffer(uint8Array, id);
        const result: StepReadResult = JSON.parse(resultJson);

        return result;
    }

    // ========================================================================
    // T2.3: Mesh Generation
    // ========================================================================

    getMesh(shapeId: string, linearDeflection: number = 0.0005, angularDeflection: number = 0.2): MeshData | null {
        this.ensureInitialized();

        // Prefer structured WASM return to avoid huge JSON serialization/deserialization overhead.
        const meshShapeData = wasmModule!.meshShapeData;
        if (meshShapeData) {
            const result = meshShapeData(shapeId, linearDeflection, angularDeflection);

            if (!result.success) {
                console.error('Mesh generation failed:', result.error);
                return null;
            }

            return {
                vertices: new Float32Array(result.vertices),
                normals: new Float32Array(result.normals),
                indices: new Uint32Array(result.indices),
                colors:
                    result.colors && result.colors.length > 0
                        ? new Float32Array(result.colors)
                        : undefined
            };
        }

        // Backward-compatible fallback for older WASM modules.
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
            indices: new Uint32Array(result.indices),
            colors:
                result.colors && result.colors.length > 0
                    ? new Float32Array(result.colors)
                    : undefined
        };
    }

    getMeshes(shapeIds: string[], linearDeflection: number = 0.0005, angularDeflection: number = 0.2): Map<string, MeshData | null> {
        this.ensureInitialized();

        const result = new Map<string, MeshData | null>();
        if (shapeIds.length === 0) {
            return result;
        }

        const meshShapesData = wasmModule!.meshShapesData;
        if (meshShapesData) {
            const batch = meshShapesData(shapeIds, linearDeflection, angularDeflection);
            for (let i = 0; i < shapeIds.length; i++) {
                const shapeId = shapeIds[i];
                const item = batch[i];
                if (!item?.success) {
                    result.set(shapeId, null);
                    continue;
                }
                result.set(shapeId, {
                    vertices: new Float32Array(item.vertices),
                    normals: new Float32Array(item.normals),
                    indices: new Uint32Array(item.indices),
                    colors:
                        item.colors && item.colors.length > 0
                            ? new Float32Array(item.colors)
                            : undefined
                });
            }
            return result;
        }

        // Backward-compatible fallback
        for (const shapeId of shapeIds) {
            result.set(shapeId, this.getMesh(shapeId, linearDeflection, angularDeflection));
        }
        return result;
    }

    getBrepEdges(shapeId: string, linearDeflection: number = 0.0005): EdgeData | null {
        this.ensureInitialized();

        const brepEdgesData = wasmModule!.brepEdgesData;
        if (!brepEdgesData) {
            return null;
        }

        const result = brepEdgesData(shapeId, linearDeflection);
        if (!result.success) {
            console.error('BRep edge extraction failed:', result.error);
            return null;
        }

        return {
            vertices: new Float32Array(result.vertices)
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

        const massSi = result.mass * MODEL_VOLUME_TO_M3;
        const volumeSi = result.volume * MODEL_VOLUME_TO_M3;
        const surfaceAreaSi = result.surfaceArea * MODEL_AREA_TO_M2;
        const centerOfMassSi = {
            x: result.centerOfMass.x * MODEL_LENGTH_TO_METER,
            y: result.centerOfMass.y * MODEL_LENGTH_TO_METER,
            z: result.centerOfMass.z * MODEL_LENGTH_TO_METER
        };
        const inertiaSi = {
            ixx: result.inertia.ixx * MODEL_INERTIA_TO_KG_M2,
            iyy: result.inertia.iyy * MODEL_INERTIA_TO_KG_M2,
            izz: result.inertia.izz * MODEL_INERTIA_TO_KG_M2,
            ixy: result.inertia.ixy * MODEL_INERTIA_TO_KG_M2,
            ixz: result.inertia.ixz * MODEL_INERTIA_TO_KG_M2,
            iyz: result.inertia.iyz * MODEL_INERTIA_TO_KG_M2
        };

        // Convert to MassProperties format in SI units
        return {
            mass: massSi,
            volume: volumeSi,
            surfaceArea: surfaceAreaSi,
            density: result.density,
            centerOfMass: centerOfMassSi,
            inertia: inertiaSi,
            inertiaMatrix: {
                m: [
                    inertiaSi.ixx, inertiaSi.ixy, inertiaSi.ixz,
                    inertiaSi.ixy, inertiaSi.iyy, inertiaSi.iyz,
                    inertiaSi.ixz, inertiaSi.iyz, inertiaSi.izz
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
