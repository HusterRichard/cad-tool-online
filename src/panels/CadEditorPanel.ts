import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCssVariables } from '@cadtool-online/ui';

export class CadEditorPanel {
    public static currentPanel: CadEditorPanel | undefined;
    public static readonly viewType = 'cadtoolOnline.cadEditor';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // Model state
    private _loadedShapes: Map<string, { name: string; meshData?: unknown }> = new Map();

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CadEditorPanel.currentPanel) {
            CadEditorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CadEditorPanel.viewType,
            'CAD Editor',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        CadEditorPanel.currentPanel = new CadEditorPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                    case 'importStep':
                        await this._handleImportStep();
                        return;
                    case 'exportModel':
                        await this._handleExportModel(message.data);
                        return;
                    case 'exportCadtoolConfig':
                        await this._handleExportCadtoolConfig(message.data);
                        return;
                    case 'fitView':
                        // Handled in webview
                        return;
                    case 'selectShape':
                        this._handleSelectShape(message.shapeId);
                        return;
                    case 'ready':
                        // Webview is ready
                        this._onWebviewReady();
                        return;
                    case 'ribbonAction':
                        this._handleRibbonAction(message.action, message.params);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleImportStep(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Import STEP',
            filters: {
                'STEP Files': ['step', 'stp', 'STEP', 'STP'],
                'All Files': ['*']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            return;
        }

        const filePath = fileUri[0].fsPath;
        const fileName = path.basename(filePath);

        try {
            this._setStatus(`Loading ${fileName}...`);

            // Read file content and send raw bytes to avoid base64 overhead
            const fileContent = fs.readFileSync(filePath);
            const fileBytes = new Uint8Array(fileContent);

            // Send to webview for processing
            this._panel.webview.postMessage({
                command: 'loadStepFile',
                fileName: fileName,
                fileContent: fileBytes
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load STEP file: ${error}`);
            this._setStatus('Ready');
        }
    }

    private async _handleExportModel(data: string): Promise<void> {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export Model',
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            },
            defaultUri: vscode.Uri.file('model_export.json')
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (!fileUri) {
            return;
        }

        try {
            // Write JSON data to file
            fs.writeFileSync(fileUri.fsPath, data, 'utf-8');
            const fileName = path.basename(fileUri.fsPath);
            vscode.window.showInformationMessage(`Model exported successfully to ${fileName}`);
            this._setStatus('Ready');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export model: ${error}`);
            this._setStatus('Ready');
        }
    }

    private async _handleImportCadtoolConfig(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Import CADTool Config',
            filters: {
                'CADTool Config': ['json'],
                'All Files': ['*']
            },
            defaultUri: workspaceRoot
                ? vscode.Uri.joinPath(workspaceRoot, 'cadtool.config.json')
                : vscode.Uri.file('cadtool.config.json')
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            return;
        }

        const configPath = fileUri[0].fsPath;
        const fileName = path.basename(configPath);

        try {
            this._setStatus(`Importing ${fileName}...`);
            const fileContent = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(fileContent) as unknown;

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                vscode.window.showErrorMessage('CADTool config must be a JSON object.');
                this._setStatus('Ready');
                return;
            }

            this._panel.webview.postMessage({
                command: 'importCadtoolConfig',
                fileName,
                data: parsed
            });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to import CADTool config: ${detail}`);
            this._setStatus('Ready');
        }
    }

    private async _handleExportCadtoolConfig(data: unknown): Promise<void> {
        const serializedData = typeof data === 'string'
            ? data
            : JSON.stringify(data ?? {}, null, 2);

        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export CADTool Config',
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            },
            defaultUri: vscode.Uri.file('cadtool.config.json')
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (!fileUri) {
            return;
        }

        try {
            fs.writeFileSync(fileUri.fsPath, serializedData, 'utf-8');
            const fileName = path.basename(fileUri.fsPath);
            vscode.window.showInformationMessage(`CADTool config exported successfully to ${fileName}`);
            this._setStatus('Ready');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export CADTool config: ${error}`);
            this._setStatus('Ready');
        }
    }

    private _handleSelectShape(shapeId: string): void {
        const shape = this._loadedShapes.get(shapeId);
        if (shape) {
            // Update properties panel
            this._panel.webview.postMessage({
                command: 'updateProperties',
                shapeId: shapeId,
                shapeName: shape.name
            });
        }
    }

    private _onWebviewReady(): void {
        this._setStatus('Ready');
    }

    private _handleRibbonAction(action: string, params?: Record<string, unknown>): void {
        switch (action) {
            case 'createGroup':
                vscode.window.showInformationMessage('Create group');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createGroup'
                });
                break;
            case 'createChildGroup':
                vscode.window.showInformationMessage('Create child group');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createChildGroup'
                });
                break;
            case 'groupProperties':
                vscode.window.showInformationMessage('Show group properties');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'groupProperties'
                });
                break;

            case 'createFrame':
                vscode.window.showInformationMessage('Create frame');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createFrame'
                });
                break;
            case 'editFrame':
                vscode.window.showInformationMessage('Edit frame');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'editFrame'
                });
                break;
            case 'deleteFrame':
                vscode.window.showInformationMessage('Delete frame');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'deleteFrame'
                });
                break;

            case 'createJoint_revolute':
            case 'createJoint_prismatic':
            case 'createJoint_cylindrical':
            case 'createJoint_spherical':
            case 'createJoint_universal':
            case 'createJoint_planar':
            case 'createJoint_fixed': {
                const jointType = (params?.jointType as string | undefined) ?? action.replace('createJoint_', '');
                vscode.window.showInformationMessage(`Create ${jointType} joint`);
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createJoint',
                    jointType: jointType
                });
                break;
            }

            case 'createMotion_rotational':
                vscode.window.showInformationMessage('Create rotational motion');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createMotion',
                    motionType: 'rotational'
                });
                break;
            case 'createMotion_translational':
                vscode.window.showInformationMessage('Create translational motion');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createMotion',
                    motionType: 'translational'
                });
                break;
            case 'motionProperties':
                vscode.window.showInformationMessage('Show motion properties');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'motionProperties'
                });
                break;

            case 'fluidTankSlice':
            case 'fluidPort':
            case 'measureTool':
            case 'surfaceThicken':
            case 'planarRingProcess': {
                const actionMessages: Record<string, string> = {
                    fluidTankSlice: 'Creating fluid tank slice',
                    fluidPort: 'Creating fluid port',
                    measureTool: 'Running measurement tool',
                    surfaceThicken: 'Running surface thicken',
                    planarRingProcess: 'Running planar ring process'
                };

                vscode.window.showInformationMessage(actionMessages[action] ?? `Executing action: ${action}`);
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: action
                });
                break;
            }

            default:
                vscode.window.showInformationMessage(`Unknown Ribbon action: ${action}`);
                console.log('Unknown ribbon action:', action, params);
        }
    }

    private _setStatus(text: string): void {
        this._panel.webview.postMessage({
            command: 'setStatus',
            text: text
        });
    }

    public updateModelTree(shapes: Array<{ id: string; name: string }>): void {
        this._panel.webview.postMessage({
            command: 'updateModelTree',
            shapes: shapes
        });
    }

    public requestCadtoolConfigExport(): void {
        this._panel.webview.postMessage({
            command: 'requestCadtoolConfigExport'
        });
    }

    public async requestCadtoolConfigImport(): Promise<void> {
        await this._handleImportCadtoolConfig();
    }

    public dispose() {
        CadEditorPanel.currentPanel = undefined;

        this._panel.dispose();
        this._loadedShapes.clear();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, this._extensionUri);
    }

    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        // Get URIs for webview resources
        const webviewUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'webview.js')
        );

        // Get URI for WASM files
        const wasmUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'wasm')
        );

        // Get URI for icon resources
        const icons32 = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'public', 'icons', 'png', '32')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; connect-src ${webview.cspSource};">
    <title>CAD Editor</title>
    <style>
        ${generateCssVariables('light')}
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background-color: var(--color-bg-base);
            color: var(--color-text-primary);
            font-family: var(--font-family);
        }
        .container {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .main-body {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .sidebar {
            width: 265px;
            background-color: var(--color-bg-surface);
            border-right: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .sidebar-right {
            width: 280px;
            background-color: var(--color-bg-surface);
            border-left: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .panel {
            border-bottom: 1px solid var(--color-border);
        }
        .panel-header {
            padding: var(--spacing-md) var(--spacing-lg);
            background-color: var(--color-bg-elevated);
            font-size: var(--font-size-sm);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
        }
        .panel-header:hover {
            background-color: var(--color-bg-hover);
        }
        .panel-content {
            padding: var(--spacing-md);
            font-size: var(--font-size-lg);
        }
        .viewport {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        #canvas-container {
            width: 100%;
            height: 100%;
            position: relative;
            background: linear-gradient(to bottom, #c8cfd6 0%, #e8ecf0 100%);
        }
        /* Ribbon Bar Styles */
        .ribbon-bar {
            display: flex;
            background: var(--color-bg-elevated);
            border-bottom: 1px solid var(--color-border-hover);
            padding: 4px 8px;
            height: 100px;
            flex-shrink: 0;
            gap: 6px;
            overflow-x: auto;
        }
        .ribbon-tab-group {
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            min-width: 50px;
            gap: 2px;
        }
        .ribbon-tab-content {
            display: flex;
            gap: 4px;
            flex: 1;
            align-items: flex-start;
            padding-top: 4px;
        }
        .ribbon-tab-label {
            font-size: 11px;
            color: var(--color-text-muted);
            text-align: center;
            padding: 2px 0;
            border-top: 1px solid var(--color-border-subtle);
            margin-top: auto;
        }
        .ribbon-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2px 4px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 3px;
            color: var(--color-text-secondary);
            cursor: pointer;
            font-family: inherit;
            min-width: 46px;
            gap: 2px;
        }
        .ribbon-btn:hover {
            background: var(--color-bg-hover);
            border-color: var(--color-border);
        }
        .ribbon-btn:active {
            background: var(--color-bg-active);
        }
        .ribbon-btn.has-dropdown {
            position: relative;
        }
        .ribbon-btn-icon {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
        }
        .ribbon-btn-icon img {
            width: 32px;
            height: 32px;
            object-fit: contain;
        }
        .ribbon-btn-text {
            font-size: 11px;
            white-space: nowrap;
            color: var(--color-text-secondary);
        }
        .ribbon-btn-arrow {
            font-size: 8px;
            opacity: 0.6;
        }
        .ribbon-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            min-width: 200px;
            background-color: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-dropdown);
            z-index: 1000;
            padding: 4px 0;
            display: none;
        }
        .ribbon-dropdown.show {
            display: block;
        }
        .ribbon-dropdown-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            cursor: pointer;
            font-size: var(--font-size-lg);
            color: var(--color-text-primary);
        }
        .ribbon-dropdown-item:hover {
            background-color: var(--color-bg-active);
        }
        .ribbon-dropdown-item-icon {
            width: 20px;
            text-align: center;
            font-size: 14px;
        }
        .ribbon-dropdown-item-label {
            flex: 1;
        }
        .ribbon-separator {
            width: 1px;
            background: var(--color-border-hover);
            margin: 4px 0;
            align-self: stretch;
        }
        .status-bar {
            height: 24px;
            background-color: var(--color-accent-bg);
            color: var(--color-text-on-accent);
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-size: 12px;
            flex-shrink: 0;
        }
        .status-bar .status-text {
            flex: 1;
        }
        .status-bar .status-info {
            margin-left: 20px;
            opacity: 0.8;
        }
        /* Model tree styles */
        .tree-node-container {
            display: block;
        }
        .tree-node {
            padding: 4px 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .tree-node:hover {
            background-color: var(--color-bg-hover);
        }
        .tree-node.selected {
            background-color: var(--color-bg-active);
        }
        .tree-node .expand-btn {
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            cursor: pointer;
            user-select: none;
            color: var(--color-text-muted);
        }
        .tree-node .expand-btn:hover {
            color: var(--color-text-primary);
        }
        .tree-node .visibility-btn {
            width: 18px;
            height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
            user-select: none;
            opacity: 0.7;
        }
        .tree-node .visibility-btn:hover {
            opacity: 1;
        }
        .tree-node .icon {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        .tree-node .name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tree-children {
            display: none;
        }
        .tree-children.expanded {
            display: block;
        }
        /* Properties styles */
        .property-row {
            display: flex;
            padding: 4px 0;
            border-bottom: 1px solid var(--color-border);
        }
        .property-label {
            width: 100px;
            color: var(--color-text-muted);
            font-size: var(--font-size-md);
        }
        .property-value {
            flex: 1;
            font-size: var(--font-size-md);
        }
        /* Loading overlay */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .loading-overlay.hidden {
            display: none;
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-border);
            border-top-color: var(--color-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-text {
            margin-top: 12px;
            color: var(--color-text-primary);
        }
        .progress-container {
            width: 200px;
            margin-top: 12px;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background-color: var(--color-border);
            border-radius: 3px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background-color: var(--color-accent);
            border-radius: 3px;
            transition: width 0.2s ease;
            width: 0%;
        }
        .progress-text {
            margin-top: 6px;
            font-size: 12px;
            color: var(--color-text-disabled);
        }
        /* Explode slider */
        .explode-slider-container {
            position: absolute;
            top: 90px;
            right: 20px;
            background-color: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: 6px;
            padding: 15px 20px;
            box-shadow: var(--shadow-dropdown);
            z-index: 100;
            display: none;
            min-width: 280px;
        }
        .explode-slider-container.show {
            display: block;
        }
        .explode-slider-header {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--color-text-primary);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .explode-slider-close {
            cursor: pointer;
            font-size: 18px;
            color: var(--color-text-muted);
            line-height: 1;
            padding: 0 4px;
        }
        .explode-slider-close:hover {
            color: var(--color-text-primary);
        }
        .explode-slider-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .explode-slider {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            appearance: none;
            background: var(--color-border);
            outline: none;
            border-radius: 3px;
        }
        .explode-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: var(--color-accent);
            cursor: pointer;
            border-radius: 50%;
        }
        .explode-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: var(--color-accent);
            cursor: pointer;
            border-radius: 50%;
            border: none;
        }
        .explode-slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--color-text-muted);
        }
        .explode-slider-value {
            text-align: center;
            font-size: 13px;
            color: var(--color-text-primary);
            font-weight: 600;
        }
        /* Render config panel */
        .render-config-panel {
            position: absolute;
            top: 90px;
            right: 320px;
            background-color: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: 6px;
            box-shadow: var(--shadow-dropdown);
            z-index: 101;
            display: none;
            min-width: 290px;
            padding: 14px 16px;
        }
        .render-config-panel.show {
            display: block;
        }
        .render-config-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--color-text-primary);
        }
        .render-config-close {
            cursor: pointer;
            font-size: 18px;
            color: var(--color-text-muted);
            line-height: 1;
            padding: 0 4px;
        }
        .render-config-close:hover {
            color: var(--color-text-primary);
        }
        .render-config-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 10px;
            font-size: 12px;
        }
        .render-config-row label {
            color: var(--color-text-secondary);
            flex: 1;
        }
        .render-config-row select {
            min-width: 140px;
            background: var(--color-bg-elevated);
            color: var(--color-text-primary);
            border: 1px solid var(--color-border-subtle);
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 12px;
        }
        .render-config-row input[type='checkbox'] {
            width: 14px;
            height: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Ribbon Bar (full width top) -->
        <div class="ribbon-bar">
            <!-- 文件 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" id="btn-import">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_import.png" alt="导入"></span>
                            <span class="ribbon-btn-text">导入</span>
                        </button>
                        <button class="ribbon-btn" id="btn-export">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_save_file.png" alt="导出"></span>
                            <span class="ribbon-btn-text">导出</span>
                        </button>
                        <button class="ribbon-btn" id="btn-fit">
                            <span class="ribbon-btn-icon"><img src="${icons32}/view_view_zoom_all.png" alt="适配"></span>
                            <span class="ribbon-btn-text">适配</span>
                        </button>
                        <button class="ribbon-btn" id="btn-clear">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_clear.png" alt="清除"></span>
                            <span class="ribbon-btn-text">清除</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">文件</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 分组 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createGroup">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_create_group.png" alt="组合"></span>
                            <span class="ribbon-btn-text">组合</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createChildGroup">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_ungroup.png" alt="分解"></span>
                            <span class="ribbon-btn-text">分解</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="groupProperties">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_create_default_group.png" alt="属性"></span>
                            <span class="ribbon-btn-text">属性</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">分组</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 基本形状 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createFrame">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_place_marker.png" alt="标架"></span>
                            <span class="ribbon-btn-text">标架</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="editFrame">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_design_pnt.png" alt="编辑"></span>
                            <span class="ribbon-btn-text">编辑</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="deleteFrame">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_delete.png" alt="删除"></span>
                            <span class="ribbon-btn-text">删除</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">基本形状</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 连接 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createJoint_fixed">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_fixed.png" alt="固定副"></span>
                            <span class="ribbon-btn-text">固定副</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_revolute">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_revolute.png" alt="转动副"></span>
                            <span class="ribbon-btn-text">转动副</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_prismatic">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_prismatic.png" alt="平移副"></span>
                            <span class="ribbon-btn-text">平移副</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_cylindrical">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_cylindrical.png" alt="圆柱副"></span>
                            <span class="ribbon-btn-text">圆柱副</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_spherical">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_spherical.png" alt="球副"></span>
                            <span class="ribbon-btn-text">球副</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_universal">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_universal.png" alt="万向节"></span>
                            <span class="ribbon-btn-text">万向节</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_planar">
                            <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_planar.png" alt="平面副"></span>
                            <span class="ribbon-btn-text">平面副</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">连接</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 驱动 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createMotion_rotational">
                            <span class="ribbon-btn-icon"><img src="${icons32}/motion_cad_rotational.png" alt="转动驱动"></span>
                            <span class="ribbon-btn-text">转动驱动</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createMotion_translational">
                            <span class="ribbon-btn-icon"><img src="${icons32}/motion_cad_translational.png" alt="平移驱动"></span>
                            <span class="ribbon-btn-text">平移驱动</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="motionProperties">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_option.png" alt="属性"></span>
                            <span class="ribbon-btn-text">属性</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">驱动</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 力 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="fluidTankSlice">
                            <span class="ribbon-btn-icon"><img src="${icons32}/force_cad_contact_point_point.png" alt="点点接触"></span>
                            <span class="ribbon-btn-text">点点接触</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="fluidPort">
                            <span class="ribbon-btn-icon"><img src="${icons32}/force_cad_contact_point_surface.png" alt="点面接触"></span>
                            <span class="ribbon-btn-text">点面接触</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">力</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 工具 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="measureTool">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_measure.png" alt="测量"></span>
                            <span class="ribbon-btn-text">测量</span>
                        </button>
                        <button class="ribbon-btn" id="btn-explode">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_exploded_view.png" alt="爆炸视图"></span>
                            <span class="ribbon-btn-text">爆炸视图</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="surfaceThicken">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_surface_thickening.png" alt="曲面加厚"></span>
                            <span class="ribbon-btn-text">曲面加厚</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="planarRingProcess">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_planar_loop_constraint.png" alt="平面环"></span>
                            <span class="ribbon-btn-text">平面环</span>
                        </button>
                        <button class="ribbon-btn" id="btn-render-config">
                            <span class="ribbon-btn-icon"><img src="${icons32}/cad_option.png" alt="渲染配置"></span>
                            <span class="ribbon-btn-text">渲染配置</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">工具</div>
                </div>
            </div>
        <!-- Main Body -->
        <div class="main-body">
            <!-- Left Sidebar: Model Tree -->
            <div class="sidebar">
                <div class="panel">
                    <div class="panel-header">模型浏览器</div>
                    <div class="panel-content" id="model-tree">
                        <div style="color: var(--color-text-disabled); font-style: italic;">未加载模型</div>
                    </div>
                </div>
            </div>
            <!-- Viewport -->
            <div class="viewport">
                <div id="canvas-container">
                <!-- Explode slider control -->
                <div class="explode-slider-container" id="explode-slider-container">
                    <div class="explode-slider-header">
                        <span>爆炸视图控制</span>
                        <span class="explode-slider-close" id="explode-slider-close">&times;</span>
                    </div>
                    <div class="explode-slider-wrapper">
                        <input type="range" class="explode-slider" id="explode-slider" min="0" max="100" value="0" step="1">
                        <div class="explode-slider-labels">
                            <span>0%</span>
                            <span>100%</span>
                        </div>
                        <div class="explode-slider-value" id="explode-slider-value">0%</div>
                    </div>
                </div>
                <div class="render-config-panel" id="render-config-panel">
                    <div class="render-config-header">
                        <span>渲染配置</span>
                        <span class="render-config-close" id="render-config-close">&times;</span>
                    </div>
                    <div class="render-config-row">
                        <label for="render-visual-preset">可视化预设</label>
                        <select id="render-visual-preset">
                            <option value="cad" selected>CAD</option>
                            <option value="cinematic">影院级</option>
                        </select>
                    </div>
                    <div class="render-config-row">
                        <label for="render-material-mode">材质模式</label>
                        <select id="render-material-mode">
                            <option value="matcap">Matcap</option>
                            <option value="pbr">PBR</option>
                            <option value="flat">Flat</option>
                            <option value="phong">Phong</option>
                        </select>
                    </div>
                    <div class="render-config-row">
                        <label for="render-postprocessing">后处理</label>
                        <input id="render-postprocessing" type="checkbox" checked>
                    </div>
                    <div class="render-config-row">
                        <label for="render-edge-layer">边缘层</label>
                        <input id="render-edge-layer" type="checkbox" checked>
                    </div>
                    <div class="render-config-row">
                        <label for="render-precision">网格精度</label>
                        <select id="render-precision">
                            <option value="coarse">粗糙</option>
                            <option value="balanced" selected>平衡</option>
                            <option value="fine">精细</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="loading-overlay hidden" id="loading-overlay">
                <div style="text-align: center;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text" id="loading-text">加载中...</div>
                    <div class="progress-container" id="progress-container" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill"></div>
                        </div>
                        <div class="progress-text" id="progress-text">0%</div>
                    </div>
                </div>
            </div>
            </div>
            <!-- Right Sidebar: Properties -->
            <div class="sidebar-right">
                <div class="panel">
                    <div class="panel-header">属性</div>
                    <div class="panel-content" id="properties-panel">
                        <div style="color: var(--color-text-disabled); font-style: italic;">选择对象以查看属性</div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Status Bar -->
        <div class="status-bar">
            <span class="status-text" id="status-text">初始化中...</span>
            <span class="status-info" id="status-info"></span>
        </div>
    </div>
    <script nonce="${nonce}">
        window.WASM_BASE_URL = "${wasmUri}";

        // Ribbon Menu Event Handling
        (function() {
            // Handle ribbon buttons with action
            document.querySelectorAll('.ribbon-btn[data-action-id]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const actionId = btn.dataset.actionId;
                    handleRibbonAction(actionId);
                });
            });

            function handleRibbonAction(actionId) {
                if (!actionId) {
                    return;
                }

                const params = {};

                if (actionId.startsWith('createJoint_')) {
                    params.jointType = actionId.replace('createJoint_', '');
                } else if (actionId.startsWith('createMotion_')) {
                    params.motionType = actionId.replace('createMotion_', '');
                }

                // Post message to VSCode extension
                const vscode = acquireVsCodeApi();
                vscode.postMessage({
                    command: 'ribbonAction',
                    action: actionId,
                    params: params
                });
            }
        })();
    </script>
    <script nonce="${nonce}" type="module" src="${webviewUri}"></script>
</body>
</html>`;

    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
