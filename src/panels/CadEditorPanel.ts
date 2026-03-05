import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; connect-src ${webview.cspSource};">
    <title>CAD Editor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background-color: #1e1e1e;
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            display: flex;
            width: 100%;
            height: 100%;
        }
        .sidebar {
            width: 250px;
            background-color: #252526;
            border-right: 1px solid #3c3c3c;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }
        .panel {
            border-bottom: 1px solid #3c3c3c;
        }
        .panel-header {
            padding: 8px 12px;
            background-color: #2d2d2d;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
        }
        .panel-header:hover {
            background-color: #383838;
        }
        .panel-content {
            padding: 8px;
            font-size: 13px;
        }
        .viewport {
            flex: 1;
            position: relative;
            display: flex;
            flex-direction: column;
        }
        #canvas-container {
            flex: 1;
            width: 100%;
            position: relative;
            background: linear-gradient(to bottom, #96a0aa 0%, #dce1e6 100%);
        }
        /* Ribbon Bar Styles */
        .ribbon-bar {
            display: flex;
            background: linear-gradient(to bottom, #3c3c3c 0%, #2d2d2d 100%);
            border-bottom: 1px solid #1e1e1e;
            padding: 0;
            min-height: 70px;
        }
        .ribbon-tab-group {
            display: flex;
            flex-direction: column;
            border-right: 1px solid #4a4a4a;
            padding: 4px 8px;
            min-width: 80px;
        }
        .ribbon-tab-group:last-child {
            border-right: none;
        }
        .ribbon-tab-content {
            display: flex;
            gap: 4px;
            flex: 1;
            align-items: flex-start;
            padding-top: 4px;
        }
        .ribbon-tab-label {
            font-size: 10px;
            color: #888;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 2px 0;
            border-top: 1px solid #4a4a4a;
            margin-top: auto;
        }
        .ribbon-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 3px;
            color: #cccccc;
            cursor: pointer;
            font-family: inherit;
            min-width: 50px;
            gap: 2px;
        }
        .ribbon-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }
        .ribbon-btn:active {
            background: rgba(0, 122, 204, 0.3);
        }
        .ribbon-btn.has-dropdown {
            position: relative;
        }
        .ribbon-btn-icon {
            font-size: 20px;
            line-height: 1;
        }
        .ribbon-btn-text {
            font-size: 11px;
            white-space: nowrap;
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
            background-color: #252526;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
            font-size: 13px;
            color: #cccccc;
        }
        .ribbon-dropdown-item:hover {
            background-color: #094771;
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
            background: #4a4a4a;
            margin: 4px 6px;
            align-self: stretch;
        }
        .status-bar {
            height: 22px;
            background-color: #007acc;
            color: white;
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
            background-color: #2a2d2e;
        }
        .tree-node.selected {
            background-color: #094771;
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
            color: #888;
        }
        .tree-node .expand-btn:hover {
            color: #ccc;
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
            border-bottom: 1px solid #3c3c3c;
        }
        .property-label {
            width: 100px;
            color: #9cdcfe;
            font-size: 12px;
        }
        .property-value {
            flex: 1;
            font-size: 12px;
        }
        /* Loading overlay */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
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
            border: 3px solid #3c3c3c;
            border-top-color: #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-text {
            margin-top: 12px;
            color: #cccccc;
        }
        .progress-container {
            width: 200px;
            margin-top: 12px;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background-color: #3c3c3c;
            border-radius: 3px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background-color: #007acc;
            border-radius: 3px;
            transition: width 0.2s ease;
            width: 0%;
        }
        .progress-text {
            margin-top: 6px;
            font-size: 12px;
            color: #808080;
        }
        /* Explode slider */
        .explode-slider-container {
            position: absolute;
            top: 90px;
            right: 20px;
            background-color: rgba(37, 37, 38, 0.95);
            border: 1px solid #3c3c3c;
            border-radius: 6px;
            padding: 15px 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
            color: #cccccc;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .explode-slider-close {
            cursor: pointer;
            font-size: 18px;
            color: #888;
            line-height: 1;
            padding: 0 4px;
        }
        .explode-slider-close:hover {
            color: #ccc;
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
            background: #3c3c3c;
            outline: none;
            border-radius: 3px;
        }
        .explode-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: #007acc;
            cursor: pointer;
            border-radius: 50%;
        }
        .explode-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: #007acc;
            cursor: pointer;
            border-radius: 50%;
            border: none;
        }
        .explode-slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #888;
        }
        .explode-slider-value {
            text-align: center;
            font-size: 13px;
            color: #cccccc;
            font-weight: 600;
        }
        /* Render config panel */
        .render-config-panel {
            position: absolute;
            top: 90px;
            right: 320px;
            background-color: rgba(37, 37, 38, 0.96);
            border: 1px solid #3c3c3c;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
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
            color: #cccccc;
        }
        .render-config-close {
            cursor: pointer;
            font-size: 18px;
            color: #888;
            line-height: 1;
            padding: 0 4px;
        }
        .render-config-close:hover {
            color: #ccc;
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
            color: #b8b8b8;
            flex: 1;
        }
        .render-config-row select {
            min-width: 140px;
            background: #2d2d2d;
            color: #cccccc;
            border: 1px solid #4a4a4a;
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
        <div class="sidebar">
            <div class="panel">
                <div class="panel-header">Model Tree</div>
                <div class="panel-content" id="model-tree">
                    <div style="color: #808080; font-style: italic;">No model loaded</div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">Properties</div>
                <div class="panel-content" id="properties-panel">
                    <div style="color: #808080; font-style: italic;">Select an object to view properties</div>
                </div>
            </div>
        </div>
        <div class="viewport">
            <!-- Ribbon Bar -->
            <div class="ribbon-bar">
                <!-- 閺傚洣娆?-->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" id="btn-import">
                            <span class="ribbon-btn-icon">IMP</span>
                            <span class="ribbon-btn-text">鐎电厧鍙?/span>
                        </button>
                        <button class="ribbon-btn" id="btn-export">
                            <span class="ribbon-btn-icon">EXP</span>
                            <span class="ribbon-btn-text">鐎电厧鍤?/span>
                        </button>
                        <button class="ribbon-btn" id="btn-fit">
                            <span class="ribbon-btn-icon">FIT</span>
                            <span class="ribbon-btn-text">闁倸绨?/span>
                        </button>
                        <button class="ribbon-btn" id="btn-clear">
                            <span class="ribbon-btn-icon">CLR</span>
                            <span class="ribbon-btn-text">濞撳懐鈹?/span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">閺傚洣娆?/div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 婢舵矮缍嬬拋鎹愵吀閿涙艾鍨庣紒鍕啎鐠?-->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createGroup">
                            <span class="ribbon-btn-icon">+</span>
                            <span class="ribbon-btn-text">閺傛澘缂?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createChildGroup">
                            <span class="ribbon-btn-icon">+</span>
                            <span class="ribbon-btn-text">鐎涙劕鍨庣紒?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="groupProperties">
                            <span class="ribbon-btn-icon">i</span>
                            <span class="ribbon-btn-text">鐏炵偞鈧?/span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">閸掑棛绮嶇拋鎹愵吀</div>
                </div>

                <!-- 婢舵矮缍嬬拋鎹愵吀閿涙碍鐖ｉ弸鎯邦啎鐠?-->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createFrame">
                            <span class="ribbon-btn-icon">+</span>
                            <span class="ribbon-btn-text">閺傛澘缂?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="editFrame">
                            <span class="ribbon-btn-icon">E</span>
                            <span class="ribbon-btn-text">缂傛牞绶?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="deleteFrame">
                            <span class="ribbon-btn-icon">-</span>
                            <span class="ribbon-btn-text">閸掔娀娅?/span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">閺嶅洦鐏︾拋鎹愵吀</div>
                </div>

                <!-- 婢舵矮缍嬬拋鎹愵吀閿涙俺绻涢幒銉啎鐠?-->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createJoint_revolute">
                            <span class="ribbon-btn-icon">R</span>
                            <span class="ribbon-btn-text">鏉烆剙濮?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_prismatic">
                            <span class="ribbon-btn-icon">P</span>
                            <span class="ribbon-btn-text">缁夎濮?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_cylindrical">
                            <span class="ribbon-btn-icon">C</span>
                            <span class="ribbon-btn-text">閸﹀棙鐓?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_spherical">
                            <span class="ribbon-btn-icon">S</span>
                            <span class="ribbon-btn-text">閻炲啫鑸?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_universal">
                            <span class="ribbon-btn-icon">U</span>
                            <span class="ribbon-btn-text">娑撳洤鎮?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_planar">
                            <span class="ribbon-btn-icon">L</span>
                            <span class="ribbon-btn-text">楠炴娊娼?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_fixed">
                            <span class="ribbon-btn-icon">F</span>
                            <span class="ribbon-btn-text">閸ュ搫鐣?/span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">鏉╃偞甯寸拋鎹愵吀</div>
                </div>

                <!-- 婢舵矮缍嬬拋鎹愵吀閿涙岸鈹嶉崝銊啎鐠?-->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createMotion_rotational">
                            <span class="ribbon-btn-icon">R</span>
                            <span class="ribbon-btn-text">閺冨娴?/span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createMotion_translational">
                            <span class="ribbon-btn-icon">T</span>
                            <span class="ribbon-btn-text">楠炲磭些</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="motionProperties">
                            <span class="ribbon-btn-icon">i</span>
                            <span class="ribbon-btn-text">鐏炵偞鈧?/span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">妞瑰崬濮╃拋鎹愵吀</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 濞翠椒缍嬬拋鎹愵吀 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="fluidTankSlice">
                            <span class="ribbon-btn-icon">F1</span>
                            <span class="ribbon-btn-text">濞屽湱顔堥崚鍥╁</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="fluidPort">
                            <span class="ribbon-btn-icon">F2</span>
                            <span class="ribbon-btn-text">濞翠椒缍嬬粩顖氬經</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">濞翠椒缍嬬拋鎹愵吀</div>
                </div>
                <div class="ribbon-separator"></div>

                <!-- 鐠佹崘顓稿銉ュ徔 -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="measureTool">
                            <span class="ribbon-btn-icon">M</span>
                            <span class="ribbon-btn-text">濞村鍣?/span>
                        </button>
                        <button class="ribbon-btn" id="btn-explode">
                            <span class="ribbon-btn-icon">X</span>
                            <span class="ribbon-btn-text">閻栧棛鍋㈢憴鍡楁禈</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="surfaceThicken">
                            <span class="ribbon-btn-icon">S+</span>
                            <span class="ribbon-btn-text">閺囨煡娼伴崝鐘插袱</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="planarRingProcess">
                            <span class="ribbon-btn-icon">P</span>
                            <span class="ribbon-btn-text">楠炴娊娼伴悳顖氼槱閻?/span>
                        </button>
                        <button class="ribbon-btn" id="btn-render-config">
                            <span class="ribbon-btn-icon">CFG</span>
                            <span class="ribbon-btn-text">濞撳弶鐓嬮柊宥囩枂</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">鐠佹崘顓稿銉ュ徔</div>
                </div>
            </div>
            <div id="canvas-container">
                <!-- Explode slider control -->
                <div class="explode-slider-container" id="explode-slider-container">
                    <div class="explode-slider-header">
                        <span>閻栧棛鍋㈢憴鍡楁禈鐠烘繄顬?/span>
                        <span class="explode-slider-close" id="explode-slider-close">鑴?/span>
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
                        <span>濞撳弶鐓嬮柊宥囩枂</span>
                        <span class="render-config-close" id="render-config-close">鑴?/span>
                    </div>
                    <div class="render-config-row">
                        <label for="render-visual-preset">鐟欏棜顫庢０鍕啎</label>
                        <select id="render-visual-preset">
                            <option value="cad" selected>CAD</option>
                            <option value="cinematic">閻㈤潧濂栭幇?/option>
                        </select>
                    </div>
                    <div class="render-config-row">
                        <label for="render-material-mode">閺夋劘宸濆Ο鈥崇础</label>
                        <select id="render-material-mode">
                            <option value="matcap">Matcap</option>
                            <option value="pbr">PBR</option>
                            <option value="flat">Flat</option>
                            <option value="phong">Phong</option>
                        </select>
                    </div>
                    <div class="render-config-row">
                        <label for="render-postprocessing">閸氬骸顦╅悶?/label>
                        <input id="render-postprocessing" type="checkbox" checked>
                    </div>
                    <div class="render-config-row">
                        <label for="render-edge-layer">鏉堝湱鍤庣仦?/label>
                        <input id="render-edge-layer" type="checkbox" checked>
                    </div>
                    <div class="render-config-row">
                        <label for="render-precision">缂冩垶鐗哥划鎯у</label>
                        <select id="render-precision">
                            <option value="coarse">缁鏆?/option>
                            <option value="balanced" selected>楠炲疇銆€</option>
                            <option value="fine">缁墽绮?/option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="loading-overlay hidden" id="loading-overlay">
                <div style="text-align: center;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text" id="loading-text">Loading...</div>
                    <div class="progress-container" id="progress-container" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill"></div>
                        </div>
                        <div class="progress-text" id="progress-text">0%</div>
                    </div>
                </div>
            </div>
            <div class="status-bar">
                <span class="status-text" id="status-text">Initializing...</span>
                <span class="status-info" id="status-info"></span>
            </div>
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
