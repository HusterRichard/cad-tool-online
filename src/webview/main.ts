// WebView entry point
// This file will be bundled by Vite for the WebView

import { ThreeViewer } from '@cadtool-online/three';
import { OcctWrapper, type MassProperties, type StepReadResult } from '@cadtool-online/geo';
import type { EdgeData, Mat3, MeshData, Vec3 } from '@cadtool-online/core';
import { markerCreator, type MbsMarker } from '@cadtool-online/core';
import {
    DEFAULT_RENDER_CONFIG,
    isMaterialMode,
    isPrecisionPreset,
    isVisualPreset,
    normalizeRenderConfig,
    type MaterialMode,
    type PrecisionPreset,
    type RenderConfigState,
    type VisualPreset
} from './renderConfig';
import { invokeViewerMethod } from './viewerCapabilities';
import { MassPropertiesCoordinator, createAfterRenderScheduler } from './massPropertiesCoordinator';

declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

// Extend window for WASM base URL
declare global {
    interface Window {
        WASM_BASE_URL?: string;
    }
}

const vscode = acquireVsCodeApi();

let viewer: ThreeViewer | null = null;
let occt: OcctWrapper | null = null;
let occtInitPromise: Promise<void> | null = null;
let isInitialized = false;

// Loaded shapes tracking with hierarchy support
interface LoadedShape {
    id: string;
    name: string;
    type: 'assembly' | 'part' | 'solid';
    shapeId?: string;
    meshId?: string;
    meshData?: MeshData;
    edgeData?: EdgeData;
    color?: string;
    children?: LoadedShape[];
    visible: boolean;
    parent?: LoadedShape;
}
const loadedShapes: Map<string, LoadedShape> = new Map();
const rootShapes: LoadedShape[] = [];
let selectedShapeId: string | null = null;

// Mesh ID to Shape ID mapping for selection synchronization
const meshIdToShapeId: Map<string, string> = new Map();

// Marker creation state
const createdMarkers: MbsMarker[] = [];
const createdRefFrames = new Map<string, MbsRefFrameEntity>();
const mbsDesignPoints = new Map<string, MbsDesignPointEntity>();
const frameCreationHistory: Array<{ id: string; kind: FrameEntityKind }> = [];
let editingFrameTarget: { id: string; kind: FrameEntityKind } | null = null;

type FrameEntityKind = 'marker' | 'refFrame';
type CanvasInteractionMode = 'none' | 'createMarker' | 'createRefFrame' | 'createDesignPoint' | 'editFrame';
let canvasInteractionMode: CanvasInteractionMode = 'none';

interface MbsRefFrameEntity {
    id: string;
    name: string;
    groupId: string;
    position: Vec3;
    orientation: Mat3;
    relatedMarkerId?: string;
    createdAt: string;
}

interface MbsDesignPointEntity {
    id: string;
    name: string;
    groupId: string;
    position: Vec3;
    direction?: Vec3;
    markerRefId?: string;
    size: number;
    isDirectionReverse: boolean;
    offsetValue: number;
    createdAt: string;
}

interface MbsGroupEntity {
    id: string;
    name: string;
    parentGroupId?: string;
    memberShapeIds: string[];
    createdAt: string;
}

interface MbsJointEntity {
    id: string;
    name: string;
    jointType: string;
    part1: string;
    part2: string;
    createdAt: string;
}

interface MbsMotionEntity {
    id: string;
    name: string;
    motionType: string;
    connectorRef: string;
    createdAt: string;
}

interface FluidSliceEntity {
    id: string;
    name: string;
    shapeRef?: string;
    createdAt: string;
}

interface FluidPortEntity {
    id: string;
    name: string;
    portType: string;
    shapeRef?: string;
    ribSliceRef?: string;
    createdAt: string;
}

const mbsGroups = new Map<string, MbsGroupEntity>();
const mbsJoints = new Map<string, MbsJointEntity>();
const mbsMotions = new Map<string, MbsMotionEntity>();
const fluidSlices = new Map<string, FluidSliceEntity>();
const fluidPorts = new Map<string, FluidPortEntity>();
const shapeSelectionHistory: string[] = [];

// Explode view state
let isExploded = false;
let explodeDistance = 0;
interface ExplodeData {
    meshId: string;
    originalPosition: { x: number; y: number; z: number };
    explodeDirection: { x: number; y: number; z: number };
}
const explodeDataMap: Map<string, ExplodeData> = new Map();

let renderConfig: RenderConfigState = loadRenderConfigState();
const massPropertiesCoordinator = new MassPropertiesCoordinator(createAfterRenderScheduler());

function loadRenderConfigState(): RenderConfigState {
    try {
        const state = vscode.getState() as { renderConfig?: Partial<RenderConfigState> } | undefined;
        return normalizeRenderConfig(state?.renderConfig);
    } catch (error) {
        console.warn('[render-config] Failed to load persisted state, fallback to defaults:', error);
        return { ...DEFAULT_RENDER_CONFIG };
    }
}

function saveRenderConfigState(): void {
    const currentConfig = normalizeRenderConfig(renderConfig);
    renderConfig = currentConfig;

    const existingStateRaw = vscode.getState();
    const existingState = (
        existingStateRaw !== null
        && typeof existingStateRaw === 'object'
    )
        ? existingStateRaw as Record<string, unknown>
        : {};

    vscode.setState({
        ...existingState,
        renderConfig: currentConfig
    });
}

function applyRenderConfigToViewer(): void {
    const config = normalizeRenderConfig(renderConfig);
    renderConfig = config;

    const presetApplied = invokeViewerMethod(viewer, ['setVisualPreset'], config.visualPreset);
    const materialApplied = invokeViewerMethod(viewer, ['setMaterialMode'], config.materialMode);
    const postApplied =
        invokeViewerMethod(viewer, ['setPostProcessingEnabled'], config.postProcessing)
        || invokeViewerMethod(viewer, ['setOutlineEnabled'], config.postProcessing);
    const edgeApplied =
        invokeViewerMethod(viewer, ['setEdgeLayerVisible'], config.edgeLayerVisible)
        || invokeViewerMethod(viewer, ['setEdgesVisible'], config.edgeLayerVisible)
        || invokeViewerMethod(viewer, ['setEdgeVisibility'], config.edgeLayerVisible);

    if (!presetApplied || !materialApplied || !postApplied || !edgeApplied) {
        const missing: string[] = [];
        if (!presetApplied) missing.push('visual preset');
        if (!materialApplied) missing.push('material');
        if (!postApplied) missing.push('post-processing');
        if (!edgeApplied) missing.push('edge layer');
        setStatusInfo(`Some rendering capabilities are not available: ${missing.join(' / ')}`);
    }
}

function getMeshingParamsFromPreset(preset: PrecisionPreset): { linearDeflection: number; angularDeflection: number } {
    switch (preset) {
        case 'coarse':
            return { linearDeflection: 0.002, angularDeflection: 0.45 };
        case 'fine':
            return { linearDeflection: 0.0002, angularDeflection: 0.1 };
        case 'balanced':
        default:
            return { linearDeflection: 0.0005, angularDeflection: 0.2 };
    }
}

// ============================================================================
// UI Helpers
// ============================================================================

function setStatus(text: string): void {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

function setStatusInfo(text: string): void {
    const infoEl = document.getElementById('status-info');
    if (infoEl) {
        infoEl.textContent = text;
    }
}

function showLoading(text: string = 'Loading...'): void {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoading(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    // Reset progress bar
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

function showProgress(percent: number, text?: string): void {
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (progressText) {
        progressText.textContent = text || `${Math.round(percent)}%`;
    }
}

function toggleRenderConfigPanel(forceVisible?: boolean): void {
    const panel = document.getElementById('render-config-panel');
    if (!panel) return;

    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : !panel.classList.contains('show');
    panel.classList.toggle('show', shouldShow);
}

async function remeshLoadedModelWithCurrentPrecision(): Promise<void> {
    if (!viewer || !occt || loadedShapes.size === 0) {
        return;
    }

    renderConfig = normalizeRenderConfig(renderConfig);
    const remeshTargets = Array.from(loadedShapes.values()).filter(
        (shape): shape is LoadedShape & { shapeId: string; meshId: string } => {
            if (!shape.shapeId || !shape.meshId) {
                return false;
            }
            return occt.hasShape(shape.shapeId);
        }
    );

    if (remeshTargets.length === 0) {
        return;
    }

    const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
    showLoading('Updating mesh precision...');
    showProgress(5, 'Preparing remesh...');
    setStatus('Updating mesh precision...');

    await new Promise(resolve => setTimeout(resolve, 0));

    try {
        const shapeIds = remeshTargets.map(shape => shape.shapeId);
        const meshByShapeId = occt.getMeshes(shapeIds, linearDeflection, angularDeflection);
        let updatedCount = 0;

        for (let i = 0; i < remeshTargets.length; i++) {
            const shape = remeshTargets[i];
            const meshData = meshByShapeId.get(shape.shapeId) ?? null;
            const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
            const edgeData = occt.getBrepEdges(shape.shapeId, edgeLinearDeflection);
            if (meshData && meshData.vertices.length > 0) {
                viewer.removeMesh(shape.meshId);
                viewer.addMeshFromData(shape.meshId, meshData, undefined, edgeData ?? undefined);
                viewer.setVisibility(shape.meshId, shape.visible);
                if (shape.color) {
                    const colorHex = parseInt(shape.color.replace('#', ''), 16);
                    viewer.setMeshColor(shape.meshId, colorHex);
                }
                shape.meshData = meshData;
                shape.edgeData = edgeData ?? undefined;
                meshIdToShapeId.set(shape.meshId, shape.id);
                updatedCount++;
            }

            const progress = 10 + ((i + 1) / remeshTargets.length) * 85;
            showProgress(progress, `Remeshing (${i + 1}/${remeshTargets.length})...`);
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        applyRenderConfigToViewer();
        if (selectedShapeId) {
            const selectedShape = loadedShapes.get(selectedShapeId);
            if (selectedShape?.meshId) {
                viewer.clearSelection();
                viewer.select(selectedShape.meshId);
            }
        }
        showProgress(100, 'Complete');
        setStatus('Ready');
        setStatusInfo(`Precision updated: ${updatedCount}/${remeshTargets.length} parts`);
    } catch (error) {
        console.error('Failed to remesh with precision preset:', error);
        setStatus('Mesh precision update failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to update mesh precision: ${error}`
        });
    } finally {
        hideLoading();
    }
}

async function applyPrecisionPreset(preset: PrecisionPreset): Promise<void> {
    renderConfig = normalizeRenderConfig(renderConfig);
    if (renderConfig.precisionPreset === preset) {
        return;
    }

    renderConfig.precisionPreset = preset;
    saveRenderConfigState();

    if (loadedShapes.size > 0) {
        await remeshLoadedModelWithCurrentPrecision();
        return;
    }

    setStatusInfo(`Mesh precision preset: ${preset}`);
}

function applyRenderControls(
    updates: Partial<Pick<RenderConfigState, 'visualPreset' | 'materialMode' | 'postProcessing' | 'edgeLayerVisible'>>
): void {
    renderConfig = normalizeRenderConfig({ ...normalizeRenderConfig(renderConfig), ...updates });
    saveRenderConfigState();
    applyRenderConfigToViewer();
}

function setupRenderConfigUI(): void {
    renderConfig = normalizeRenderConfig(renderConfig);
    const presetSelect = document.getElementById('render-visual-preset') as HTMLSelectElement | null;
    const materialSelect = document.getElementById('render-material-mode') as HTMLSelectElement | null;
    const postCheckbox = document.getElementById('render-postprocessing') as HTMLInputElement | null;
    const edgeCheckbox = document.getElementById('render-edge-layer') as HTMLInputElement | null;
    const precisionSelect = document.getElementById('render-precision') as HTMLSelectElement | null;

    if (presetSelect) {
        presetSelect.value = renderConfig.visualPreset;
        presetSelect.addEventListener('change', () => {
            const preset = presetSelect.value;
            if (!isVisualPreset(preset)) {
                return;
            }
            applyRenderControls({ visualPreset: preset });
        });
    }

    if (materialSelect) {
        materialSelect.value = renderConfig.materialMode;
        materialSelect.addEventListener('change', () => {
            const mode = materialSelect.value;
            if (!isMaterialMode(mode)) {
                return;
            }
            applyRenderControls({ materialMode: mode });
        });
    }

    if (postCheckbox) {
        postCheckbox.checked = renderConfig.postProcessing;
        postCheckbox.addEventListener('change', () => {
            applyRenderControls({ postProcessing: postCheckbox.checked });
        });
    }

    if (edgeCheckbox) {
        edgeCheckbox.checked = renderConfig.edgeLayerVisible;
        edgeCheckbox.addEventListener('change', () => {
            applyRenderControls({ edgeLayerVisible: edgeCheckbox.checked });
        });
    }

    if (precisionSelect) {
        precisionSelect.value = renderConfig.precisionPreset;
        precisionSelect.addEventListener('change', () => {
            const preset = precisionSelect.value;
            if (isPrecisionPreset(preset)) {
                void applyPrecisionPreset(preset);
            }
        });
    }

    document.getElementById('btn-render-config')?.addEventListener('click', () => {
        toggleRenderConfigPanel();
    });
    document.getElementById('render-config-close')?.addEventListener('click', () => {
        toggleRenderConfigPanel(false);
    });

    applyRenderConfigToViewer();
}

function updateModelTree(): void {
    const treeEl = document.getElementById('model-tree');
    if (!treeEl) return;

    if (rootShapes.length === 0) {
        treeEl.innerHTML = '<div style="color: #808080; font-style: italic;">No model loaded</div>';
        return;
    }

    treeEl.innerHTML = '';
    rootShapes.forEach(shape => {
        const nodeEl = createTreeNode(shape, 0);
        treeEl.appendChild(nodeEl);
    });
}

function createTreeNode(shape: LoadedShape, level: number): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tree-node-container';
    container.style.marginLeft = `${level * 16}px`;

    const node = document.createElement('div');
    node.className = 'tree-node';
    if (shape.id === selectedShapeId) {
        node.classList.add('selected');
    }
    node.dataset.shapeId = shape.id;

    // Expand/collapse button for assemblies
    if (shape.children && shape.children.length > 0) {
        const expandBtn = document.createElement('span');
        expandBtn.className = 'expand-btn';
        expandBtn.textContent = '>';
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNodeExpand(container);
        });
        node.appendChild(expandBtn);
    } else {
        const spacer = document.createElement('span');
        spacer.style.width = '16px';
        spacer.style.display = 'inline-block';
        node.appendChild(spacer);
    }

    // Visibility toggle
    const visibilityBtn = document.createElement('span');
    visibilityBtn.className = 'visibility-btn';
    visibilityBtn.textContent = shape.visible ? 'ON' : 'OFF';
    visibilityBtn.title = shape.visible ? 'Hide' : 'Show';
    visibilityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVisibility(shape.id);
    });
    node.appendChild(visibilityBtn);

    // Icon based on type
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = shape.type === 'assembly' ? '[A]' : (shape.type === 'part' ? '[P]' : '[S]');
    node.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = shape.name;
    node.appendChild(name);

    node.addEventListener('click', () => selectShape(shape.id));

    container.appendChild(node);

    // Children
    if (shape.children && shape.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        childrenContainer.style.display = 'none'; // Initially collapsed

        shape.children.forEach(child => {
            const childNode = createTreeNode(child, level + 1);
            childrenContainer.appendChild(childNode);
        });

        container.appendChild(childrenContainer);
    }

    return container;
}

