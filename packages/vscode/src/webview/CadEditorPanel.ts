import * as vscode from 'vscode';

export class CadEditorPanel {
    public static currentPanel: CadEditorPanel | undefined;
    public static readonly viewType = 'cadtoolOnline.cadEditor';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

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
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        CadEditorPanel.currentPanel = undefined;

        this._panel.dispose();

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

    private _getHtmlForWebview(_webview: vscode.Webview, _extensionUri: vscode.Uri): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        }
        .panel-content {
            padding: 8px;
            font-size: 13px;
        }
        .viewport {
            flex: 1;
            position: relative;
        }
        #canvas-container {
            width: 100%;
            height: 100%;
        }
        .toolbar {
            position: absolute;
            top: 10px;
            left: 10px;
            display: flex;
            gap: 4px;
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
        .status-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 22px;
            background-color: #007acc;
            color: white;
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <div class="panel">
                <div class="panel-header">Model Tree</div>
                <div class="panel-content">
                    <div>No model loaded</div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">Properties</div>
                <div class="panel-content">
                    <div>Select an object to view properties</div>
                </div>
            </div>
        </div>
        <div class="viewport">
            <div class="toolbar">
                <button id="btn-import">Import STEP</button>
                <button id="btn-fit">Fit View</button>
            </div>
            <div id="canvas-container"></div>
            <div class="status-bar">
                <span>Ready</span>
            </div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('btn-import').addEventListener('click', () => {
            vscode.postMessage({ command: 'alert', text: 'Import STEP - Coming soon!' });
        });

        document.getElementById('btn-fit').addEventListener('click', () => {
            vscode.postMessage({ command: 'alert', text: 'Fit View - Coming soon!' });
        });
    </script>
</body>
</html>`;
    }
}
