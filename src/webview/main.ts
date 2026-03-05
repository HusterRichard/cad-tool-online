// WebView entry point
// This file will be bundled by Vite for the WebView

import { ThreeViewer } from '@cadtool-online/three';
import { OcctWrapper, type StepReadResult } from '@cadtool-online/geo';
import type { MeshData } from '@cadtool-online/core';
import { markerCreator, type MbsMarker } from '@cadtool-online/core';

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
let isCreatingMarker = false;
const createdMarkers: MbsMarker[] = [];

// Explode view state
let isExploded = false;
let explodeDistance = 0;
interface ExplodeData {
    meshId: string;
    originalPosition: { x: number; y: number; z: number };
    explodeDirection: { x: number; y: number; z: number };
}
const explodeDataMap: Map<string, ExplodeData> = new Map();

type MaterialMode = 'matcap' | 'pbr' | 'flat' | 'phong';
type PrecisionPreset = 'coarse' | 'balanced' | 'fine';

interface RenderConfigState {
    materialMode: MaterialMode;
    postProcessing: boolean;
    edgeLayerVisible: boolean;
    precisionPreset: PrecisionPreset;
}

const DEFAULT_RENDER_CONFIG: RenderConfigState = {
    materialMode: 'matcap',
    postProcessing: true,
    edgeLayerVisible: true,
    precisionPreset: 'balanced'
};

let renderConfig: RenderConfigState = loadRenderConfigState();

interface ViewerCapabilityMethods {
    setMaterialMode: (mode: MaterialMode) => void;
    setPostProcessingEnabled: (enabled: boolean) => void;
    setOutlineEnabled: (enabled: boolean) => void;
    setEdgeLayerVisible: (visible: boolean) => void;
    setEdgesVisible: (visible: boolean) => void;
    setEdgeVisibility: (visible: boolean) => void;
}

function loadRenderConfigState(): RenderConfigState {
    const state = vscode.getState() as { renderConfig?: Partial<RenderConfigState> } | undefined;
    const stored = state?.renderConfig;
    if (!stored) {
        return { ...DEFAULT_RENDER_CONFIG };
    }

    return {
        materialMode: isMaterialMode(stored.materialMode) ? stored.materialMode : DEFAULT_RENDER_CONFIG.materialMode,
        postProcessing: typeof stored.postProcessing === 'boolean' ? stored.postProcessing : DEFAULT_RENDER_CONFIG.postProcessing,
        edgeLayerVisible: typeof stored.edgeLayerVisible === 'boolean' ? stored.edgeLayerVisible : DEFAULT_RENDER_CONFIG.edgeLayerVisible,
        precisionPreset: isPrecisionPreset(stored.precisionPreset) ? stored.precisionPreset : DEFAULT_RENDER_CONFIG.precisionPreset
    };
}

function saveRenderConfigState(): void {
    const existingState = vscode.getState() as Record<string, unknown> | undefined;
    vscode.setState({
        ...(existingState ?? {}),
        renderConfig
    });
}

function isMaterialMode(value: unknown): value is MaterialMode {
    return value === 'matcap' || value === 'pbr' || value === 'flat' || value === 'phong';
}

function isPrecisionPreset(value: unknown): value is PrecisionPreset {
    return value === 'coarse' || value === 'balanced' || value === 'fine';
}

function invokeViewerMethod(methodNames: Array<keyof ViewerCapabilityMethods>, ...args: unknown[]): boolean {
    if (!viewer) {
        return false;
    }

    const target = viewer as unknown as Record<string, unknown>;
    for (const methodName of methodNames) {
        const method = target[methodName as string];
        if (typeof method === 'function') {
            (method as (...fnArgs: unknown[]) => void)(...args);
            return true;
        }
    }

    return false;
}

