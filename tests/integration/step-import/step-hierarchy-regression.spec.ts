import { describe, expect, it } from 'vitest';

import { collectStepNodes, readStepFixture } from '../../helpers/stepFixtures';

describe('STEP hierarchy regression', () => {
    it('preserves sub-assembly hierarchy and resolves part names for bulldozer.STEP', async () => {
        const result = await readStepFixture('ref/model/bulldozer.STEP', 'bulldozer');

        expect(result.success).toBe(true);
        expect(result.rootNodes?.length).toBeGreaterThan(0);

        const allNodes = collectStepNodes(result.rootNodes);
        const nestedAssemblies = allNodes.filter((node) => node.type === 'assembly' && (node.children?.length ?? 0) > 0);
        expect(nestedAssemblies.length).toBeGreaterThan(1);

        const placeholderNames = allNodes
            .map((node) => node.name)
            .filter((name) => /^NAUO\d+$/i.test(name));
        expect(placeholderNames).toEqual([]);
    });
});
