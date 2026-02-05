// WebView entry point
// This file will be bundled by Vite for the WebView

import { ThreeViewer } from '@cadtool-online/three';

declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

let viewer: ThreeViewer | null = null;

function initViewer() {
    const container = document.getElementById('canvas-container');
    if (container) {
        viewer = new ThreeViewer(container);
    }
}

function handleMessage(event: MessageEvent) {
    const message = event.data;
    switch (message.command) {
        case 'loadModel':
            // TODO: Load model from STEP data
            break;
        case 'fitView':
            viewer?.fitToView();
            break;
    }
}

window.addEventListener('message', handleMessage);

document.addEventListener('DOMContentLoaded', () => {
    initViewer();

    document.getElementById('btn-import')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'importStep' });
    });

    document.getElementById('btn-fit')?.addEventListener('click', () => {
        viewer?.fitToView();
    });
});