function applyRenderConfigToViewer(): void {
    const materialApplied = invokeViewerMethod(['setMaterialMode'], renderConfig.materialMode);
    const postApplied =
        invokeViewerMethod(['setPostProcessingEnabled'], renderConfig.postProcessing)
        || invokeViewerMethod(['setOutlineEnabled'], renderConfig.postProcessing);
    const edgeApplied =
        invokeViewerMethod(['setEdgeLayerVisible'], renderConfig.edgeLayerVisible)
        || invokeViewerMethod(['setEdgesVisible'], renderConfig.edgeLayerVisible)
        || invokeViewerMethod(['setEdgeVisibility'], renderConfig.edgeLayerVisible);

    if (!materialApplied || !postApplied || !edgeApplied) {
        const missing: string[] = [];
        if (!materialApplied) missing.push('材质');
        if (!postApplied) missing.push('后处理');
        if (!edgeApplied) missing.push('边线');
        setStatusInfo(`部分渲染能力尚未接入：${missing.join(' / ')}`);
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
            if (meshData && meshData.vertices.length > 0) {
                viewer.removeMesh(shape.meshId);
                viewer.addMeshFromData(shape.meshId, meshData);
                viewer.setVisibility(shape.meshId, shape.visible);
                if (shape.color) {
                    const colorHex = parseInt(shape.color.replace('#', ''), 16);
                    viewer.setMeshColor(shape.meshId, colorHex);
                }
                shape.meshData = meshData;
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
        setStatusInfo(`精度已更新：${updatedCount}/${remeshTargets.length} 个部件`);
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
    if (renderConfig.precisionPreset === preset) {
        return;
    }

    renderConfig.precisionPreset = preset;
    saveRenderConfigState();

    if (loadedShapes.size > 0) {
        await remeshLoadedModelWithCurrentPrecision();
        return;
    }

    setStatusInfo(`网格精度预设：${preset}`);
}

function applyRenderControls(
    updates: Partial<Pick<RenderConfigState, 'materialMode' | 'postProcessing' | 'edgeLayerVisible'>>
): void {
    renderConfig = { ...renderConfig, ...updates };
    saveRenderConfigState();
    applyRenderConfigToViewer();
}

function setupRenderConfigUI(): void {
    const materialSelect = document.getElementById('render-material-mode') as HTMLSelectElement | null;
    const postCheckbox = document.getElementById('render-postprocessing') as HTMLInputElement | null;
    const edgeCheckbox = document.getElementById('render-edge-layer') as HTMLInputElement | null;
    const precisionSelect = document.getElementById('render-precision') as HTMLSelectElement | null;

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
        expandBtn.textContent = '▶';
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
    visibilityBtn.textContent = shape.visible ? '👁' : '👁‍🗨';
    visibilityBtn.title = shape.visible ? 'Hide' : 'Show';
    visibilityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVisibility(shape.id);
    });
    node.appendChild(visibilityBtn);

    // Icon based on type
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = shape.type === 'assembly' ? '📁' : (shape.type === 'part' ? '🔧' : '📦');
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
        expandBtn.textContent = isExpanded ? '▶' : '▼';
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

function updatePropertiesPanel(shapeId: string | null): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    if (!shapeId) {
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">Select an object to view properties</div>';
        return;
    }

    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">Shape not found</div>';
        return;
    }

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
                <button class="color-change-btn" data-shape-id="${shapeId}" style="margin-left: auto; padding: 2px 8px; background: #007acc; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Change</button>
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

    // Try to get mass properties
    if (occt && shape.shapeId && occt.hasShape(shape.shapeId)) {
        try {
            const massProps = occt.getMassProperties(shape.shapeId);
            if (massProps) {
                html += '<div style="margin-top: 8px; font-weight: bold; color: #9cdcfe;">Mass Properties</div>';
                html += createPropertyRow('Volume', `${massProps.volume.toFixed(6)} mm³`);
                html += createPropertyRow('Surface', `${massProps.surfaceArea.toFixed(6)} mm²`);
                html += createPropertyRow('Mass', `${massProps.mass.toFixed(6)} kg`);
                html += createPropertyRow('CoM X', `${massProps.centerOfMass.x.toFixed(4)} mm`);
                html += createPropertyRow('CoM Y', `${massProps.centerOfMass.y.toFixed(4)} mm`);
                html += createPropertyRow('CoM Z', `${massProps.centerOfMass.z.toFixed(4)} mm`);
            }
        } catch (e) {
            console.warn('Failed to get mass properties:', e);
        }
    }

    propsEl.innerHTML = html;

    // Add event listeners for color change buttons
    propsEl.querySelectorAll('.color-change-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetShapeId = (e.target as HTMLElement).dataset.shapeId;
            if (targetShapeId) {
                showColorPicker(targetShapeId);
            }
        });
    });
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
                    expandBtn.textContent = '▼';
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

            // Collect all shapes that need meshing
            const shapesToMesh: Array<{node: any, path: string}> = [];
            const collectShapes = (node: any, path: string) => {
                if (node.shapeId) {
                    shapesToMesh.push({node, path});
                }
                if (node.children) {
                    node.children.forEach((child: any, idx: number) => {
                        collectShapes(child, `${path}/${child.name || idx}`);
                    });
                }
            };
            result.rootNodes.forEach((root, idx) => collectShapes(root, root.name || `Root${idx}`));

            showProgress(40, `Generating meshes (0/${shapesToMesh.length})...`);
            console.log('[loadStepFile] Total shapes to mesh:', shapesToMesh.length);

            const validShapeIds = shapesToMesh
                .map(({ node }) => node.shapeId as string | undefined)
                .filter((shapeId): shapeId is string => Boolean(shapeId) && occt!.hasShape(shapeId));
            const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
            const meshByShapeId = occt!.getMeshes(validShapeIds, linearDeflection, angularDeflection);

            // Attach meshes to all nodes
            for (let i = 0; i < shapesToMesh.length; i++) {
                const {node} = shapesToMesh[i];
                if (node.shapeId) {
                    const meshData = meshByShapeId.get(node.shapeId) ?? null;
                    if (meshData && meshData.vertices.length > 0) {
                        node._meshData = meshData;
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
                        viewer.addMeshFromData(meshId, node._meshData);

                        // Apply color if available
                        if (node.color) {
                            const colorHex = parseInt(node.color.replace('#', ''), 16);
                            viewer.setMeshColor(meshId, colorHex);
                        }
                    }
                    shape.meshId = meshId;
                    shape.meshData = node._meshData;

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
                if (meshData && meshData.vertices.length > 0) {
                    const meshId = `mesh_${shapeId}`;
                    const shape: LoadedShape = {
                        id: shapeId,
                        name: shapeId,
                        type: 'solid',
                        shapeId,
                        meshId,
                        meshData,
                        visible: true
                    };

                    // Add to viewer
                    if (viewer) {
                        viewer.addMeshFromData(meshId, meshData);
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
        function collectParts(shape: LoadedShape): void {
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
        }

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
    explodeDataMap.clear();

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

    isCreatingMarker = true;
    setStatus('Click on a face to create marker (法向向外)');
    setStatusInfo('Marker creation mode active');

    // Change cursor to crosshair
    const container = document.getElementById('canvas-container');
    if (container) {
        container.style.cursor = 'crosshair';
    }

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the marker. The Z-axis will point outward along the face normal.'
    });
}

/**
 * Handle click on canvas to create marker
 */
function handleCanvasClick(event: MouseEvent): void {
    if (!isCreatingMarker || !viewer || !occt || !selectedShapeId) return;

    const selectedShape = loadedShapes.get(selectedShapeId);
    if (!selectedShape || !selectedShape.shapeId) {
        console.warn('Selected shape has no shapeId');
        return;
    }

    // Get click position in canvas coordinates
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Get ray from camera through click point
    const ray = viewer.getRayFromScreenPoint(x, y);
    if (!ray) {
        console.warn('Failed to get ray from screen point');
        return;
    }

    console.log('[Marker Creation] Ray:', ray);

    // Call OCCT to get face normal at intersection point
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
        return;
    }

    console.log('[Marker Creation] Face normal result:', result);

    // Create marker using MarkerCreator
    const marker = markerCreator.createMarker({
        position: result.position,
        normal: result.normal,
        groupId: selectedShape.id, // Use selected shape as parent
        name: `Marker${createdMarkers.length + 1}`
    });

    createdMarkers.push(marker);

    // Visualize marker in 3D viewer
    if (viewer) {
        viewer.addFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            isPrimary: true
        });
    }

    console.log('[Marker Creation] Created marker:', marker);

    // Exit marker creation mode
    isCreatingMarker = false;
    const container2 = document.getElementById('canvas-container');
    if (container2) {
        container2.style.cursor = 'default';
    }

    setStatus('Ready');
    setStatusInfo(`Marker created: ${marker.name}`);

    vscode.postMessage({
        command: 'alert',
        text: `Marker "${marker.name}" created successfully at position (${result.position.x.toFixed(2)}, ${result.position.y.toFixed(2)}, ${result.position.z.toFixed(2)})`
    });
}

