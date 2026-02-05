import type { MeshData } from '@cadtool-online/core';
import type { MassProperties, StepReadResult } from './types';

export interface IOcctWrapper {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    readStep(data: ArrayBuffer): Promise<StepReadResult>;
    getMesh(shapeId: string, deflection?: number): MeshData | null;
    getMassProperties(shapeId: string, density?: number): MassProperties | null;
    deleteShape(shapeId: string): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;

export class OcctWrapper implements IOcctWrapper {
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // TODO: Load WASM module
        // wasmModule = await ChiliGeo();
        this.initialized = true;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async readStep(_data: ArrayBuffer): Promise<StepReadResult> {
        if (!this.initialized) {
            throw new Error('OcctWrapper not initialized');
        }

        // TODO: Implement STEP reading via WASM
        void wasmModule; // Will be used when WASM is loaded
        return {
            shapes: [],
            rootShapeId: ''
        };
    }

    getMesh(_shapeId: string, _deflection: number = 0.1): MeshData | null {
        if (!this.initialized) {
            throw new Error('OcctWrapper not initialized');
        }

        // TODO: Implement mesh generation via WASM
        return null;
    }

    getMassProperties(_shapeId: string, _density: number = 1.0): MassProperties | null {
        if (!this.initialized) {
            throw new Error('OcctWrapper not initialized');
        }

        // TODO: Implement mass property calculation via WASM
        return null;
    }

    deleteShape(_shapeId: string): void {
        if (!this.initialized) {
            throw new Error('OcctWrapper not initialized');
        }

        // TODO: Implement shape deletion via WASM
    }
}

export const occtWrapper = new OcctWrapper();