function toggleNodeExpand(container: HTMLElement): void {
    const expandBtn = container.querySelector('.expand-btn');
    const childrenContainer = container.querySelector('.tree-children') as HTMLElement;

    if (expandBtn && childrenContainer) {
        const isExpanded = childrenContainer.style.display !== 'none';
        childrenContainer.style.display = isExpanded ? 'none' : 'block';
        expandBtn.textContent = isExpanded ? '>' : 'v';
    }
}

function toggleVisibility(shapeId: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    shape.visible = !shape.visible;

    // Update viewer
    if (viewer && shape.meshId) {
        viewer.setVisibility(shape.meshId, shape.visible);
    }

    // Recursively update children
    if (shape.children) {
        shape.children.forEach(child => {
            setVisibilityRecursive(child, shape.visible);
        });
    }

    updateModelTree();
}

function setVisibilityRecursive(shape: LoadedShape, visible: boolean): void {
    shape.visible = visible;
    if (viewer && shape.meshId) {
        viewer.setVisibility(shape.meshId, visible);
    }
    if (shape.children) {
        shape.children.forEach(child => setVisibilityRecursive(child, visible));
    }
}

function showColorPicker(shapeId: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    // Create a simple color picker using HTML5 input
    const input = document.createElement('input');
    input.type = 'color';
    input.value = shape.color || '#808080';
    input.style.position = 'absolute';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const newColor = (e.target as HTMLInputElement).value;
        changeShapeColor(shapeId, newColor);
        document.body.removeChild(input);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }
        }, 100);
    });

    input.click();
}

function changeShapeColor(shapeId: string, newColor: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    // Update shape color
    shape.color = newColor;

    // Apply to viewer
    if (viewer && shape.meshId) {
        const colorHex = parseInt(newColor.replace('#', ''), 16);
        viewer.setMeshColor(shape.meshId, colorHex);
    }

    // Update properties panel if this shape is selected
    if (selectedShapeId === shapeId) {
        updatePropertiesPanel(shapeId);
    }
}

type MassPropertiesViewState =
    | { kind: 'hidden' }
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; value: MassProperties };

function bindColorChangeButtons(propsEl: HTMLElement): void {
    propsEl.querySelectorAll('.color-change-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetShapeId = (e.target as HTMLElement).dataset.shapeId;
            if (targetShapeId) {
                showColorPicker(targetShapeId);
            }
        });
    });
}

function renderPropertiesPanel(shape: LoadedShape, massState: MassPropertiesViewState): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    let html = '';

    // Basic info
    html += createPropertyRow('ID', shape.id);
    html += createPropertyRow('Name', shape.name);
    html += createPropertyRow('Type', shape.type);

    // Color info with preview
    if (shape.color) {
        html += `<div class="property-row">
            <span class="property-label">Color</span>
            <span class="property-value" style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 20px; height: 20px; background: ${shape.color}; border: 1px solid #666; border-radius: 3px;"></span>
                <span>${shape.color}</span>
                <button class="color-change-btn" data-shape-id="${shape.id}" style="margin-left: auto; padding: 2px 8px; background: #007acc; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Change</button>
            </span>
        </div>`;
    }

    // Mesh info
    if (shape.meshData) {
        const vertexCount = shape.meshData.vertices.length / 3;
        const triangleCount = shape.meshData.indices.length / 3;
        html += createPropertyRow('Vertices', vertexCount.toLocaleString());
        html += createPropertyRow('Triangles', triangleCount.toLocaleString());
    }

    if (massState.kind !== 'hidden') {
        html += '<div style="margin-top: 8px; font-weight: bold; color: #9cdcfe;">Mass Properties</div>';
    }

    if (massState.kind === 'loading') {
        html += createPropertyRow('Status', 'Computing...');
    } else if (massState.kind === 'unavailable') {
        html += createPropertyRow('Status', 'Unavailable');
    } else if (massState.kind === 'ready') {
        html += createPropertyRow('Volume', `${massState.value.volume.toFixed(6)} mm^3`);
        html += createPropertyRow('Surface', `${massState.value.surfaceArea.toFixed(6)} mm^2`);
        html += createPropertyRow('Mass', `${massState.value.mass.toFixed(6)} kg`);
        html += createPropertyRow('CoM X', `${massState.value.centerOfMass.x.toFixed(4)} mm`);
        html += createPropertyRow('CoM Y', `${massState.value.centerOfMass.y.toFixed(4)} mm`);
        html += createPropertyRow('CoM Z', `${massState.value.centerOfMass.z.toFixed(4)} mm`);
    }

    propsEl.innerHTML = html;
    bindColorChangeButtons(propsEl);
}

function updatePropertiesPanel(shapeId: string | null): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    if (!shapeId) {
        massPropertiesCoordinator.cancelPending();
        setPanelMode('properties', '属性');
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">选择对象以查看属性</div>';
        return;
    }

    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        massPropertiesCoordinator.cancelPending();
        setPanelMode('properties', '属性');
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">Shape not found</div>';
        return;
    }

    setPanelMode('properties', '属性-零件');

    const occtForRequest = occt;
    const requestResult = massPropertiesCoordinator.request(
        { uiShapeId: shape.id, kernelShapeId: shape.shapeId },
        occtForRequest
            ? {
                hasShape: (targetShapeId: string) => occtForRequest.hasShape(targetShapeId),
                getMass: (targetShapeId: string) => {
                    try {
                        return occtForRequest.getMassProperties(targetShapeId);
                    } catch (error) {
                        console.warn('Failed to get mass properties:', error);
                        return null;
                    }
                }
            }
            : null,
        (resolvedShapeId, massProperties) => {
            if (selectedShapeId !== resolvedShapeId) {
                return;
            }
            const resolvedShape = loadedShapes.get(resolvedShapeId);
            if (!resolvedShape) {
                return;
            }
            if (massProperties) {
                renderPropertiesPanel(resolvedShape, { kind: 'ready', value: massProperties });
            } else {
                renderPropertiesPanel(resolvedShape, { kind: 'unavailable' });
            }
        }
    );

    let massState: MassPropertiesViewState = shape.shapeId
        ? { kind: 'unavailable' }
        : { kind: 'hidden' };

    if (requestResult.state === 'scheduled') {
        massState = { kind: 'loading' };
    } else if (requestResult.state === 'cached') {
        massState = requestResult.massProperties
            ? { kind: 'ready', value: requestResult.massProperties }
            : { kind: 'unavailable' };
    }

    renderPropertiesPanel(shape, massState);
}

function createPropertyRow(label: string, value: string): string {
    return `<div class="property-row">
        <span class="property-label">${label}</span>
        <span class="property-value">${value}</span>
    </div>`;
}

function selectShape(shapeId: string, fromViewer: boolean = false): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        console.warn('[selectShape] Shape not found:', shapeId);
        return;
    }

    selectedShapeId = shapeId;
    rememberShapeSelection(shapeId);

    // Update selection in tree
    const prevSelected = document.querySelector('.tree-node.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    const newSelected = document.querySelector(`.tree-node[data-shape-id="${shapeId}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');

        // Auto-expand parent nodes
        expandParentNodes(newSelected);

        // Scroll into view
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update 3D selection (only if not triggered from viewer to avoid loop)
    if (viewer && !fromViewer) {
        viewer.clearSelection();
        if (shape.meshId) {
            viewer.select(shape.meshId);
        }
    }

    // Update properties panel
    updatePropertiesPanel(shapeId);

    // Notify extension
    vscode.postMessage({ command: 'selectShape', shapeId });
}

function rememberShapeSelection(shapeId: string): void {
    const last = shapeSelectionHistory.at(-1);
    if (last !== shapeId) {
        shapeSelectionHistory.push(shapeId);
    }

    if (shapeSelectionHistory.length > 20) {
        shapeSelectionHistory.splice(0, shapeSelectionHistory.length - 20);
    }
}

/**
 * Auto-expand all parent nodes to make the selected node visible
 */
function expandParentNodes(nodeElement: Element): void {
    let current = nodeElement.parentElement;

    while (current) {
        // Check if this is a tree-children container
        if (current.classList.contains('tree-children')) {
            current.style.display = 'block';

            // Find and update the expand button
            const container = current.parentElement;
            if (container) {
                const expandBtn = container.querySelector('.expand-btn');
                if (expandBtn) {
                    expandBtn.textContent = 'v';
                }
            }
        }

        current = current.parentElement;
    }
}

// ============================================================================
// OCCT Initialization
// ============================================================================

async function initOcct(): Promise<void> {
    if (occt && occt.isInitialized()) return;

    // If initialization is already in progress, wait for it
    if (occtInitPromise) {
        await occtInitPromise;
        return;
    }

    setStatus('Initializing OCCT...');
    occt = new OcctWrapper();
    occtInitPromise = occt.initialize();
    await occtInitPromise;
    setStatus('Ready');
}

// ============================================================================
// STEP File Loading
// ============================================================================

function toArrayBuffer(fileContent: unknown): ArrayBuffer {
    if (fileContent instanceof ArrayBuffer) {
        return fileContent;
    }
    if (fileContent instanceof Uint8Array) {
        return fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength);
    }
    if (Array.isArray(fileContent)) {
        return new Uint8Array(fileContent).buffer;
    }
    throw new Error('Unsupported file content format');
}

