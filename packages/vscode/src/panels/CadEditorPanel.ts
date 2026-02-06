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

    private _handleRibbonAction(action: string, params?: Record<string, unknown>): void {
        // 处理 Ribbon 菜单动作
        switch (action) {
            // 分组设计
            case 'createGroup':
                vscode.window.showInformationMessage('创建新分组');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createGroup'
                });
                break;
            case 'createChildGroup':
                vscode.window.showInformationMessage('添加子分组');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createChildGroup'
                });
                break;
            case 'groupProperties':
                vscode.window.showInformationMessage('查看分组属性');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'groupProperties'
                });
                break;

            // 标架设计
            case 'createFrame':
                vscode.window.showInformationMessage('创建新标架');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createFrame'
                });
                break;
            case 'editFrame':
                vscode.window.showInformationMessage('编辑标架');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'editFrame'
                });
                break;
            case 'deleteFrame':
                vscode.window.showInformationMessage('删除标架');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'deleteFrame'
                });
                break;

            // 关节设计
            case 'createJoint_revolute':
            case 'createJoint_prismatic':
            case 'createJoint_cylindrical':
            case 'createJoint_spherical':
            case 'createJoint_universal':
            case 'createJoint_planar':
            case 'createJoint_fixed':
                const jointType = params?.jointType as string;
                vscode.window.showInformationMessage(`创建 ${jointType} 关节`);
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createJoint',
                    jointType: jointType
                });
                break;

            // 驱动设计
            case 'createMotion_rotational':
                vscode.window.showInformationMessage('创建旋转驱动');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createMotion',
                    motionType: 'rotational'
                });
                break;
            case 'createMotion_translational':
                vscode.window.showInformationMessage('创建平移驱动');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createMotion',
                    motionType: 'translational'
                });
                break;
            case 'motionProperties':
                vscode.window.showInformationMessage('查看驱动属性');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'motionProperties'
                });
                break;

            default:
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
                <!-- File Group -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" id="btn-import">
                            <span class="ribbon-btn-icon">📥</span>
                            <span class="ribbon-btn-text">导入</span>
                        </button>
                        <button class="ribbon-btn" id="btn-fit">
                            <span class="ribbon-btn-icon">🔍</span>
                            <span class="ribbon-btn-text">适应</span>
                        </button>
                        <button class="ribbon-btn" id="btn-clear">
                            <span class="ribbon-btn-icon">🗑️</span>
                            <span class="ribbon-btn-text">清空</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">文件</div>
                </div>
                <div class="ribbon-separator"></div>
                <!-- Group Design -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createGroup">
                            <span class="ribbon-btn-icon">➕</span>
                            <span class="ribbon-btn-text">新建</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createChildGroup">
                            <span class="ribbon-btn-icon">📂</span>
                            <span class="ribbon-btn-text">子分组</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="groupProperties">
                            <span class="ribbon-btn-icon">⚙️</span>
                            <span class="ribbon-btn-text">属性</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">分组设计</div>
                </div>
                <!-- Frame Design -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createFrame">
                            <span class="ribbon-btn-icon">➕</span>
                            <span class="ribbon-btn-text">新建</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="editFrame">
                            <span class="ribbon-btn-icon">✏️</span>
                            <span class="ribbon-btn-text">编辑</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="deleteFrame">
                            <span class="ribbon-btn-icon">🗑️</span>
                            <span class="ribbon-btn-text">删除</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">标架设计</div>
                </div>
                <!-- Joint Design -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createJoint_revolute">
                            <span class="ribbon-btn-icon">🔄</span>
                            <span class="ribbon-btn-text">旋转</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_prismatic">
                            <span class="ribbon-btn-icon">↔️</span>
                            <span class="ribbon-btn-text">移动</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_cylindrical">
                            <span class="ribbon-btn-icon">🔵</span>
                            <span class="ribbon-btn-text">圆柱</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_spherical">
                            <span class="ribbon-btn-icon">⚪</span>
                            <span class="ribbon-btn-text">球</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_universal">
                            <span class="ribbon-btn-icon">✚</span>
                            <span class="ribbon-btn-text">万向</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_planar">
                            <span class="ribbon-btn-icon">▭</span>
                            <span class="ribbon-btn-text">平面</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createJoint_fixed">
                            <span class="ribbon-btn-icon">🔒</span>
                            <span class="ribbon-btn-text">固定</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">关节设计</div>
                </div>
                <!-- Motion Design -->
                <div class="ribbon-tab-group">
                    <div class="ribbon-tab-content">
                        <button class="ribbon-btn" data-action-id="createMotion_rotational">
                            <span class="ribbon-btn-icon">🔄</span>
                            <span class="ribbon-btn-text">旋转</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="createMotion_translational">
                            <span class="ribbon-btn-icon">➡️</span>
                            <span class="ribbon-btn-text">平移</span>
                        </button>
                        <button class="ribbon-btn" data-action-id="motionProperties">
                            <span class="ribbon-btn-icon">⚙️</span>
                            <span class="ribbon-btn-text">属性</span>
                        </button>
                    </div>
                    <div class="ribbon-tab-label">驱动设计</div>
                </div>
            </div>
            <div id="canvas-container"></div>
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
