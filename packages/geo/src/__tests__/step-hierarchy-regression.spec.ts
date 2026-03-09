import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import CadGeoFactory from '../../wasm/cad-geo.js';
import type { StepNode, StepReadResult } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../');
const wasmPath = resolve(repoRoot, 'packages/geo/wasm/cad-geo.wasm');
const bulldozerStepPath = resolve(repoRoot, 'ref/model/bulldozer.STEP');

function collectNodes(nodes: StepNode[] | undefined): StepNode[] {
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

describe('STEP hierarchy regression', () => {
    it('preserves sub-assembly hierarchy and resolves part names for bulldozer.STEP', async () => {
        const [wasmBinary, stepData] = await Promise.all([
            readFile(wasmPath),
            readFile(bulldozerStepPath)
        ]);

        const mod = await CadGeoFactory({ wasmBinary });
        const result = JSON.parse(
            mod.readStepFromBuffer(new Uint8Array(stepData), 'bulldozer')
        ) as StepReadResult;

        expect(result.success).toBe(true);
        expect(result.rootNodes?.length).toBeGreaterThan(0);

        const allNodes = collectNodes(result.rootNodes);
        const nestedAssemblies = allNodes.filter((node) => node.type === 'assembly' && (node.children?.length ?? 0) > 0);
        expect(nestedAssemblies.length).toBeGreaterThan(1);

        const placeholderNames = allNodes
            .map((node) => node.name)
            .filter((name) => /^NAUO\d+$/i.test(name));
        expect(placeholderNames).toEqual([]);
    }, 30000);
});
