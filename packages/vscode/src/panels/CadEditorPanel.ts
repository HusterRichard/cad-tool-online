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

            // Read file content
            const fileContent = fs.readFileSync(filePath);
            const base64Content = fileContent.toString('base64');

            // Send to webview for processing
            this._panel.webview.postMessage({
                command: 'loadStepFile',
                fileName: fileName,
                fileContent: base64Content
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load STEP file: ${error}`);
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; connect-src ${webview.cspSource};">
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
        }
        .toolbar {
            position: absolute;
            top: 10px;
            left: 10px;
            display: flex;
            gap: 4px;
            z-index: 100;
        }
        .toolbar button {
            padding: 6px 12px;
            background-color: #0e639c;
            color: white;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar button:hover {
            background-color: #1177bb;
        }
        .toolbar button:disabled {
            background-color: #4a4a4a;
            cursor: not-allowed;
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
            <div class="toolbar">
                <button id="btn-import">Import STEP</button>
                <button id="btn-fit">Fit View</button>
                <button id="btn-clear">Clear</button>
            </div>
            <div id="canvas-container"></div>
            <div class="loading-overlay hidden" id="loading-overlay">
                <div style="text-align: center;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text" id="loading-text">Loading...</div>
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
