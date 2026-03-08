import { occtWrapper } from '@cadtool-online/geo';
import type { MassProperties } from '@cadtool-online/geo';

declare global {
    interface WorkerGlobalScope {
        WASM_BASE_URL?: string;
    }
}

type WorkerMessage =
    | { type: 'init'; wasmBaseUrl: string | null }
    | { type: 'clearShapes' }
    | { type: 'loadStep'; requestId: number; buffer: ArrayBuffer; baseId: string }
    | { type: 'deleteShape'; shapeId: string }
    | { type: 'computeMass'; requestId: number; shapeId: string; density: number };

let wasmBaseUrl: string | null = null;
let occtReady: Promise<void> | null = null;

function ensureOcct(): Promise<void> {
    if (!occtReady) {
        occtReady = Promise.resolve().then(() => {
            if (wasmBaseUrl !== null) {
                globalThis.WASM_BASE_URL = wasmBaseUrl;
            }
            return occtWrapper.initialize();
        });
    }
    return occtReady;
}

async function handleLoadStep(requestId: number, buffer: ArrayBuffer, baseId: string): Promise<void> {
    try {
        await ensureOcct();
        const result = await occtWrapper.readStep(buffer, baseId);
        postMessage({ type: 'loadStepResult', requestId, shapes: result.shapes });
    } catch (error) {
        postMessage({ type: 'loadStepResult', requestId, shapes: [], error: String(error) });
    }
}

async function handleComputeMass(requestId: number, shapeId: string, density: number): Promise<void> {
    try {
        await ensureOcct();
        const massProperties: MassProperties | null = occtWrapper.getMassProperties(shapeId, density);
        postMessage({ type: 'massResult', requestId, massProperties });
    } catch (error) {
        postMessage({ type: 'massResult', requestId, massProperties: null, error: String(error) });
    }
}

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    switch (message.type) {
        case 'init':
            wasmBaseUrl = message.wasmBaseUrl;
            break;
        case 'clearShapes':
            ensureOcct().then(() => occtWrapper.clearShapes()).catch(() => {
                /* swallow */
            });
            break;
        case 'loadStep':
            handleLoadStep(message.requestId, message.buffer, message.baseId);
            break;
        case 'deleteShape':
            ensureOcct()
                .then(() => occtWrapper.deleteShape(message.shapeId))
                .catch(() => {
                    /* swallow */
                });
            break;
        case 'computeMass':
            handleComputeMass(message.requestId, message.shapeId, message.density);
            break;
        default:
            break;
    }
});