async function loadStepFile(fileName: string, fileContent: unknown): Promise<void> {
    console.log('[loadStepFile] Starting to load:', fileName);
    renderConfig = normalizeRenderConfig(renderConfig);

    // Always wait for OCCT to be fully initialized
    await initOcct();
    console.log('[loadStepFile] OCCT initialized');

    // Ensure old scene/WASM shapes are fully cleaned before importing a new file
    clearScene();
    occt?.clearShapes();

    showLoading(`Loading ${fileName}...`);
    showProgress(0, 'Reading file...');
    setStatus(`Loading ${fileName}...`);

    // Yield to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('[loadStepFile] UI updated, starting decode');

    try {
        const arrayBuffer = toArrayBuffer(fileContent);
        console.log('[loadStepFile] Received binary file data, size:', arrayBuffer.byteLength);

        showProgress(10, 'Parsing STEP file...');
        // Yield to allow UI to update before heavy WASM call
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log('[loadStepFile] Calling readStep...');

        // Read STEP file
        const baseId = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        const result: StepReadResult = await occt!.readStep(arrayBuffer, baseId);
        console.log('[loadStepFile] readStep result:', result);

        if (!result.success) {
            throw new Error(result.error || 'Failed to read STEP file');
        }

        showProgress(30, 'Building hierarchy...');
        setStatus('Building model hierarchy...');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Build hierarchy from rootNodes if available
        if (result.rootNodes && result.rootNodes.length > 0) {
            console.log('[loadStepFile] Building hierarchy from', result.rootNodes.length, 'root nodes');

            // Collect only leaf renderable shapes.
            // This avoids rendering both parent and child solids at the same time (z-fighting / ghosting).
            const shapesToMesh: Array<{ node: any }> = [];
            const hasRenderableDescendant = (node: any): boolean => {
                if (!node?.children || !Array.isArray(node.children)) {
                    return false;
                }
                return node.children.some((child: any) => Boolean(child.shapeId) || hasRenderableDescendant(child));
            };
            const collectShapes = (node: any) => {
                if (node.shapeId && !hasRenderableDescendant(node)) {
                    shapesToMesh.push({ node });
                }
                if (node.children) {
                    node.children.forEach((child: any) => {
                        collectShapes(child);
                    });
                }
            };
            result.rootNodes.forEach((root) => collectShapes(root));

            showProgress(40, `Generating meshes (0/${shapesToMesh.length})...`);
            console.log('[loadStepFile] Total shapes to mesh:', shapesToMesh.length);

            const validShapeIds = Array.from(new Set(
                shapesToMesh
                    .map(({ node }) => node.shapeId as string | undefined)
                    .filter((shapeId): shapeId is string => Boolean(shapeId) && occt!.hasShape(shapeId))
            ));
            const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
            const meshByShapeId = occt!.getMeshes(validShapeIds, linearDeflection, angularDeflection);
            const edgeByShapeId = new Map<string, EdgeData | null>();
            validShapeIds.forEach((shapeId) => {
                const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
                edgeByShapeId.set(shapeId, occt!.getBrepEdges(shapeId, edgeLinearDeflection));
            });

            // Attach meshes to all nodes
            for (let i = 0; i < shapesToMesh.length; i++) {
                const {node} = shapesToMesh[i];
                if (node.shapeId) {
                    const meshData = meshByShapeId.get(node.shapeId) ?? null;
                    if (meshData && meshData.vertices.length > 0) {
                        node._meshData = meshData;
                    }
                    const edgeData = edgeByShapeId.get(node.shapeId) ?? null;
                    if (edgeData && edgeData.vertices.length > 0) {
                        node._edgeData = edgeData;
                    }
                }

                // Update progress (40% to 80% for mesh generation)
                const meshProgress = 40 + ((i + 1) / shapesToMesh.length) * 40;
                showProgress(meshProgress, `Generating meshes (${i + 1}/${shapesToMesh.length})...`);

                // Yield to UI thread periodically
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            showProgress(85, 'Building scene...');
            await new Promise(resolve => setTimeout(resolve, 10));

            // Build hierarchy tree
            let meshCount = 0;
            rootShapes.length = 0;
            loadedShapes.clear();

            const buildShapeTree = (node: any, parent?: LoadedShape): LoadedShape => {
                const shape: LoadedShape = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    shapeId: node.shapeId,
                    color: node.color,
                    visible: true,
                    parent
                };

                // Add mesh to viewer if available
                if (node._meshData) {
                    const meshId = `mesh_${node.id}`;
                    if (viewer) {
                        viewer.addMeshFromData(meshId, node._meshData, undefined, node._edgeData);

                        // Apply color if available
                        if (node.color) {
                            const colorHex = parseInt(node.color.replace('#', ''), 16);
                            viewer.setMeshColor(meshId, colorHex);
                        }
                    }
                    shape.meshId = meshId;
                    shape.meshData = node._meshData;
                    shape.edgeData = node._edgeData;

                    // Register mesh ID to shape ID mapping for selection sync
                    meshIdToShapeId.set(meshId, shape.id);

                    meshCount++;
                }

                // Process children
                if (node.children && node.children.length > 0) {
                    shape.children = node.children.map((child: any) => buildShapeTree(child, shape));
                }

                loadedShapes.set(shape.id, shape);
                return shape;
            };

            result.rootNodes.forEach(root => {
                rootShapes.push(buildShapeTree(root));
            });

            showProgress(95, 'Finalizing...');

            // Fit view to show all shapes
            if (viewer && meshCount > 0) {
                viewer.fitToView();
            }
            applyRenderConfigToViewer();

            // Update UI
            updateModelTree();
            showProgress(100, 'Complete');
            setStatus('Ready');
            setStatusInfo(`${meshCount} parts loaded (${result.rootNodes.length} assemblies)`);

            // Select first shape
            if (rootShapes.length > 0) {
                selectShape(rootShapes[0].id);
            }

            vscode.postMessage({
                command: 'alert',
                text: `Successfully loaded ${meshCount} parts from ${fileName}`
            });

        } else {
            // Fallback to legacy flat structure
            console.log('[loadStepFile] Using legacy flat structure');
            showProgress(30, `Generating mesh (0/${result.shapes.length})...`);
            setStatus(`Generating mesh for ${result.shapes.length} shapes...`);
            await new Promise(resolve => setTimeout(resolve, 10));

            let addedCount = 0;
            rootShapes.length = 0;
            loadedShapes.clear();

            const totalShapes = result.shapes.length;
            const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
            const meshByShapeId = occt!.getMeshes(result.shapes, linearDeflection, angularDeflection);
            for (let i = 0; i < totalShapes; i++) {
                const shapeId = result.shapes[i];
                const meshData = meshByShapeId.get(shapeId) ?? null;
                const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
                const edgeData = occt!.getBrepEdges(shapeId, edgeLinearDeflection);
                if (meshData && meshData.vertices.length > 0) {
                    const meshId = `mesh_${shapeId}`;
                    const shape: LoadedShape = {
                        id: shapeId,
                        name: shapeId,
                        type: 'solid',
                        shapeId,
                        meshId,
                        meshData,
                        edgeData: edgeData ?? undefined,
                        visible: true
                    };

                    // Add to viewer
                    if (viewer) {
                        viewer.addMeshFromData(meshId, meshData, undefined, edgeData ?? undefined);
                    }

                    // Register mesh ID to shape ID mapping for selection sync
                    meshIdToShapeId.set(meshId, shapeId);

                    loadedShapes.set(shapeId, shape);
                    rootShapes.push(shape);
                    addedCount++;
                }

                // Update progress (30% to 90% for mesh generation)
                const meshProgress = 30 + ((i + 1) / totalShapes) * 60;
                showProgress(meshProgress, `Generating mesh (${i + 1}/${totalShapes})...`);

                // Yield to UI thread periodically
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            showProgress(95, 'Finalizing...');

            // Fit view to show all shapes
            if (viewer && addedCount > 0) {
                viewer.fitToView();
            }
            applyRenderConfigToViewer();

            // Update UI
            updateModelTree();
            showProgress(100, 'Complete');
            setStatus('Ready');
            setStatusInfo(`${addedCount} shapes loaded`);

            // Select first shape
            if (result.shapes.length > 0) {
                selectShape(result.shapes[0]);
            }

            vscode.postMessage({
                command: 'alert',
                text: `Successfully loaded ${addedCount} shapes from ${fileName}`
            });
        }

    } catch (error) {
        console.error('Failed to load STEP file:', error);
        setStatus('Error loading file');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to load STEP file: ${error}`
        });
    } finally {
        hideLoading();
    }
}

// ============================================================================
// Export Model Functions
// ============================================================================

/**
 * Export model data to JSON format
 */
function exportModel(): void {
    if (rootShapes.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'No model loaded to export'
        });
        return;
    }

    setStatus('Preparing export data...');

    try {
        // Build export data structure
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            parts: [] as Array<{
                id: string;
                name: string;
                type: string;
                color?: string;
                properties?: {
                    vertices?: number;
                    triangles?: number;
                    volume?: number;
                    surfaceArea?: number;
                    mass?: number;
                    centerOfMass?: { x: number; y: number; z: number };
                };
                boundingBox?: {
                    min: { x: number; y: number; z: number };
                    max: { x: number; y: number; z: number };
                    size: { x: number; y: number; z: number };
                };
                children?: string[];
            }>
        };

        // Recursively collect all parts
        const collectParts = (shape: LoadedShape): void => {
            const partData: typeof exportData.parts[0] = {
                id: shape.id,
                name: shape.name,
                type: shape.type,
                color: shape.color
            };

            // Add mesh properties if available
            if (shape.meshData) {
                const vertexCount = shape.meshData.vertices.length / 3;
                const triangleCount = shape.meshData.indices.length / 3;

                partData.properties = {
                    vertices: vertexCount,
                    triangles: triangleCount
                };

                // Calculate bounding box
                const vertices = shape.meshData.vertices;
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

                for (let i = 0; i < vertices.length; i += 3) {
                    minX = Math.min(minX, vertices[i]);
                    minY = Math.min(minY, vertices[i + 1]);
                    minZ = Math.min(minZ, vertices[i + 2]);
                    maxX = Math.max(maxX, vertices[i]);
                    maxY = Math.max(maxY, vertices[i + 1]);
                    maxZ = Math.max(maxZ, vertices[i + 2]);
                }

                partData.boundingBox = {
                    min: { x: minX, y: minY, z: minZ },
                    max: { x: maxX, y: maxY, z: maxZ },
                    size: {
                        x: maxX - minX,
                        y: maxY - minY,
                        z: maxZ - minZ
                    }
                };
            }

            // Get mass properties if available
            if (occt && shape.shapeId && occt.hasShape(shape.shapeId)) {
                try {
                    const massProps = occt.getMassProperties(shape.shapeId);
                    if (massProps && partData.properties) {
                        partData.properties.volume = massProps.volume;
                        partData.properties.surfaceArea = massProps.surfaceArea;
                        partData.properties.mass = massProps.mass;
                        partData.properties.centerOfMass = massProps.centerOfMass;
                    }
                } catch (e) {
                    console.warn('Failed to get mass properties for export:', e);
                }
            }

            // Add children IDs
            if (shape.children && shape.children.length > 0) {
                partData.children = shape.children.map(child => child.id);
            }

            exportData.parts.push(partData);

            // Recursively process children
            if (shape.children) {
                shape.children.forEach(collectParts);
            }
        };

        rootShapes.forEach(collectParts);

        // Convert to JSON string with formatting
        const jsonData = JSON.stringify(exportData, null, 2);

        // Send to extension to save file
        vscode.postMessage({
            command: 'exportModel',
            data: jsonData
        });

        setStatus('Ready');
        setStatusInfo(`Exported ${exportData.parts.length} parts`);

    } catch (error) {
        console.error('Failed to export model:', error);
        setStatus('Export failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to export model: ${error}`
        });
    }
}

interface CadtoolConfigExportData {
    group: Array<{
        name: string;
        parts: string[];
    }>;
    marker: Array<{
        name: string;
        groupRef: string;
        position?: Vec3;
        direction?: Vec3;
        refMarker?: boolean;
        relatedMarkerRef?: string;
    }>;
    designPoint: Array<{
        name: string;
        groupRef: string;
        markerRef?: string;
        position: Vec3;
        direction?: Vec3;
        size?: number;
        isDirectionReverse?: boolean;
        offsetValue?: number;
    }>;
    connector: Array<{
        name: string;
        connectorType: string;
        part1: string;
        part2: string;
    }>;
    motion: Array<{
        name: string;
        motionType: string;
        connectorRef: string;
    }>;
    fluidPort: Array<{
        name: string;
        portType: string;
        ribSliceRef: string;
    }>;
    ribSlice: Array<{
        name: string;
    }>;
    gravity: unknown[];
    medium: unknown[];
}

