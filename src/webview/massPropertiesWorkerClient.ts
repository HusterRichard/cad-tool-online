import type { MassProperties } from '@cadtool-online/geo';

type LoadStepPending = {
    mainShapeIds: string[];
    resolve: () => void;
    reject: (error: unknown) => void;
};

type MassRequestPending = {
    mainShapeId: string;
    resolve: (value: MassProperties | null) => void;
    reject: (error: unknown) => void;
};

type WorkerResponse =
    | { type: 'loadStepResult'; requestId: number; shapes: string[]; error?: string }
    | { type: 'massResult'; requestId: number; massProperties: MassProperties | null; error?: string };

export class MassPropertiesWorkerClient {
    private readonly wasmBaseUrl: string | null;
    private worker: Worker | null = null;
    private workerUnavailable = false;
    private readonly mainToWorker = new Map<string, string>();
    private readonly pendingLoads = new Map<number, LoadStepPending>();
    private readonly pendingMass = new Map<number, MassRequestPending>();
    private nextRequestId = 1;

    constructor(wasmBaseUrl: string | null) {
        this.wasmBaseUrl = wasmBaseUrl;
    }

    clear(): void {
        this.worker?.postMessage({ type: 'clearShapes' });
        this.mainToWorker.clear();
        this.pendingLoads.forEach((pending) => pending.reject(new Error('Mass worker cleared')));
        this.pendingLoads.clear();
        this.pendingMass.forEach((pending) => pending.reject(new Error('Mass worker cleared')));
        this.pendingMass.clear();
    }

    notifyShapeDeleted(mainShapeId: string): void {
        const workerShapeId = this.mainToWorker.get(mainShapeId);
        if (workerShapeId && this.ensureWorker()) {
            this.worker!.postMessage({ type: 'deleteShape', shapeId: workerShapeId });
            this.mainToWorker.delete(mainShapeId);
        }
    }

    async syncStep(mainShapeIds: string[], buffer: ArrayBuffer, baseId: string): Promise<void> {
        if (!this.ensureWorker()) {
            return;
        }
        const requestId = this.nextRequestId++;
        const workerBuffer = buffer.slice(0);
        return new Promise<void>((resolve, reject) => {
            this.pendingLoads.set(requestId, { mainShapeIds, resolve, reject });
            this.worker!.postMessage({ type: 'loadStep', requestId, buffer: workerBuffer, baseId }, [workerBuffer]);
        });
    }

    async requestMass(mainShapeId: string, density: number): Promise<MassProperties | null> {
        if (!this.ensureWorker()) {
            return null;
        }
        const workerShapeId = this.mainToWorker.get(mainShapeId);
        if (!workerShapeId) {
            return null;
        }
        const requestId = this.nextRequestId++;
        return new Promise<MassProperties | null>((resolve, reject) => {
            this.pendingMass.set(requestId, { mainShapeId, resolve, reject });
            this.worker!.postMessage({ type: 'computeMass', requestId, shapeId: workerShapeId, density });
        });
    }

    private ensureWorker(): boolean {
        if (this.workerUnavailable) {
            return false;
        }

        if (this.worker) {
            return true;
        }

        try {
            this.worker = new Worker(new URL('./massPropertiesWorker.ts', import.meta.url), { type: 'module' });
            this.worker.addEventListener('message', this.onMessage.bind(this));
            this.worker.addEventListener('error', (event) => {
                console.warn('[massWorker] worker failed:', event);
                this.disableWorker(new Error('Mass properties worker failed'));
            });
            this.worker.postMessage({ type: 'init', wasmBaseUrl: this.wasmBaseUrl });
            return true;
        } catch (error) {
            console.warn('[massWorker] worker unavailable:', error);
            this.disableWorker(error);
            return false;
        }
    }

    private disableWorker(error: unknown): void {
        this.workerUnavailable = true;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.mainToWorker.clear();
        this.pendingLoads.forEach((pending) => pending.reject(error));
        this.pendingLoads.clear();
        this.pendingMass.forEach((pending) => pending.reject(error));
        this.pendingMass.clear();
    }

    private onMessage(event: MessageEvent<WorkerResponse>): void {
        const data = event.data;
        if (data.type === 'loadStepResult') {
            const pending = this.pendingLoads.get(data.requestId);
            if (!pending) {
                return;
            }
            this.pendingLoads.delete(data.requestId);
            if (data.error) {
                pending.reject(new Error(data.error));
                return;
            }
            for (let i = 0; i < Math.min(pending.mainShapeIds.length, data.shapes.length); i += 1) {
                this.mainToWorker.set(pending.mainShapeIds[i], data.shapes[i]);
            }
            pending.resolve();
        } else if (data.type === 'massResult') {
            const pending = this.pendingMass.get(data.requestId);
            if (!pending) {
                return;
            }
            this.pendingMass.delete(data.requestId);
            if (data.error) {
                pending.reject(new Error(data.error));
                return;
            }
            pending.resolve(data.massProperties);
        }
    }
}
