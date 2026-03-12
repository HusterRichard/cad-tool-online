import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import CadGeoFactory from '../../packages/geo/wasm/cad-geo.js';
import type { StepNode, StepReadResult } from '../../packages/geo/src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const wasmPath = resolve(repoRoot, 'packages/geo/wasm/cad-geo.wasm');

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

let cadGeoModulePromise: Promise<Awaited<ReturnType<typeof CadGeoFactory>>> | null = null;

export { HEX_COLOR_PATTERN };

export function resolveRepoPath(...segments: string[]): string {
    return resolve(repoRoot, ...segments);
}

export function collectStepNodes(nodes: StepNode[] | undefined): StepNode[] {
    if (!nodes) {
        return [];
    }

    const result: StepNode[] = [];
    const visit = (node: StepNode) => {
        result.push(node);
        node.children?.forEach(visit);
    };

    nodes.forEach(visit);
    return result;
}

export function collectStepColors(nodes: StepNode[] | undefined): string[] {
    return collectStepNodes(nodes)
        .map((node) => node.color)
        .filter((color): color is string => Boolean(color));
}

export async function readStepFixture(relativePath: string, baseId = 'fixture'): Promise<StepReadResult> {
    const [mod, stepData] = await Promise.all([
        getCadGeoModule(),
        readFile(resolveRepoPath(relativePath))
    ]);

    return JSON.parse(
        mod.readStepFromBuffer(new Uint8Array(stepData), baseId)
    ) as StepReadResult;
}

async function getCadGeoModule(): Promise<Awaited<ReturnType<typeof CadGeoFactory>>> {
    if (!cadGeoModulePromise) {
        cadGeoModulePromise = readFile(wasmPath).then((wasmBinary) => CadGeoFactory({ wasmBinary }));
    }

    return cadGeoModulePromise;
}