interface CadtoolConfigImportStats {
    groups: number;
    markers: number;
    designPoints: number;
    connectors: number;
    motions: number;
    ribSlices: number;
    fluidPorts: number;
    skipped: number;
    warningCount: number;
    warnings: string[];
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_IMPORT_STATS: CadtoolConfigImportStats = {
    groups: 0,
    markers: 0,
    designPoints: 0,
    connectors: 0,
    motions: 0,
    ribSlices: 0,
    fluidPorts: 0,
    skipped: 0,
    warningCount: 0,
    warnings: []
};

function createImportStats(): CadtoolConfigImportStats {
    return {
        ...DEFAULT_IMPORT_STATS,
        warnings: []
    };
}

function isJsonRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function addImportWarning(stats: CadtoolConfigImportStats, warning: string): void {
    stats.warningCount += 1;
    if (stats.warnings.length < 8) {
        stats.warnings.push(warning);
    }
}

function getConfigArray(config: JsonRecord, key: string, stats: CadtoolConfigImportStats): unknown[] {
    const value = config[key];
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        addImportWarning(stats, `Top-level field "${key}" is not an array and was ignored.`);
        return [];
    }
    return value;
}

function parseVector3(value: unknown): { x: number; y: number; z: number } | null {
    if (Array.isArray(value) && value.length === 3) {
        const [x, y, z] = value;
        if ([x, y, z].every(axis => typeof axis === 'number' && Number.isFinite(axis))) {
            return { x: x as number, y: y as number, z: z as number };
        }
        return null;
    }

    if (isJsonRecord(value)) {
        const x = value.x;
        const y = value.y;
        const z = value.z;
        if (
            typeof x === 'number'
            && Number.isFinite(x)
            && typeof y === 'number'
            && Number.isFinite(y)
            && typeof z === 'number'
            && Number.isFinite(z)
        ) {
            return { x, y, z };
        }
    }

    return null;
}

function normalizeVector(vector: { x: number; y: number; z: number } | null): { x: number; y: number; z: number } | null {
    if (!vector) {
        return null;
    }
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length <= 1e-9) {
        return null;
    }

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function cloneVec3(vec: Vec3): Vec3 {
    return { x: vec.x, y: vec.y, z: vec.z };
}

function cloneMat3(mat: Mat3): Mat3 {
    return { m: [...mat.m] };
}

function createOrientationFromNormal(normal: Vec3): Mat3 {
    const normalized = normalizeVector(normal) ?? { x: 0, y: 0, z: 1 };
    let tempX: Vec3;
    if (Math.abs(normalized.z) > 0.9) {
        tempX = { x: 1, y: 0, z: 0 };
    } else {
        tempX = { x: 0, y: 0, z: 1 };
    }

    const yAxis = normalizeVector({
        x: normalized.y * tempX.z - normalized.z * tempX.y,
        y: normalized.z * tempX.x - normalized.x * tempX.z,
        z: normalized.x * tempX.y - normalized.y * tempX.x
    }) ?? { x: 0, y: 1, z: 0 };

    const xAxis = normalizeVector({
        x: yAxis.y * normalized.z - yAxis.z * normalized.y,
        y: yAxis.z * normalized.x - yAxis.x * normalized.z,
        z: yAxis.x * normalized.y - yAxis.y * normalized.x
    }) ?? { x: 1, y: 0, z: 0 };

    return {
        m: [
            xAxis.x, xAxis.y, xAxis.z,
            yAxis.x, yAxis.y, yAxis.z,
            normalized.x, normalized.y, normalized.z
        ]
    };
}

function orientationToDirection(orientation: Mat3): Vec3 {
    const direction = normalizeVector({
        x: orientation.m[2],
        y: orientation.m[5],
        z: orientation.m[8]
    });
    return direction ?? { x: 0, y: 0, z: 1 };
}

function formatVec3(vec: Vec3): string {
    return `${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)}`;
}

function recordFrameCreation(id: string, kind: FrameEntityKind): void {
    frameCreationHistory.push({ id, kind });
    if (frameCreationHistory.length > 200) {
        frameCreationHistory.splice(0, frameCreationHistory.length - 200);
    }
}

function setCanvasCursor(cursor: string): void {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.style.cursor = cursor;
    }
}

function resetCanvasInteraction(): void {
    editingFrameTarget = null;
    canvasInteractionMode = 'none';
    setCanvasCursor('default');
}

function resolveLatestExistingFrameFromHistory(): { index: number; id: string; kind: FrameEntityKind } | null {
    for (let i = frameCreationHistory.length - 1; i >= 0; i -= 1) {
        const item = frameCreationHistory[i];
        const exists = item.kind === 'marker'
            ? createdMarkers.some((marker) => marker.id === item.id)
            : createdRefFrames.has(item.id);

        if (exists) {
            return { index: i, id: item.id, kind: item.kind };
        }

        frameCreationHistory.splice(i, 1);
    }

    return null;
}

function buildShapeNameToIdMap(): Map<string, string> {
    const shapeNameToId = new Map<string, string>();
    loadedShapes.forEach((shape) => {
        if (!shapeNameToId.has(shape.name)) {
            shapeNameToId.set(shape.name, shape.id);
        }
    });
    return shapeNameToId;
}

function resolveShapeRef(value: string, shapeNameToId: Map<string, string>): { resolved: string; matched: boolean } {
    const mapped = shapeNameToId.get(value);
    if (mapped) {
        return { resolved: mapped, matched: true };
    }
    return { resolved: value, matched: false };
}

function clearCadtoolRuntimeEntities(): void {
    if (viewer) {
        createdMarkers.forEach(marker => {
            viewer.removeFrame(marker.id);
        });
        createdRefFrames.forEach((refFrame) => {
            viewer.removeFrame(refFrame.id);
        });
    }

    createdMarkers.length = 0;
    createdRefFrames.clear();
    mbsDesignPoints.clear();
    frameCreationHistory.length = 0;
    resetCanvasInteraction();
    mbsGroups.clear();
    mbsJoints.clear();
    mbsMotions.clear();
    fluidSlices.clear();
    fluidPorts.clear();
}

