import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MassProperties } from '../../../packages/geo/src/types';
import { MassPropertiesWorkerClient } from '../../../src/webview/massPropertiesWorkerClient';

type WorkerListenerMap = {
    message: Array<(event: MessageEvent<unknown>) => void>;
    error: Array<(event: Event) => void>;
};

class MockWorker {
    static instances: MockWorker[] = [];

    readonly posted: Array<{ message: unknown; transfer: Transferable[] | undefined }> = [];
    readonly listeners: WorkerListenerMap = {
        message: [],
        error: []
    };
    readonly terminate = vi.fn();

    constructor(_url: URL, _options?: WorkerOptions) {
        MockWorker.instances.push(this);
    }

    addEventListener(type: keyof WorkerListenerMap, callback: (event: MessageEvent<unknown> | Event) => void): void {
        if (type === 'message') {
            this.listeners.message.push(callback as (event: MessageEvent<unknown>) => void);
            return;
        }
        this.listeners.error.push(callback as (event: Event) => void);
    }

    postMessage(message: unknown, transfer?: Transferable[]): void {
        this.posted.push({ message, transfer });
    }

    dispatchMessage(data: unknown): void {
        this.listeners.message.forEach((listener) => listener({ data } as MessageEvent<unknown>));
    }

    dispatchError(event: Event = new Event('error')): void {
        this.listeners.error.forEach((listener) => listener(event));
    }
}

function createMassProperties(seed: number): MassProperties {
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
                seed + 3, seed + 6, seed + 7,
                seed + 6, seed + 4, seed + 8,
                seed + 7, seed + 8, seed + 5
            ]
        }
    };
}

describe('MassPropertiesWorkerClient', () => {
    beforeEach(() => {
        MockWorker.instances = [];
        vi.stubGlobal('Worker', MockWorker);
    });

    it('initializes the worker, syncs shape ids, and forwards mass requests', async () => {
        const client = new MassPropertiesWorkerClient('/wasm');
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const syncPromise = client.syncStep(['main-1', 'main-2'], buffer, 'shape');

        expect(MockWorker.instances).toHaveLength(1);
        const worker = MockWorker.instances[0];
        expect(worker.posted[0]?.message).toEqual({ type: 'init', wasmBaseUrl: '/wasm' });
        expect(worker.posted[1]?.message).toEqual({
            type: 'loadStep',
            requestId: 1,
            buffer,
            baseId: 'shape'
        });

        worker.dispatchMessage({
            type: 'loadStepResult',
            requestId: 1,
            shapes: ['worker-1', 'worker-2']
        });
        await syncPromise;

        const massPromise = client.requestMass('main-2', 7800);
        expect(worker.posted[2]?.message).toEqual({
            type: 'computeMass',
            requestId: 2,
            shapeId: 'worker-2',
            density: 7800
        });

        const expected = createMassProperties(2);
        worker.dispatchMessage({
            type: 'massResult',
            requestId: 2,
            massProperties: expected
        });
        await expect(massPromise).resolves.toEqual(expected);
    });

    it('returns null when requesting mass for an unknown shape', async () => {
        const client = new MassPropertiesWorkerClient('/wasm');

        await expect(client.requestMass('missing-shape', 7800)).resolves.toBeNull();
        expect(MockWorker.instances).toHaveLength(1);
        expect(MockWorker.instances[0].posted).toEqual([
            { message: { type: 'init', wasmBaseUrl: '/wasm' }, transfer: undefined }
        ]);
    });

    it('rejects pending work and clears mappings when clear() is called', async () => {
        const client = new MassPropertiesWorkerClient('/wasm');
        const syncPromise = client.syncStep(['main-1'], new Uint8Array([9, 9]).buffer, 'shape');
        const worker = MockWorker.instances[0];

        client.clear();

        expect(worker.posted.at(-1)?.message).toEqual({ type: 'clearShapes' });
        await expect(syncPromise).rejects.toThrow('Mass worker cleared');
        await expect(client.requestMass('main-1', 1000)).resolves.toBeNull();
    });

    it('notifies worker about deleted shapes only after a mapping exists', async () => {
        const client = new MassPropertiesWorkerClient('/wasm');
        const syncPromise = client.syncStep(['main-1'], new Uint8Array([4]).buffer, 'shape');
        const worker = MockWorker.instances[0];

        client.notifyShapeDeleted('main-1');
        expect(worker.posted).toHaveLength(2);

        worker.dispatchMessage({
            type: 'loadStepResult',
            requestId: 1,
            shapes: ['worker-1']
        });
        await syncPromise;

        client.notifyShapeDeleted('main-1');
        expect(worker.posted.at(-1)?.message).toEqual({ type: 'deleteShape', shapeId: 'worker-1' });
        await expect(client.requestMass('main-1', 1000)).resolves.toBeNull();
    });

    it('disables the worker and rejects pending requests after a worker error', async () => {
        const client = new MassPropertiesWorkerClient('/wasm');
        const syncPromise = client.syncStep(['main-1'], new Uint8Array([7]).buffer, 'shape');
        const worker = MockWorker.instances[0];

        worker.dispatchError();

        await expect(syncPromise).rejects.toThrow('Mass properties worker failed');
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        await expect(client.syncStep(['main-2'], new Uint8Array([8]).buffer, 'shape')).resolves.toBeUndefined();
        expect(MockWorker.instances).toHaveLength(1);
    });
});
