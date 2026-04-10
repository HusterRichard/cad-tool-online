import { describe, expect, it } from 'vitest';

import { applyViewerRenderConfig } from '../../../src/webview/applyViewerRenderConfig';
import type { RenderConfigState } from '../../../src/webview/renderConfig';

const config: RenderConfigState = {
    visualPreset: 'cad',
    materialMode: 'phong',
    postProcessing: false,
    edgeLayerVisible: true,
    precisionPreset: 'balanced'
};

describe('applyViewerRenderConfig', () => {
    it('does not report missing capabilities before the viewer is created', () => {
        expect(applyViewerRenderConfig(null, config)).toEqual({
            applied: false,
            missing: []
        });
    });

    it('applies all supported viewer capabilities', () => {
        const calls: Array<[string, unknown]> = [];
        const viewer = {
            setVisualPreset(value: RenderConfigState['visualPreset']) {
                calls.push(['visualPreset', value]);
            },
            setMaterialMode(value: RenderConfigState['materialMode']) {
                calls.push(['materialMode', value]);
            },
            setPostProcessingEnabled(value: boolean) {
                calls.push(['postProcessing', value]);
            },
            setEdgeLayerVisible(value: boolean) {
                calls.push(['edgeLayerVisible', value]);
            }
        };

        expect(applyViewerRenderConfig(viewer, config)).toEqual({
            applied: true,
            missing: []
        });
        expect(calls).toEqual([
            ['visualPreset', 'cad'],
            ['materialMode', 'phong'],
            ['postProcessing', false],
            ['edgeLayerVisible', true]
        ]);
    });
});