function importCadtoolConfig(data: unknown, sourceName?: string): void {
    if (!isJsonRecord(data)) {
        setStatus('CADTool config import failed');
        vscode.postMessage({
            command: 'alert',
            text: 'CADTool config import failed: payload must be a JSON object.'
        });
        return;
    }

    const sourceLabel = sourceName ? ` from ${sourceName}` : '';
    setStatus(`Importing CADTool config${sourceLabel}...`);

    const stats = createImportStats();
    const shapeNameToId = buildShapeNameToIdMap();
    const groupNameToId = new Map<string, string>();
    const ribSliceNames = new Set<string>();

    clearCadtoolRuntimeEntities();

    const groups = getConfigArray(data, 'group', stats);
    groups.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `group[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `group[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const partsRaw = entry.parts;
        const parts: string[] = Array.isArray(partsRaw)
            ? partsRaw
                .map(toNonEmptyString)
                .filter((value): value is string => Boolean(value))
            : [];

        if (partsRaw !== undefined && !Array.isArray(partsRaw)) {
            addImportWarning(stats, `group[${index}].parts is not an array and was ignored.`);
        }

        const memberShapeIds: string[] = [];
        parts.forEach((partName) => {
            const resolvedPart = resolveShapeRef(partName, shapeNameToId);
            if (!resolvedPart.matched && loadedShapes.size > 0) {
                addImportWarning(stats, `group "${name}" references unknown part "${partName}", keeping raw reference.`);
            }
            if (!memberShapeIds.includes(resolvedPart.resolved)) {
                memberShapeIds.push(resolvedPart.resolved);
            }
        });

        const groupId = nextEntityId('group', mbsGroups.size);
        const group: MbsGroupEntity = {
            id: groupId,
            name,
            memberShapeIds,
            createdAt: new Date().toISOString()
        };
        mbsGroups.set(groupId, group);

        if (groupNameToId.has(name)) {
            addImportWarning(stats, `Duplicate group name "${name}" found; latest entry is used for references.`);
        }
        groupNameToId.set(name, groupId);
        stats.groups += 1;
    });

    const markerNameToId = new Map<string, string>();
    const frameNameToFrame = new Map<string, { id: string; kind: FrameEntityKind }>();

    const markers = getConfigArray(data, 'marker', stats);
    markers.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `marker[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `marker[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const groupRef = toNonEmptyString(entry.groupRef);
        const partRef = toNonEmptyString(entry.partRef);
        const relatedMarkerRef = toNonEmptyString(entry.relatedMarkerRef) ?? toNonEmptyString(entry.markerRef);
        const refMarkerFlag = entry.refMarker === true || entry.refMarker === 'true' || Boolean(relatedMarkerRef);

        let groupId: string | undefined;
        if (groupRef) {
            groupId = groupNameToId.get(groupRef) ?? shapeNameToId.get(groupRef) ?? groupRef;
            if (!groupNameToId.has(groupRef) && !shapeNameToId.has(groupRef)) {
                addImportWarning(stats, `marker "${name}" references unknown groupRef "${groupRef}", keeping raw reference.`);
            }
        } else if (partRef) {
            groupId = shapeNameToId.get(partRef) ?? partRef;
            if (!shapeNameToId.has(partRef) && loadedShapes.size > 0) {
                addImportWarning(stats, `marker "${name}" references unknown partRef "${partRef}", keeping raw reference.`);
            }
        }

        if (!groupId) {
            groupId = selectedShapeId ?? '__unassigned__';
            addImportWarning(stats, `marker "${name}" has no groupRef/partRef; assigned to "${groupId}".`);
        }

        const parsedPosition = parseVector3(entry.position);
        const parsedDirection = normalizeVector(parseVector3(entry.direction));

        if (entry.position !== undefined && !parsedPosition) {
            addImportWarning(stats, `marker "${name}" has invalid position; defaulting to (0,0,0).`);
        }
        if (entry.direction !== undefined && !parsedDirection) {
            addImportWarning(stats, `marker "${name}" has invalid direction; defaulting to +Z.`);
        }

        if (refMarkerFlag) {
            let relatedMarkerId: string | undefined;
            if (relatedMarkerRef) {
                relatedMarkerId = markerNameToId.get(relatedMarkerRef) ?? relatedMarkerRef;
            }

            const relatedMarker = relatedMarkerId
                ? createdMarkers.find((marker) => marker.id === relatedMarkerId)
                : undefined;
            if (relatedMarkerRef && !relatedMarker) {
                addImportWarning(stats, `ref marker "${name}" references unknown relatedMarkerRef "${relatedMarkerRef}".`);
            }

            const resolvedPosition = parsedPosition
                ?? (relatedMarker ? cloneVec3(relatedMarker.position) : { x: 0, y: 0, z: 0 });
            const resolvedOrientation = parsedDirection
                ? createOrientationFromNormal(parsedDirection)
                : (relatedMarker ? cloneMat3(relatedMarker.orientation) : createOrientationFromNormal({ x: 0, y: 0, z: 1 }));
            const refFrame: MbsRefFrameEntity = {
                id: nextEntityId('refMarker', createdRefFrames.size),
                name,
                groupId: relatedMarker?.groupId ?? groupId,
                position: resolvedPosition,
                orientation: resolvedOrientation,
                relatedMarkerId: relatedMarker?.id ?? relatedMarkerId,
                createdAt: new Date().toISOString()
            };

            createdRefFrames.set(refFrame.id, refFrame);
            if (relatedMarker) {
                relatedMarker.appendRefMarker(refFrame.id);
            }

            if (viewer) {
                viewer.addFrame({
                    id: refFrame.id,
                    name: refFrame.name,
                    position: refFrame.position,
                    orientation: refFrame.orientation,
                    isPrimary: false
                });
            }

            recordFrameCreation(refFrame.id, 'refFrame');
            frameNameToFrame.set(refFrame.name, { id: refFrame.id, kind: 'refFrame' });
        } else {
            const marker = markerCreator.createMarker({
                position: parsedPosition ?? { x: 0, y: 0, z: 0 },
                normal: parsedDirection ?? { x: 0, y: 0, z: 1 },
                groupId,
                name
            });

            createdMarkers.push(marker);
            markerNameToId.set(marker.name, marker.id);
            if (viewer) {
                viewer.addFrame({
                    id: marker.id,
                    name: marker.name,
                    position: marker.position,
                    orientation: marker.orientation,
                    isPrimary: true
                });
            }

            recordFrameCreation(marker.id, 'marker');
            frameNameToFrame.set(marker.name, { id: marker.id, kind: 'marker' });
        }

        if (frameNameToFrame.size > 0 && frameNameToFrame.get(name)?.id) {
            const duplicates = Array.from(frameNameToFrame.keys()).filter((frameName) => frameName === name).length;
            if (duplicates > 1) {
                addImportWarning(stats, `Duplicate marker name "${name}" found; latest entry is used for references.`);
            }
        }
        stats.markers += 1;
    });

    const designPointEntries = getConfigArray(data, 'designPoint', stats);
    designPointEntries.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `designPoint[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `designPoint[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const groupRef = toNonEmptyString(entry.groupRef);
        const markerRef = toNonEmptyString(entry.markerRef);
        let groupId = selectedShapeId ?? '__unassigned__';

        if (groupRef) {
            groupId = groupNameToId.get(groupRef) ?? shapeNameToId.get(groupRef) ?? groupRef;
            if (!groupNameToId.has(groupRef) && !shapeNameToId.has(groupRef)) {
                addImportWarning(stats, `designPoint "${name}" references unknown groupRef "${groupRef}", keeping raw reference.`);
            }
        }

        let markerRefId: string | undefined;
        if (markerRef) {
            const resolved = frameNameToFrame.get(markerRef);
            markerRefId = resolved?.id ?? markerRef;
            if (!resolved) {
                addImportWarning(stats, `designPoint "${name}" references unknown markerRef "${markerRef}", keeping raw reference.`);
            }
        }

        const parsedPosition = parseVector3(entry.position);
        const parsedDirection = normalizeVector(parseVector3(entry.direction));
        const markerRefEntity = markerRefId
            ? createdMarkers.find((marker) => marker.id === markerRefId)
                ?? createdRefFrames.get(markerRefId)
            : undefined;

        const position = parsedPosition
            ?? (markerRefEntity ? cloneVec3(markerRefEntity.position) : { x: 0, y: 0, z: 0 });
        const sizeValue = typeof entry.size === 'number' && Number.isFinite(entry.size)
            ? entry.size
            : -1;
        const isDirectionReverse = typeof entry.isDirectionReverse === 'boolean'
            ? entry.isDirectionReverse
            : false;
        const offsetValue = typeof entry.offsetValue === 'number' && Number.isFinite(entry.offsetValue)
            ? entry.offsetValue
            : 0;

        const designPoint: MbsDesignPointEntity = {
            id: nextEntityId('designPoint', mbsDesignPoints.size),
            name,
            groupId,
            markerRefId,
            position,
            direction: parsedDirection ?? (markerRefEntity ? orientationToDirection(markerRefEntity.orientation) : undefined),
            size: sizeValue,
            isDirectionReverse,
            offsetValue,
            createdAt: new Date().toISOString()
        };
        mbsDesignPoints.set(designPoint.id, designPoint);
        stats.designPoints += 1;
    });

    const connectors = getConfigArray(data, 'connector', stats);
    connectors.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `connector[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const connectorType = toNonEmptyString(entry.connectorType);
        const part1 = toNonEmptyString(entry.part1);
        const part2 = toNonEmptyString(entry.part2);

        if (!name || !connectorType || !part1 || !part2) {
            stats.skipped += 1;
            addImportWarning(stats, `connector[${index}] is missing required fields and was skipped.`);
            return;
        }

        const resolvedPart1 = resolveShapeRef(part1, shapeNameToId);
        const resolvedPart2 = resolveShapeRef(part2, shapeNameToId);
        if (!resolvedPart1.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `connector "${name}" references unknown part1 "${part1}", keeping raw reference.`);
        }
        if (!resolvedPart2.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `connector "${name}" references unknown part2 "${part2}", keeping raw reference.`);
        }

        const joint: MbsJointEntity = {
            id: nextEntityId('joint', mbsJoints.size),
            name,
            jointType: connectorType,
            part1: resolvedPart1.resolved,
            part2: resolvedPart2.resolved,
            createdAt: new Date().toISOString()
        };
        mbsJoints.set(joint.id, joint);
        stats.connectors += 1;
    });

    const motions = getConfigArray(data, 'motion', stats);
    motions.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `motion[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const motionType = toNonEmptyString(entry.motionType);
        const connectorRef = toNonEmptyString(entry.connectorRef);

        if (!name || !motionType || !connectorRef) {
            stats.skipped += 1;
            addImportWarning(stats, `motion[${index}] is missing required fields and was skipped.`);
            return;
        }

        const motion: MbsMotionEntity = {
            id: nextEntityId('motion', mbsMotions.size),
            name,
            motionType,
            connectorRef,
            createdAt: new Date().toISOString()
        };
        mbsMotions.set(motion.id, motion);
        stats.motions += 1;
    });

    const ribSlices = getConfigArray(data, 'ribSlice', stats);
    ribSlices.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `ribSlice[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `ribSlice[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const shapeRefRaw = toNonEmptyString(entry.shapeRef);
        const shapeRef = shapeRefRaw
            ? resolveShapeRef(shapeRefRaw, shapeNameToId).resolved
            : undefined;

        const slice: FluidSliceEntity = {
            id: nextEntityId('slice', fluidSlices.size),
            name,
            shapeRef,
            createdAt: new Date().toISOString()
        };
        fluidSlices.set(slice.id, slice);
        ribSliceNames.add(name);
        stats.ribSlices += 1;
    });

    const fluidPortEntries = getConfigArray(data, 'fluidPort', stats);
    fluidPortEntries.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `fluidPort[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const portType = toNonEmptyString(entry.portType);
        if (!name || !portType) {
            stats.skipped += 1;
            addImportWarning(stats, `fluidPort[${index}] is missing required fields and was skipped.`);
            return;
        }

        const shapeRefRaw = toNonEmptyString(entry.shapeRef);
        const shapeRef = shapeRefRaw
            ? resolveShapeRef(shapeRefRaw, shapeNameToId).resolved
            : undefined;
        const ribSliceRef = toNonEmptyString(entry.ribSliceRef) ?? undefined;
        if (ribSliceRef && !ribSliceNames.has(ribSliceRef)) {
            addImportWarning(stats, `fluidPort "${name}" references unknown ribSliceRef "${ribSliceRef}".`);
        }

        const port: FluidPortEntity = {
            id: nextEntityId('port', fluidPorts.size),
            name,
            portType,
            shapeRef,
            ribSliceRef,
            createdAt: new Date().toISOString()
        };
        fluidPorts.set(port.id, port);
        stats.fluidPorts += 1;
    });

    setStatus('Ready');
    setStatusInfo(
        `CADTool config imported: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}`
    );

    const summary = `CADTool config import complete${sourceLabel}: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}, ribSlices=${stats.ribSlices}, fluidPorts=${stats.fluidPorts}, skipped=${stats.skipped}.`;
    vscode.postMessage({
        command: 'alert',
        text: summary
    });

    if (stats.warningCount > 0) {
        const hiddenWarnings = stats.warningCount - stats.warnings.length;
        const warningText = hiddenWarnings > 0
            ? `${stats.warnings.join(' | ')} | ... and ${hiddenWarnings} more warning(s).`
            : stats.warnings.join(' | ');
        vscode.postMessage({
            command: 'alert',
            text: `CADTool config import warnings (${stats.warningCount}): ${warningText}`
        });
    }
}

function resolvePartRefName(shapeId: string | undefined): string {
    if (!shapeId) {
        return '';
    }
    return loadedShapes.get(shapeId)?.name ?? shapeId;
}

function resolveGroupRefName(groupOrShapeId: string | undefined): string {
    if (!groupOrShapeId) {
        return '';
    }
    const group = mbsGroups.get(groupOrShapeId);
    if (group) {
        return group.name;
    }
    return resolvePartRefName(groupOrShapeId);
}

function buildCadtoolConfigExportData(): CadtoolConfigExportData {
    const frameIdToName = new Map<string, string>();
    createdMarkers.forEach((marker) => frameIdToName.set(marker.id, marker.name));
    createdRefFrames.forEach((refFrame) => frameIdToName.set(refFrame.id, refFrame.name));

    const markerEntries = createdMarkers.map((marker) => ({
        name: marker.name,
        groupRef: resolveGroupRefName(marker.groupId),
        position: cloneVec3(marker.position),
        direction: orientationToDirection(marker.orientation)
    }));

    const refMarkerEntries = Array.from(createdRefFrames.values()).map((refFrame) => ({
        name: refFrame.name,
        groupRef: resolveGroupRefName(refFrame.groupId),
        position: cloneVec3(refFrame.position),
        direction: orientationToDirection(refFrame.orientation),
        refMarker: true,
        relatedMarkerRef: refFrame.relatedMarkerId
            ? (frameIdToName.get(refFrame.relatedMarkerId) ?? refFrame.relatedMarkerId)
            : undefined
    }));

    return {
        group: Array.from(mbsGroups.values()).map(group => ({
            name: group.name,
            parts: group.memberShapeIds.map(resolvePartRefName)
        })),
        marker: [...markerEntries, ...refMarkerEntries],
        designPoint: Array.from(mbsDesignPoints.values()).map((point) => ({
            name: point.name,
            groupRef: resolveGroupRefName(point.groupId),
            markerRef: point.markerRefId
                ? (frameIdToName.get(point.markerRefId) ?? point.markerRefId)
                : undefined,
            position: cloneVec3(point.position),
            direction: point.direction ? cloneVec3(point.direction) : undefined,
            size: point.size,
            isDirectionReverse: point.isDirectionReverse,
            offsetValue: point.offsetValue
        })),
        connector: Array.from(mbsJoints.values()).map(joint => ({
            name: joint.name,
            connectorType: joint.jointType,
            part1: resolvePartRefName(joint.part1),
            part2: resolvePartRefName(joint.part2)
        })),
        motion: Array.from(mbsMotions.values()).map(motion => ({
            name: motion.name,
            motionType: motion.motionType,
            connectorRef: motion.connectorRef
        })),
        fluidPort: Array.from(fluidPorts.values()).map(port => ({
            name: port.name,
            portType: port.portType,
            ribSliceRef: port.ribSliceRef ?? ''
        })),
        ribSlice: Array.from(fluidSlices.values()).map(slice => ({
            name: slice.name
        })),
        gravity: [],
        medium: []
    };
}

function exportCadtoolConfig(): void {
    setStatus('Preparing CADTool config export...');

    try {
        const exportData = buildCadtoolConfigExportData();
        const jsonData = JSON.stringify(exportData, null, 2);

        vscode.postMessage({
            command: 'exportCadtoolConfig',
            data: jsonData
        });

        setStatus('Ready');
        setStatusInfo(
            `CADTool config exported: groups=${exportData.group.length}, markers=${exportData.marker.length}, designPoints=${exportData.designPoint.length}, connectors=${exportData.connector.length}, motions=${exportData.motion.length}`
        );
    } catch (error) {
        console.error('Failed to export CADTool config:', error);
        setStatus('CADTool config export failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to export CADTool config: ${error}`
        });
    }
}

// ============================================================================
// Exploded View Functions
// ============================================================================

/**
 * Calculate bounding box center for a shape hierarchy
 */
function calculateShapeCenter(shape: LoadedShape): { x: number; y: number; z: number } {
    if (!shape.meshData) {
        return { x: 0, y: 0, z: 0 };
    }

    const vertices = shape.meshData.vertices;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxX = Math.max(maxX, vertices[i]);
        maxY = Math.max(maxY, vertices[i + 1]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    };
}

/**
 * Calculate assembly center from all root shapes
 */
function calculateAssemblyCenter(): { x: number; y: number; z: number } {
    if (rootShapes.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }

    const centers: Array<{ x: number; y: number; z: number }> = [];

    function collectCenters(shape: LoadedShape): void {
        if (shape.meshData && shape.meshId) {
            centers.push(calculateShapeCenter(shape));
        }
        if (shape.children) {
            shape.children.forEach(collectCenters);
        }
    }

    rootShapes.forEach(collectCenters);

    if (centers.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }

    const sum = centers.reduce(
        (acc, center) => ({
            x: acc.x + center.x,
            y: acc.y + center.y,
            z: acc.z + center.z
        }),
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: sum.x / centers.length,
        y: sum.y / centers.length,
        z: sum.z / centers.length
    };
}

/**
 * Prepare explode data for all meshes
 */
function prepareExplodeData(): void {
    explodeDataMap.clear();

    const assemblyCenter = calculateAssemblyCenter();

    function processShape(shape: LoadedShape): void {
        if (shape.meshData && shape.meshId) {
            const shapeCenter = calculateShapeCenter(shape);

            // Calculate direction from assembly center to shape center
            let dirX = shapeCenter.x - assemblyCenter.x;
            let dirY = shapeCenter.y - assemblyCenter.y;
            let dirZ = shapeCenter.z - assemblyCenter.z;

            // Normalize direction
            const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
            if (length > 0.001) {
                dirX /= length;
                dirY /= length;
                dirZ /= length;
            } else {
                // If at center, use a default direction
                dirX = 0;
                dirY = 0;
                dirZ = 1;
            }

            explodeDataMap.set(shape.meshId, {
                meshId: shape.meshId,
                originalPosition: { x: 0, y: 0, z: 0 }, // Will be filled by viewer
                explodeDirection: { x: dirX, y: dirY, z: dirZ }
            });
        }

        if (shape.children) {
            shape.children.forEach(processShape);
        }
    }

    rootShapes.forEach(processShape);
}

