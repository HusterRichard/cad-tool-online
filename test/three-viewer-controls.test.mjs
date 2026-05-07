import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('three viewer remaps orbit controls so left drag pans, middle drag rotates, and right drag is disabled', async () => {
    const source = await readFile(
        new URL('../packages/three/src/ThreeViewer.ts', import.meta.url),
        'utf8'
    );

    const controlsSetupMatch = source.match(
        /\/\/ Controls[\s\S]*?this\.controls\.addEventListener\('start', this\.onControlStartHandler\);/
    );

    assert.ok(controlsSetupMatch, 'expected to find orbit controls setup block');
    const controlsSetupSource = controlsSetupMatch[0];

    assert.match(controlsSetupSource, /this\.controls\.mouseButtons\.LEFT\s*=\s*THREE\.MOUSE\.PAN;/);
    assert.match(
        controlsSetupSource,
        /this\.controls\.mouseButtons\.MIDDLE\s*=\s*THREE\.MOUSE\.ROTATE;/
    );
    assert.match(controlsSetupSource, /this\.controls\.mouseButtons\.RIGHT\s*=\s*null;/);
});
