import type { RenderConfigState } from './renderConfig';
import { invokeViewerMethod } from './viewerCapabilities';

export interface ViewerRenderConfigApplyResult {
    applied: boolean;
    missing: string[];
}

export function applyViewerRenderConfig(
    viewer: object | null,
    config: Pick<
        RenderConfigState,
        'visualPreset' | 'materialMode' | 'postProcessing' | 'edgeLayerVisible'
    >
): ViewerRenderConfigApplyResult {
    if (!viewer) {
        return {
            applied: false,
            missing: []
        };
    }

    const presetApplied = invokeViewerMethod(viewer, ['setVisualPreset'], config.visualPreset);
    const materialApplied = invokeViewerMethod(viewer, ['setMaterialMode'], config.materialMode);
    const postApplied =
        invokeViewerMethod(viewer, ['setPostProcessingEnabled'], config.postProcessing) ||
        invokeViewerMethod(viewer, ['setOutlineEnabled'], config.postProcessing);
    const edgeApplied =
        invokeViewerMethod(viewer, ['setEdgeLayerVisible'], config.edgeLayerVisible) ||
        invokeViewerMethod(viewer, ['setEdgesVisible'], config.edgeLayerVisible) ||
        invokeViewerMethod(viewer, ['setEdgeVisibility'], config.edgeLayerVisible);

    const missing: string[] = [];
    if (!presetApplied) {
        missing.push('visual preset');
    }
    if (!materialApplied) {
        missing.push('material');
    }
    if (!postApplied) {
        missing.push('post-processing');
    }
    if (!edgeApplied) {
        missing.push('edge layer');
    }

    return {
        applied: missing.length === 0,
        missing
    };
}