/**
 * Apply explode transform to all meshes
 */
function applyExplode(distance: number): void {
    if (!viewer) return;

    explodeDataMap.forEach((data) => {
        const offset = {
            x: data.explodeDirection.x * distance,
            y: data.explodeDirection.y * distance,
            z: data.explodeDirection.z * distance
        };
        viewer.setMeshPosition(data.meshId, offset);
    });
}

/**
 * Toggle explode view
 */
function toggleExplode(): void {
    const sliderContainer = document.getElementById('explode-slider-container');
    const explodeBtn = document.getElementById('btn-explode');

    if (!sliderContainer || !explodeBtn) return;

    if (!isExploded) {
        // Enter explode mode
        if (rootShapes.length === 0) {
            vscode.postMessage({
                command: 'alert',
                text: 'Please load a model first'
            });
            return;
        }

        isExploded = true;
        sliderContainer.classList.add('show');
        explodeBtn.style.backgroundColor = 'rgba(0, 122, 204, 0.3)';

        prepareExplodeData();
        setStatus('Exploded view mode active');
    } else {
        // Exit explode mode
        isExploded = false;
        sliderContainer.classList.remove('show');
        explodeBtn.style.backgroundColor = '';

        // Reset to zero
        const slider = document.getElementById('explode-slider') as HTMLInputElement;
        if (slider) {
            slider.value = '0';
            explodeDistance = 0;
            updateExplodeValue(0);
        }

        applyExplode(0);
        setStatus('Ready');
    }
}

/**
 * Update explode distance from slider
 */
function updateExplodeDistance(percent: number): void {
    explodeDistance = percent;

    // Calculate actual distance based on model size
    // Use assembly bounding box to determine scale
    const maxDistance = calculateModelScale() * 2;
    const actualDistance = (percent / 100) * maxDistance;

    applyExplode(actualDistance);
    updateExplodeValue(percent);
}

/**
 * Calculate model scale for explosion distance
 */
function calculateModelScale(): number {
    if (rootShapes.length === 0) return 100;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    function processShape(shape: LoadedShape): void {
        if (shape.meshData) {
            const vertices = shape.meshData.vertices;
            for (let i = 0; i < vertices.length; i += 3) {
                minX = Math.min(minX, vertices[i]);
                minY = Math.min(minY, vertices[i + 1]);
                minZ = Math.min(minZ, vertices[i + 2]);
                maxX = Math.max(maxX, vertices[i]);
                maxY = Math.max(maxY, vertices[i + 1]);
                maxZ = Math.max(maxZ, vertices[i + 2]);
            }
        }
        if (shape.children) {
            shape.children.forEach(processShape);
        }
    }

    rootShapes.forEach(processShape);

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    return Math.max(sizeX, sizeY, sizeZ);
}

/**
 * Update explode slider value display
 */
function updateExplodeValue(percent: number): void {
    const valueDisplay = document.getElementById('explode-slider-value');
    if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(percent)}%`;
    }
}

// ============================================================================
// Clear Scene
// ============================================================================

function clearScene(): void {
    // Remove all meshes from viewer
    loadedShapes.forEach((shape) => {
        if (viewer && shape.meshId) {
            viewer.removeMesh(shape.meshId);
        }
        if (occt && shape.shapeId) {
            occt.deleteShape(shape.shapeId);
        }
    });

    loadedShapes.clear();
    rootShapes.length = 0;
    selectedShapeId = null;
    meshIdToShapeId.clear();
    shapeSelectionHistory.length = 0;
    explodeDataMap.clear();
    massPropertiesCoordinator.clear();
    clearCadtoolRuntimeEntities();

    // Reset explode state
    if (isExploded) {
        toggleExplode();
    }

    updateModelTree();
    updatePropertiesPanel(null);
    setStatusInfo('');
    setStatus('Ready');
}

// ============================================================================
// MBS Action Handling
// ============================================================================

function nextEntityId(prefix: string, existingCount: number): string {
    return `${prefix}_${existingCount + 1}`;
}

function activeShapeName(shapeId: string | undefined): string {
    if (!shapeId) {
        return '(none)';
    }
    return loadedShapes.get(shapeId)?.name ?? shapeId;
}

function resolveJointParticipants(): { part1: string; part2: string } | null {
    const recent = shapeSelectionHistory
        .slice()
        .reverse()
        .filter((id, index, arr) => arr.indexOf(id) === index);

    if (recent.length >= 2) {
        return {
            part1: recent[1],
            part2: recent[0]
        };
    }

    if (selectedShapeId && rootShapes.length > 0) {
        const fallback = findFirstRenderableShapeId(rootShapes[0], selectedShapeId);
        if (fallback) {
            return { part1: selectedShapeId, part2: fallback };
        }
    }

    return null;
}

function findFirstRenderableShapeId(shape: LoadedShape, excludedShapeId: string): string | null {
    if (shape.id !== excludedShapeId && shape.meshId) {
        return shape.id;
    }

    if (shape.children) {
        for (const child of shape.children) {
            const found = findFirstRenderableShapeId(child, excludedShapeId);
            if (found) {
                return found;
            }
        }
    }

    return null;
}

function renderCustomProperties(title: string, rows: Array<{ label: string; value: string }>): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const lines = [`<div style="margin-bottom: 8px; font-weight: bold; color: #9cdcfe;">${title}</div>`];
    for (const row of rows) {
        lines.push(createPropertyRow(row.label, row.value));
    }

    propsEl.innerHTML = lines.join('');
}

// ============================================================================
// Options Panel Builders
// ============================================================================

function setPanelMode(mode: 'properties' | 'options', title: string): void {
    const headerText = document.getElementById('panel-header-text');
    const closeBtn = document.getElementById('panel-header-close');
    if (headerText) headerText.textContent = title;
    if (closeBtn) closeBtn.style.display = mode === 'options' ? 'inline' : 'none';
}

function buildNameInput(id: string, value: string): string {
    return `<div class="opt-name-row">
        <label for="${id}">名称</label>
        <input id="${id}" class="opt-input" type="text" value="${escapeAttr(value)}" />
    </div>`;
}

function buildSeparator(): string {
    return '<div class="opt-separator"></div>';
}

function buildVec3Input(prefix: string, label: string, x: number, y: number, z: number): string {
    return `<div class="opt-label">${label}</div>
    <div class="opt-vec3-row">
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">X</span>
            <input id="${prefix}-x" class="opt-vec3-input" type="number" step="0.01" value="${x.toFixed(4)}" />
        </div>
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">Y</span>
            <input id="${prefix}-y" class="opt-vec3-input" type="number" step="0.01" value="${y.toFixed(4)}" />
        </div>
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">Z</span>
            <input id="${prefix}-z" class="opt-vec3-input" type="number" step="0.01" value="${z.toFixed(4)}" />
        </div>
    </div>`;
}

function buildDropdown(id: string, label: string, value: string, options: Array<{ value: string; text: string }>): string {
    const optionsHtml = options.map(opt =>
        `<option value="${escapeAttr(opt.value)}"${opt.value === value ? ' selected' : ''}>${opt.text}</option>`
    ).join('');
    return `<div class="opt-row">
        <label for="${id}">${label}</label>
        <select id="${id}" class="opt-dropdown">${optionsHtml}</select>
    </div>`;
}

function buildPartSelector(id: string, label: string, hint: string): string {
    return `<div class="opt-label">${label}</div>
    <div id="${id}" class="opt-part-selector">
        <span>🖱 ${hint}</span>
    </div>`;
}

function buildActionButtons(confirmId: string, confirmText: string, cancelId: string): string {
    return `<div class="opt-btn-row">
        <button id="${cancelId}" class="opt-btn-secondary">取消</button>
        <button id="${confirmId}" class="opt-btn-primary">${confirmText}</button>
    </div>`;
}

function buildModeSwitch(): string {
    return `<div class="opt-mode-row">
        <button class="opt-mode-btn-active" data-mode="fast">⚡ 闪电模式</button>
        <button class="opt-mode-btn" data-mode="standard">📐 标准模式</button>
    </div>`;
}

function buildSectionHeader(text: string): string {
    return `<div class="opt-section-header">${text}</div>`;
}

function buildTabBar(tabs: Array<{ id: string; text: string; active: boolean }>): string {
    const tabsHtml = tabs.map(tab =>
        `<button class="${tab.active ? 'opt-tab-active' : 'opt-tab'}" data-tab="${tab.id}">${tab.text}</button>`
    ).join('');
    return `<div class="opt-tab-bar">${tabsHtml}</div>`;
}

function buildSelectedList(items: Array<{ name: string }>): string {
    if (items.length === 0) {
        return '<div class="opt-selected-list"><div class="opt-hint">暂无已选零件</div></div>';
    }
    const itemsHtml = items.map(item =>
        `<div class="opt-selected-item"><span class="checkmark">✓</span>${item.name}</div>`
    ).join('');
    return `<div class="opt-selected-list">${itemsHtml}</div>`;
}

function closeOptionsPanel(): void {
    setPanelMode('properties', '属性');
    if (selectedShapeId) {
        updatePropertiesPanel(selectedShapeId);
    } else {
        const propsEl = document.getElementById('properties-panel');
        if (propsEl) {
            propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">选择对象以查看属性</div>';
        }
    }
}

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readVec3FromInputs(prefix: string): Vec3 {
    const x = parseFloat((document.getElementById(`${prefix}-x`) as HTMLInputElement)?.value ?? '0');
    const y = parseFloat((document.getElementById(`${prefix}-y`) as HTMLInputElement)?.value ?? '0');
    const z = parseFloat((document.getElementById(`${prefix}-z`) as HTMLInputElement)?.value ?? '0');
    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y, z: isNaN(z) ? 0 : z };
}

// ============================================================================
// Options Panel Renderers
// ============================================================================

function renderGroupOptionsPanel(selectedParts: LoadedShape[]): void {
    setPanelMode('options', '选项-组合');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    const defaultName = `Group${mbsGroups.size + 1}`;
    const partItems = selectedParts.map(s => ({ name: s.name }));

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-group-name', defaultName)}
        ${buildSeparator()}
        <div class="opt-label">已选中零件：${selectedParts.length}</div>
        ${buildSelectedList(partItems)}
        ${buildSeparator()}
        ${buildActionButtons('opt-group-confirm', '确认组合', 'opt-group-cancel')}
    </div>`;

    document.getElementById('opt-group-confirm')?.addEventListener('click', () => {
        const nameInput = document.getElementById('opt-group-name') as HTMLInputElement;
        const name = nameInput?.value?.trim() || defaultName;
        const memberShapeIds = selectedParts.map(s => s.id);

        const id = nextEntityId('group', mbsGroups.size);
        const group: MbsGroupEntity = {
            id,
            name,
            parentGroupId: undefined,
            memberShapeIds,
            createdAt: new Date().toISOString()
        };
        mbsGroups.set(id, group);

        setStatusInfo(`Group created: ${name}`);
        closeOptionsPanel();
        vscode.postMessage({
            command: 'alert',
            text: `Created group "${name}" with ${memberShapeIds.length} member(s).`
        });
    });

    document.getElementById('opt-group-cancel')?.addEventListener('click', () => {
        closeOptionsPanel();
    });
}