function handleMbsAction(action: string, params: Record<string, unknown>): void {
    console.log('[MBS Action]', action, params);

    switch (action) {
        // 分组设计
        case 'createGroup':
            console.log('Creating new MBS group...');
            // TODO: 实现创建分组逻辑
            break;
        case 'createChildGroup':
            console.log('Creating child group...');
            // TODO: 实现创建子分组逻辑
            break;
        case 'groupProperties':
            console.log('Showing group properties...');
            // TODO: 实现分组属性面板
            break;

        // 标架设计
        case 'createFrame':
            console.log('Creating new frame...');
            startMarkerCreation();
            break;
        case 'editFrame':
            console.log('Editing frame...');
            // TODO: 实现编辑标架逻辑
            break;
        case 'deleteFrame':
            console.log('Deleting frame...');
            if (createdMarkers.length === 0) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No markers to delete'
                });
                return;
            }
            // Delete the last created marker
            const lastMarker = createdMarkers.pop();
            if (lastMarker && viewer) {
                viewer.removeFrame(lastMarker.id);
                vscode.postMessage({
                    command: 'alert',
                    text: `Marker "${lastMarker.name}" deleted`
                });
                setStatusInfo(`Marker deleted: ${lastMarker.name}`);
            }
            break;

        // 关节设计
        case 'createJoint':
            const jointType = params.jointType as string;
            console.log(`Creating ${jointType} joint...`);
            // TODO: 实现创建关节逻辑
            break;

        // 驱动设计
        case 'createMotion':
            const motionType = params.motionType as string;
            console.log(`Creating ${motionType} motion...`);
            // TODO: 实现创建驱动逻辑
            break;
        case 'motionProperties':
            console.log('Showing motion properties...');
            // TODO: 实现驱动属性面板
            break;

        default:
            console.log('Unknown MBS action:', action);
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
    }
}

// ============================================================================
// Initialization
// ============================================================================

async function initViewer(): Promise<void> {
    const container = document.getElementById('canvas-container');
    if (container) {
        viewer = new ThreeViewer(container, {
            backgroundColor: 0x2a2a2a,
            enableSelection: true
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

    // Button handlers
    document.getElementById('btn-import')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'importStep' });
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
        exportModel();
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

