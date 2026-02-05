// WebView entry point
// This file will be bundled by Vite for the WebView

import { ThreeViewer } from '@cadtool-online/three';
import { OcctWrapper, type StepReadResult } from '@cadtool-online/geo';
import type { MeshData } from '@cadtool-online/core';

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

// Loaded shapes tracking
interface LoadedShape {
    id: string;
    name: string;
    meshData?: MeshData;
}
const loadedShapes: Map<string, LoadedShape> = new Map();
let selectedShapeId: string | null = null;

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

function updateModelTree(): void {
    const treeEl = document.getElementById('model-tree');
    if (!treeEl) return;

    if (loadedShapes.size === 0) {
        treeEl.innerHTML = '<div style="color: #808080; font-style: italic;">No model loaded</div>';
        return;
    }

    treeEl.innerHTML = '';
    loadedShapes.forEach((shape, id) => {
        const node = document.createElement('div');
        node.className = 'tree-node';
        if (id === selectedShapeId) {
            node.classList.add('selected');
        }
        node.dataset.shapeId = id;

        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = '📦';

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = shape.name;

        node.appendChild(icon);
        node.appendChild(name);

        node.addEventListener('click', () => selectShape(id));

        treeEl.appendChild(node);
    });
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

    // Mesh info
    if (shape.meshData) {
        const vertexCount = shape.meshData.vertices.length / 3;
        const triangleCount = shape.meshData.indices.length / 3;
        html += createPropertyRow('Vertices', vertexCount.toLocaleString());
        html += createPropertyRow('Triangles', triangleCount.toLocaleString());
    }

    // Try to get mass properties
    if (occt && occt.hasShape(shapeId)) {
        try {
            const massProps = occt.getMassProperties(shapeId);
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
}

function createPropertyRow(label: string, value: string): string {
    return `<div class="property-row">
        <span class="property-label">${label}</span>
        <span class="property-value">${value}</span>
    </div>`;
}

function selectShape(shapeId: string): void {
    // Update selection in tree
    const prevSelected = document.querySelector('.tree-node.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    const newSelected = document.querySelector(`.tree-node[data-shape-id="${shapeId}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');
    }

    selectedShapeId = shapeId;

    // Update 3D selection
    if (viewer) {
        viewer.clearSelection();
        viewer.select(shapeId);
    }

    // Update properties panel
    updatePropertiesPanel(shapeId);

    // Notify extension
    vscode.postMessage({ command: 'selectShape', shapeId });
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

async function loadStepFile(fileName: string, base64Content: string): Promise<void> {
    console.log('[loadStepFile] Starting to load:', fileName);

    // Always wait for OCCT to be fully initialized
    await initOcct();
    console.log('[loadStepFile] OCCT initialized');

    showLoading(`Loading ${fileName}...`);
    showProgress(0, 'Decoding file...');
    setStatus(`Loading ${fileName}...`);

    // Yield to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('[loadStepFile] UI updated, starting decode');

    try {
        // Decode base64 to ArrayBuffer
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;
        console.log('[loadStepFile] Decoded base64, size:', arrayBuffer.byteLength);

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

        showProgress(30, `Generating mesh (0/${result.shapes.length})...`);
        setStatus(`Generating mesh for ${result.shapes.length} shapes...`);
        // Yield to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log('[loadStepFile] Starting mesh generation for', result.shapes.length, 'shapes');

        // Generate meshes and add to viewer
        let addedCount = 0;
        const totalShapes = result.shapes.length;
        for (let i = 0; i < totalShapes; i++) {
            const shapeId = result.shapes[i];
            const meshData = occt!.getMesh(shapeId);
            if (meshData && meshData.vertices.length > 0) {
                // Add to viewer
                if (viewer) {
                    viewer.addMeshFromData(shapeId, meshData);
                }

                // Track loaded shape
                loadedShapes.set(shapeId, {
                    id: shapeId,
                    name: shapeId,
                    meshData
                });

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
// Clear Scene
// ============================================================================

function clearScene(): void {
    // Remove all meshes from viewer
    loadedShapes.forEach((_, id) => {
        if (viewer) {
            viewer.removeMesh(id);
        }
        if (occt) {
            occt.deleteShape(id);
        }
    });

    loadedShapes.clear();
    selectedShapeId = null;

    updateModelTree();
    updatePropertiesPanel(null);
    setStatusInfo('');
    setStatus('Ready');
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

        // Listen for selection changes
        viewer.onSelectionChange((event) => {
            if (event.type === 'select' && event.objectId) {
                selectShape(event.objectId);
            }
        });
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
    init();

    // Button handlers
    document.getElementById('btn-import')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'importStep' });
    });

    document.getElementById('btn-fit')?.addEventListener('click', () => {
        viewer?.fitToView();
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
        clearScene();
    });
});