function renderFrameOptionsPanel(title: string, name: string, position: Vec3, direction: Vec3): void {
    setPanelMode('options', title);
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-frame-name', name)}
        ${buildSeparator()}
        ${buildVec3Input('opt-pos', '位置（全局坐标）', position.x, position.y, position.z)}
        ${buildSeparator()}
        ${buildVec3Input('opt-dir', '方向（Rx/Ry/Rz °）', direction.x, direction.y, direction.z)}
        ${buildSeparator()}
        <div class="opt-hint">💡 智能推断已开启</div>
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

function renderDesignPointOptionsPanel(name: string, position: Vec3): void {
    setPanelMode('options', '选项-设计点');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-dp-name', name)}
        ${buildSeparator()}
        ${buildTabBar([
            { id: 'pick', text: '拾取', active: true },
            { id: 'calc', text: '计算', active: false }
        ])}
        ${buildSeparator()}
        ${buildVec3Input('opt-dp-pos', '位置', position.x, position.y, position.z)}
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
    bindTabBarEvents(propsEl);
}

const JOINT_TYPE_OPTIONS: Array<{ value: string; text: string }> = [
    { value: 'Revolute', text: 'Revolute（旋转）' },
    { value: 'Prismatic', text: 'Prismatic（平移）' },
    { value: 'Cylindrical', text: 'Cylindrical（圆柱）' },
    { value: 'Spherical', text: 'Spherical（球）' },
    { value: 'Universal', text: 'Universal（万向）' },
    { value: 'Planar', text: 'Planar（平面）' },
    { value: 'Fixed', text: 'Fixed（固定）' }
];

function renderJointOptionsPanel(name: string, jointType: string, part1Name: string, part2Name: string, position: Vec3, direction: Vec3): void {
    setPanelMode('options', '选项-连接');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-joint-name', name)}
        ${buildDropdown('opt-joint-type', '类型', jointType, JOINT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-label" style="color: #DC2626; font-weight: 500;">零件 1</div>
        <div id="opt-joint-part1" class="opt-part-selector${part1Name ? ' has-value' : ''}">
            <span>${part1Name || '🖱 点击选择零件 1'}</span>
        </div>
        <div class="opt-label" style="color: #2563EB; font-weight: 500;">零件 2</div>
        <div id="opt-joint-part2" class="opt-part-selector${part2Name ? ' has-value' : ''}">
            <span>${part2Name || '🖱 点击选择零件 2'}</span>
        </div>
        ${buildSeparator()}
        ${buildVec3Input('opt-joint-pos', '位置', position.x, position.y, position.z)}
        ${buildVec3Input('opt-joint-dir', '方向', direction.x, direction.y, direction.z)}
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

const MOTION_TYPE_OPTIONS: Array<{ value: string; text: string }> = [
    { value: 'constant', text: '匀速运动' },
    { value: 'sinusoidal', text: '正弦运动' },
    { value: 'ramp', text: '斜坡运动' },
    { value: 'custom', text: '自定义' }
];

function renderMotionOptionsPanel(name: string, motionType: string, connectorRef: string): void {
    setPanelMode('options', '选项-驱动');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-motion-name', name)}
        ${buildDropdown('opt-motion-type', '类型', motionType, MOTION_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-label">连接器</div>
        <div id="opt-motion-connector" class="opt-part-selector${connectorRef ? ' has-value' : ''}">
            <span>${connectorRef || '🖱 选择连接器'}</span>
        </div>
        ${buildSeparator()}
        ${buildSectionHeader('驱动参数')}
        <div class="opt-row">
            <label for="opt-motion-phi">phi.start</label>
            <input id="opt-motion-phi" class="opt-input" type="number" step="0.01" value="0" />
        </div>
        <div class="opt-row">
            <label for="opt-motion-w">w.start</label>
            <input id="opt-motion-w" class="opt-input" type="number" step="0.01" value="0" />
        </div>
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

function bindModeSwitchEvents(container: HTMLElement): void {
    container.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('[data-mode]').forEach(b => {
                b.className = (b as HTMLElement).dataset.mode === (btn as HTMLElement).dataset.mode
                    ? 'opt-mode-btn-active'
                    : 'opt-mode-btn';
            });
        });
    });
}

function bindTabBarEvents(container: HTMLElement): void {
    container.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('[data-tab]').forEach(t => {
                t.className = (t as HTMLElement).dataset.tab === (tab as HTMLElement).dataset.tab
                    ? 'opt-tab-active'
                    : 'opt-tab';
            });
        });
    });
}

function handleCreateGroup(parentGroupId?: string): void {
    const selectedParts: LoadedShape[] = [];
    if (selectedShapeId) {
        const shape = loadedShapes.get(selectedShapeId);
        if (shape) selectedParts.push(shape);
    }

    renderGroupOptionsPanel(selectedParts);
}

function handleGroupProperties(): void {
    const target = Array.from(mbsGroups.values()).at(-1);
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No group available. Please create a group first.'
        });
        return;
    }

    renderCustomProperties('Group Properties', [
        { label: 'ID', value: target.id },
        { label: 'Name', value: target.name },
        { label: 'Parent', value: target.parentGroupId ?? '(root)' },
        { label: 'Members', value: target.memberShapeIds.map(activeShapeName).join(', ') || '(empty)' },
        { label: 'Created', value: target.createdAt }
    ]);
}

function handleCreateJoint(jointType: string): void {
    const participants = resolveJointParticipants();
    const part1Name = participants ? activeShapeName(participants.part1) : '';
    const part2Name = participants ? activeShapeName(participants.part2) : '';
    const name = `${jointType || 'joint'}_${mbsJoints.size + 1}`;
    const position: Vec3 = { x: 0, y: 0, z: 0 };
    const direction: Vec3 = { x: 0, y: 0, z: 1 };

    renderJointOptionsPanel(name, jointType || 'Revolute', part1Name, part2Name, position, direction);
}

function handleCreateMotion(motionType: string): void {
    const latestJoint = Array.from(mbsJoints.values()).at(-1);
    const connectorRef = latestJoint?.name ?? '';
    const name = `${motionType || 'motion'}_${mbsMotions.size + 1}`;

    renderMotionOptionsPanel(name, motionType || 'constant', connectorRef);
}

function handleMotionProperties(): void {
    const target = Array.from(mbsMotions.values()).at(-1);
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No motion available. Please create a motion first.'
        });
        return;
    }

    renderCustomProperties('Motion Properties', [
        { label: 'ID', value: target.id },
        { label: 'Name', value: target.name },
        { label: 'Motion Type', value: target.motionType },
        { label: 'Connector Ref', value: target.connectorRef },
        { label: 'Created', value: target.createdAt }
    ]);
}

function handleCreateFluidTankSlice(): void {
    const id = nextEntityId('slice', fluidSlices.size);
    const slice: FluidSliceEntity = {
        id,
        name: `RibSlice${fluidSlices.size + 1}`,
        shapeRef: selectedShapeId ?? undefined,
        createdAt: new Date().toISOString()
    };
    fluidSlices.set(id, slice);

    setStatusInfo(`Fluid slice created: ${slice.name}`);
    renderCustomProperties('Fluid Slice Properties', [
        { label: 'ID', value: slice.id },
        { label: 'Name', value: slice.name },
        { label: 'Shape Ref', value: activeShapeName(slice.shapeRef) },
        { label: 'Created', value: slice.createdAt }
    ]);
}

function handleCreateFluidPort(): void {
    const latestSlice = Array.from(fluidSlices.values()).at(-1);
    const id = nextEntityId('port', fluidPorts.size);
    const port: FluidPortEntity = {
        id,
        name: `FluidPort${fluidPorts.size + 1}`,
        portType: 'variableTankGasPort',
        shapeRef: selectedShapeId ?? undefined,
        ribSliceRef: latestSlice?.name,
        createdAt: new Date().toISOString()
    };
    fluidPorts.set(id, port);

    setStatusInfo(`Fluid port created: ${port.name}`);
    renderCustomProperties('Fluid Port Properties', [
        { label: 'ID', value: port.id },
        { label: 'Name', value: port.name },
        { label: 'Port Type', value: port.portType },
        { label: 'Shape Ref', value: activeShapeName(port.shapeRef) },
        { label: 'Rib Slice Ref', value: port.ribSliceRef ?? '(none)' },
        { label: 'Created', value: port.createdAt }
    ]);
}

function handleMeasureTool(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a shape first.'
        });
        return;
    }

    const shape = loadedShapes.get(selectedShapeId);
    if (!shape?.meshData) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected shape has no mesh data.'
        });
        return;
    }

    const bbox = computeBoundingBox(shape.meshData.vertices);
    renderCustomProperties('Measurement', [
        { label: 'Shape', value: shape.name },
        { label: 'Size X', value: bbox.size.x.toFixed(3) },
        { label: 'Size Y', value: bbox.size.y.toFixed(3) },
        { label: 'Size Z', value: bbox.size.z.toFixed(3) },
        { label: 'Min', value: `${bbox.min.x.toFixed(3)}, ${bbox.min.y.toFixed(3)}, ${bbox.min.z.toFixed(3)}` },
        { label: 'Max', value: `${bbox.max.x.toFixed(3)}, ${bbox.max.y.toFixed(3)}, ${bbox.max.z.toFixed(3)}` }
    ]);
    setStatusInfo(`Measured shape: ${shape.name}`);
}

function handleSurfaceThicken(): void {
    if (!selectedShapeId) {
        vscode.postMessage({ command: 'alert', text: 'Please select a shape before surface thickening.' });
        return;
    }
    const shape = loadedShapes.get(selectedShapeId);
    setStatusInfo(`Surface thickening target: ${shape?.name ?? selectedShapeId}`);
}

function handlePlanarRingProcess(): void {
    if (!selectedShapeId) {
        vscode.postMessage({ command: 'alert', text: 'Please select a shape before planar ring processing.' });
        return;
    }
    const shape = loadedShapes.get(selectedShapeId);
    setStatusInfo(`Planar ring process target: ${shape?.name ?? selectedShapeId}`);
}

function computeBoundingBox(vertices: Float32Array): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
} {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxX = Math.max(maxX, vertices[i]);
        maxY = Math.max(maxY, vertices[i + 1]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    return {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    };
}

/**
 * Start marker creation mode
 */
function startMarkerCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a marker'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createMarker';
    setStatus('Click on a face to create marker');
    setStatusInfo('Marker creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the marker. The Z-axis will point outward along the face normal.'
    });
}

/**
 * Start reference marker creation mode
 */
function startRefFrameCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a reference marker.'
        });
        return;
    }
    if (createdMarkers.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please create a basic marker first before creating a reference marker.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createRefFrame';
    setStatus('Click on a face to create reference marker');
    setStatusInfo('Reference marker creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the reference marker. It will be linked to the latest basic marker.'
    });
}

/**
 * Start design point creation mode
 */
function startDesignPointCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a design point.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createDesignPoint';
    setStatus('Click on a face to create design point');
    setStatusInfo('Design point creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the design point.'
    });
}

/**
 * Start frame editing mode
 */
function startFrameEditMode(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to edit a frame.'
        });
        return;
    }

    const target = resolveLatestExistingFrameFromHistory();
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No frame available to edit. Please create a marker or reference marker first.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'editFrame';
    editingFrameTarget = { id: target.id, kind: target.kind };
    setStatus('Click on a face to reposition the frame');
    setStatusInfo(`Editing ${target.kind === 'marker' ? 'marker' : 'reference marker'}: ${target.id}`);
    setCanvasCursor('crosshair');
}

function resolveFacePlacement(event: MouseEvent): { selectedShape: LoadedShape; position: Vec3; normal: Vec3 } | null {
    if (!viewer || !occt || !selectedShapeId) {
        return null;
    }

    const selectedShape = loadedShapes.get(selectedShapeId);
    if (!selectedShape || !selectedShape.shapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected part has no geometry to place marker/design point.'
        });
        return null;
    }

    const container = document.getElementById('canvas-container');
    if (!container) {
        return null;
    }

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ray = viewer.getRayFromScreenPoint(x, y);
    if (!ray) {
        console.warn('Failed to get ray from screen point');
        return null;
    }

    const result = occt.getFaceNormalAtPoint(
        selectedShape.shapeId,
        ray.origin,
        ray.direction
    );

    if (!result) {
        vscode.postMessage({
            command: 'alert',
            text: 'No face found at click position. Please click on a face.'
        });
        return null;
    }

    return {
        selectedShape,
        position: cloneVec3(result.position),
        normal: cloneVec3(result.normal)
    };
}

function createMarkerFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    const marker = markerCreator.createMarker({
        position,
        normal,
        groupId: selectedShape.id,
        name: `Marker${createdMarkers.length + 1}`
    });

    createdMarkers.push(marker);
    recordFrameCreation(marker.id, 'marker');

    if (viewer) {
        viewer.addFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            isPrimary: true
        });
    }

    renderFrameOptionsPanel('选项-标架', marker.name,
        marker.position,
        orientationToDirection(marker.orientation));
    setStatusInfo(`Marker created: ${marker.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Marker "${marker.name}" created successfully at position (${marker.position.x.toFixed(2)}, ${marker.position.y.toFixed(2)}, ${marker.position.z.toFixed(2)})`
    });
}

function createRefFrameFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): boolean {
    const relatedMarker = createdMarkers.at(-1);
    if (!relatedMarker) {
        vscode.postMessage({
            command: 'alert',
            text: 'No basic marker found. Please create a basic marker first.'
        });
        return false;
    }

    const refFrame: MbsRefFrameEntity = {
        id: nextEntityId('refMarker', createdRefFrames.size),
        name: `RefMarker${createdRefFrames.size + 1}`,
        groupId: selectedShape.id,
        position: cloneVec3(position),
        orientation: createOrientationFromNormal(normal),
        relatedMarkerId: relatedMarker.id,
        createdAt: new Date().toISOString()
    };
    createdRefFrames.set(refFrame.id, refFrame);
    relatedMarker.appendRefMarker(refFrame.id);
    recordFrameCreation(refFrame.id, 'refFrame');

    if (viewer) {
        viewer.addFrame({
            id: refFrame.id,
            name: refFrame.name,
            position: refFrame.position,
            orientation: refFrame.orientation,
            isPrimary: false
        });
    }

    renderFrameOptionsPanel('选项-标架', refFrame.name,
        refFrame.position,
        orientationToDirection(refFrame.orientation));
    setStatusInfo(`Reference marker created: ${refFrame.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Reference marker "${refFrame.name}" created and linked to "${relatedMarker.name}".`
    });
    return true;
}

function createDesignPointFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    const latestFrame = resolveLatestExistingFrameFromHistory();
    const designPoint: MbsDesignPointEntity = {
        id: nextEntityId('designPoint', mbsDesignPoints.size),
        name: `DesignPoint${mbsDesignPoints.size + 1}`,
        groupId: selectedShape.id,
        position: cloneVec3(position),
        direction: normalizeVector(cloneVec3(normal)) ?? { x: 0, y: 0, z: 1 },
        markerRefId: latestFrame?.id,
        size: -1,
        isDirectionReverse: false,
        offsetValue: 0,
        createdAt: new Date().toISOString()
    };
    mbsDesignPoints.set(designPoint.id, designPoint);

    renderDesignPointOptionsPanel(designPoint.name, designPoint.position);
    setStatusInfo(`Design point created: ${designPoint.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Design point "${designPoint.name}" created successfully.`
    });
}

function editFrameFromPlacement(position: Vec3, normal: Vec3): boolean {
    const target = editingFrameTarget;
    if (!target || !viewer) {
        vscode.postMessage({
            command: 'alert',
            text: 'No frame selected for editing.'
        });
        return false;
    }

    const orientation = createOrientationFromNormal(normal);
    if (target.kind === 'marker') {
        const marker = createdMarkers.find((item) => item.id === target.id);
        if (!marker) {
            vscode.postMessage({
                command: 'alert',
                text: 'Selected marker no longer exists.'
            });
            return false;
        }

        marker.setPosition(position.x, position.y, position.z);
        marker.setOrientation(orientation);
        viewer.updateFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            isPrimary: true
        });

        setStatusInfo(`Marker edited: ${marker.name}`);
        renderFrameOptionsPanel('选项-标架', marker.name,
            marker.position,
            orientationToDirection(marker.orientation));
        vscode.postMessage({
            command: 'alert',
            text: `Marker "${marker.name}" updated.`
        });
        return true;
    }

    const refFrame = createdRefFrames.get(target.id);
    if (!refFrame) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected reference marker no longer exists.'
        });
        return false;
    }

    refFrame.position = cloneVec3(position);
    refFrame.orientation = orientation;
    viewer.updateFrame({
        id: refFrame.id,
        name: refFrame.name,
        position: refFrame.position,
        orientation: refFrame.orientation,
        isPrimary: false
    });

    setStatusInfo(`Reference marker edited: ${refFrame.name}`);
    renderFrameOptionsPanel('选项-标架', refFrame.name,
        refFrame.position,
        orientationToDirection(refFrame.orientation));
    vscode.postMessage({
        command: 'alert',
        text: `Reference marker "${refFrame.name}" updated.`
    });
    return true;
}

/**
 * Handle click on canvas for marker/ref marker/design point/frame editing
 */
function handleCanvasClick(event: MouseEvent): void {
    if (canvasInteractionMode === 'none') return;

    const placement = resolveFacePlacement(event);
    if (!placement) return;

    let completed = false;
    switch (canvasInteractionMode) {
        case 'createMarker':
            createMarkerFromPlacement(placement.selectedShape, placement.position, placement.normal);
            completed = true;
            break;
        case 'createRefFrame':
            completed = createRefFrameFromPlacement(placement.selectedShape, placement.position, placement.normal);
            break;
        case 'createDesignPoint':
            createDesignPointFromPlacement(placement.selectedShape, placement.position, placement.normal);
            completed = true;
            break;
        case 'editFrame':
            completed = editFrameFromPlacement(placement.position, placement.normal);
            break;
        default:
            break;
    }

    if (completed) {
        resetCanvasInteraction();
        setStatus('Ready');
    }
}

function handleMbsAction(action: string, params: Record<string, unknown>): void {
    console.log('[MBS Action]', action, params);

    switch (action) {
        case 'createGroup': {
            handleCreateGroup();
            break;
        }
        case 'createChildGroup': {
            const parentGroupId = Array.from(mbsGroups.keys()).at(-1);
            handleCreateGroup(parentGroupId);
            break;
        }
        case 'groupProperties': {
            handleGroupProperties();
            break;
        }
        case 'createFrame': {
            startMarkerCreation();
            break;
        }
        case 'createRefFrame': {
            startRefFrameCreation();
            break;
        }
        case 'createDesignPoint': {
            startDesignPointCreation();
            break;
        }
        case 'editFrame': {
            startFrameEditMode();
            break;
        }
        case 'deleteFrame': {
            const target = resolveLatestExistingFrameFromHistory();
            if (!target) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No marker or reference marker to delete.'
                });
                return;
            }

            if (target.kind === 'marker') {
                const markerIndex = createdMarkers.findIndex((marker) => marker.id === target.id);
                if (markerIndex < 0) {
                    frameCreationHistory.splice(target.index, 1);
                    return;
                }

                const marker = createdMarkers[markerIndex];
                if (marker.relatedRefMarkerIds.length > 0) {
                    vscode.postMessage({
                        command: 'alert',
                        text: `Marker "${marker.name}" has reference markers and cannot be deleted.`
                    });
                    return;
                }

                createdMarkers.splice(markerIndex, 1);
                mbsDesignPoints.forEach((point) => {
                    if (point.markerRefId === marker.id) {
                        point.markerRefId = undefined;
                    }
                });

                if (viewer) {
                    viewer.removeFrame(marker.id);
                }
                frameCreationHistory.splice(target.index, 1);
                setStatusInfo(`Marker deleted: ${marker.name}`);
                vscode.postMessage({
                    command: 'alert',
                    text: `Marker "${marker.name}" deleted.`
                });
                break;
            }

            const refFrame = createdRefFrames.get(target.id);
            if (!refFrame) {
                frameCreationHistory.splice(target.index, 1);
                return;
            }

            if (refFrame.relatedMarkerId) {
                const parentMarker = createdMarkers.find((marker) => marker.id === refFrame.relatedMarkerId);
                parentMarker?.removeRefMarker(refFrame.id);
            }
            createdRefFrames.delete(refFrame.id);
            mbsDesignPoints.forEach((point) => {
                if (point.markerRefId === refFrame.id) {
                    point.markerRefId = undefined;
                }
            });
            if (viewer) {
                viewer.removeFrame(refFrame.id);
            }
            frameCreationHistory.splice(target.index, 1);
            setStatusInfo(`Reference marker deleted: ${refFrame.name}`);
            vscode.postMessage({
                command: 'alert',
                text: `Reference marker "${refFrame.name}" deleted.`
            });
            break;
        }
        case 'createJoint': {
            const jointType = params.jointType as string;
            handleCreateJoint(jointType);
            break;
        }
        case 'createMotion': {
            const motionType = params.motionType as string;
            handleCreateMotion(motionType);
            break;
        }
        case 'motionProperties': {
            handleMotionProperties();
            break;
        }
        case 'fluidTankSlice': {
            handleCreateFluidTankSlice();
            break;
        }
        case 'fluidPort': {
            handleCreateFluidPort();
            break;
        }
        case 'measureTool': {
            handleMeasureTool();
            break;
        }
        case 'surfaceThicken': {
            handleSurfaceThicken();
            break;
        }
        case 'planarRingProcess': {
            handlePlanarRingProcess();
            break;
        }
        default: {
            console.log('Unknown MBS action:', action);
        }
    }
}
// ============================================================================
// Message Handling
// ============================================================================

function handleMessage(event: MessageEvent): void {
    const message = event.data;
    switch (message.command) {
        case 'loadStepFile':
            loadStepFile(message.fileName, message.fileContent);
            break;
        case 'fitView':
            viewer?.fitToView();
            break;
        case 'setStatus':
            setStatus(message.text);
            break;
        case 'updateModelTree':
            // External update from extension
            break;
        case 'updateProperties':
            updatePropertiesPanel(message.shapeId);
            break;
        case 'mbsAction':
            handleMbsAction(message.action, message);
            break;
        case 'requestCadtoolConfigExport':
            exportCadtoolConfig();
            break;
        case 'importCadtoolConfig':
            importCadtoolConfig(
                message.data,
                typeof message.fileName === 'string' ? message.fileName : undefined
            );
            break;
    }
}

// ============================================================================
// Initialization
// ============================================================================

async function initViewer(): Promise<void> {
    const container = document.getElementById('canvas-container');
    if (container) {
        const config = normalizeRenderConfig(renderConfig);
        renderConfig = config;

        viewer = new ThreeViewer(container, {
            backgroundColor: 0x2a2a2a,
            enableSelection: true,
            selectionOptions: {
                highlightColor: 0x58a6ff,
                highlightOpacity: 0.32
            },
            visualPreset: config.visualPreset
        });

        // Listen for selection changes from 3D viewer
        viewer.onSelectionChange((event) => {
            if (event.type === 'select' && event.objectId) {
                // Map mesh ID to shape ID
                const shapeId = meshIdToShapeId.get(event.objectId);
                if (shapeId) {
                    selectShape(shapeId, true); // fromViewer = true to avoid selection loop
                } else {
                    console.warn('[Viewer Selection] No shape ID found for mesh:', event.objectId);
                }
            } else if (event.type === 'deselect') {
                // Clear selection in tree
                const prevSelected = document.querySelector('.tree-node.selected');
                if (prevSelected) {
                    prevSelected.classList.remove('selected');
                }
                selectedShapeId = null;
                updatePropertiesPanel(null);
            }
        });

        // Add click listener for marker creation
        container.addEventListener('click', handleCanvasClick);

        applyRenderConfigToViewer();
    }
}

async function init(): Promise<void> {
    if (isInitialized) return;

    setStatus('Initializing...');

    try {
        // Initialize viewer
        await initViewer();

        // Initialize OCCT in background
        initOcct().catch(err => {
            console.warn('OCCT initialization deferred:', err);
        });

        isInitialized = true;
        setStatus('Ready');

        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });

    } catch (error) {
        console.error('Initialization failed:', error);
        setStatus('Initialization failed');
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

window.addEventListener('message', handleMessage);

document.addEventListener('DOMContentLoaded', () => {
    setupRenderConfigUI();
    init();

    // Panel close button handler
    document.getElementById('panel-header-close')?.addEventListener('click', () => {
        closeOptionsPanel();
    });

    // Button handlers
    document.getElementById('btn-import')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'importStep' });
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
        exportModel();
    });

    // Ribbon button handlers — direct dispatch to handleMbsAction
    document.querySelectorAll('.ribbon-btn[data-action-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const actionId = (btn as HTMLElement).dataset.actionId;
            if (!actionId) return;

            const params: Record<string, unknown> = {};
            if (actionId.startsWith('createJoint_')) {
                params.jointType = actionId.replace('createJoint_', '');
                handleMbsAction('createJoint', params);
            } else if (actionId.startsWith('createMotion_')) {
                params.motionType = actionId.replace('createMotion_', '');
                handleMbsAction('createMotion', params);
            } else {
                handleMbsAction(actionId, params);
            }
        });
    });

    document.getElementById('btn-fit')?.addEventListener('click', () => {
        viewer?.fitToView();
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
        clearScene();
    });

    document.getElementById('btn-explode')?.addEventListener('click', () => {
        toggleExplode();
    });

    // Explode slider listeners
    const explodeSlider = document.getElementById('explode-slider') as HTMLInputElement;
    if (explodeSlider) {
        explodeSlider.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = parseInt(target.value);
            updateExplodeDistance(value);
        });
    }

    const explodeSliderClose = document.getElementById('explode-slider-close');
    if (explodeSliderClose) {
        explodeSliderClose.addEventListener('click', () => {
            if (isExploded) {
                toggleExplode();
            }
        });
    }
});
