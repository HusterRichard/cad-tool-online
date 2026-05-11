import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateCssVariables } from '@cadtool-online/ui';
import {
    createCadtoolErrorNotification,
    formatCadtoolNotificationMessage,
    isCadtoolErrorCode,
    sanitizeGroupName,
    type CadtoolNotificationLevel,
    type CadtoolRuntimeNotification
} from '@cadtool-online/core';

const STEP_IMPORT_DIRECTORY_SETTING = 'stepImport.defaultDirectory';
const DEFAULT_STEP_IMPORT_SUBDIRECTORY = path.join('syslab-server', 'sysplorer', 'model');

interface ModelicaPackageExportAsset {
    relativePath: string;
    encoding: 'base64' | 'utf8';
    content: string;
}

interface ModelicaPackageExportPayload {
    suggestedPackageName: string;
    mbJson: Record<string, unknown>;
    assets: ModelicaPackageExportAsset[];
}

function isModelicaPackageExportAsset(value: unknown): value is ModelicaPackageExportAsset {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ModelicaPackageExportAsset>;
    return typeof candidate.relativePath === 'string'
        && (candidate.encoding === 'base64' || candidate.encoding === 'utf8')
        && typeof candidate.content === 'string';
}

function isModelicaPackageExportPayload(value: unknown): value is ModelicaPackageExportPayload {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ModelicaPackageExportPayload>;
    return typeof candidate.suggestedPackageName === 'string'
        && Boolean(candidate.mbJson && typeof candidate.mbJson === 'object' && !Array.isArray(candidate.mbJson))
        && Array.isArray(candidate.assets)
        && candidate.assets.every(isModelicaPackageExportAsset);
}

function resolvePackageExportPath(packageDir: string, relativePath: string): string {
    const normalized = path.normalize(relativePath).replace(/^([/\\])+/, '');
    const baseDir = path.resolve(packageDir);
    const targetPath = path.resolve(baseDir, normalized);
    if (targetPath !== baseDir && !targetPath.startsWith(`${baseDir}${path.sep}`)) {
        throw new Error(`Invalid export path: ${relativePath}`);
    }
    return targetPath;
}

export class CadEditorPanel {
    public static currentPanel: CadEditorPanel | undefined;
    public static readonly viewType = 'cadtoolOnline.cadEditor';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // Model state
    private _loadedShapes: Map<string, { name: string; meshData?: unknown }> = new Map();

    public static async createOrShow(
        extensionUri: vscode.Uri,
        options?: { openInNewWindow?: boolean }
    ): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        const openInNewWindow = options?.openInNewWindow ?? false;

        if (CadEditorPanel.currentPanel) {
            CadEditorPanel.currentPanel._panel.reveal(column);
            await CadEditorPanel._closeSidebar();
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

        await CadEditorPanel._closeSidebar();

        if (openInNewWindow) {
            await CadEditorPanel._tryMoveActiveEditorToNewWindow();
        }
    }

    private static async _closeSidebar(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
        } catch {
            // If the command is unavailable, keep the current workbench layout.
        }
    }

    private static async _tryMoveActiveEditorToNewWindow(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
        } catch {
            // Fallback: if command is unavailable on current VSCode version,
            // keep using the docked webview panel.
        }
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
                        this._showNotification({
                            level: 'info',
                            text: typeof message.text === 'string' ? message.text : String(message.text ?? '')
                        });
                        return;
                    case 'notify':
                        this._showNotification(message);
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
                    case 'exportModelicaPackage':
                        await this._handleExportModelicaPackage(message.data);
                        return;
                    case 'requestCadtoolConfigImport':
                        await this._handleImportCadtoolConfig();
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
            },
            defaultUri: vscode.Uri.file(this._resolveStepImportDefaultDirectory())
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
            this._showNotification(createCadtoolErrorNotification('ERR_OPEN_CAD_FILE_FAILED', {
                detail: error instanceof Error ? error.message : String(error),
                text: 'Failed to load STEP file.'
            }));
            this._setStatus('Ready');
        }
    }

    private _resolveStepImportDefaultDirectory(): string {
        const homeDir = os.homedir();
        const configuredDirectory = vscode.workspace
            .getConfiguration('cadtool-online')
            .get<string>(STEP_IMPORT_DIRECTORY_SETTING, DEFAULT_STEP_IMPORT_SUBDIRECTORY)
            ?.trim();

        if (!configuredDirectory) {
            return homeDir;
        }

        let candidateDirectory: string;
        if (configuredDirectory === '~') {
            candidateDirectory = homeDir;
        } else if (configuredDirectory.startsWith('~/') || configuredDirectory.startsWith('~\\')) {
            candidateDirectory = path.join(homeDir, configuredDirectory.slice(2));
        } else if (path.isAbsolute(configuredDirectory)) {
            candidateDirectory = configuredDirectory;
        } else {
            candidateDirectory = path.join(homeDir, configuredDirectory);
        }

        return fs.existsSync(candidateDirectory) ? candidateDirectory : homeDir;
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
            this._showNotification(createCadtoolErrorNotification('ERR_GENERATE_FILE_FAILED', {
                detail: error instanceof Error ? error.message : String(error),
                text: 'Failed to export model.'
            }));
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
                this._showNotification(createCadtoolErrorNotification('PARSE_FILE_FAILED', {
                    detail: 'CADTool config must be a JSON object.',
                    text: 'Failed to import CADTool config.'
                }));
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
            this._showNotification(createCadtoolErrorNotification('PARSE_FILE_FAILED', {
                detail,
                text: 'Failed to import CADTool config.'
            }));
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
            this._showNotification(createCadtoolErrorNotification('ERR_GENERATE_FILE_FAILED', {
                detail: error instanceof Error ? error.message : String(error),
                text: 'Failed to export CADTool config.'
            }));
            this._setStatus('Ready');
        }
    }

    private async _handleExportModelicaPackage(data: unknown): Promise<void> {
        if (!isModelicaPackageExportPayload(data)) {
            this._showNotification(createCadtoolErrorNotification('PARSE_FILE_FAILED', {
                detail: 'Invalid SC36 export payload.',
                text: 'Failed to export Modelica package.'
            }));
            this._setStatus('Ready');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            this._showNotification(createCadtoolErrorNotification('ERR_GENERATE_FILE_FAILED', {
                detail: 'No workspace folder is open.',
                text: 'Failed to export Modelica package.'
            }));
            this._setStatus('Ready');
            return;
        }

        const defaultPackageName = sanitizeGroupName(
            data.suggestedPackageName,
            'CadMbsModel'
        );
        const packageNameInput = await vscode.window.showInputBox({
            title: '导出多体模型包',
            prompt: '输入模型包名（将按 Modelica 命名规则保存）',
            value: defaultPackageName,
            validateInput: value => {
                const normalized = sanitizeGroupName(value, '');
                return normalized.length > 0 ? null : '请输入有效的模型包名。';
            }
        });

        if (packageNameInput === undefined) {
            this._setStatus('Ready');
            return;
        }

        const packageName = sanitizeGroupName(packageNameInput, defaultPackageName);
        const packageDir = path.join(workspaceRoot, packageName);
        const visualizersDir = path.join(packageDir, 'Visualizers');

        try {
            fs.mkdirSync(visualizersDir, { recursive: true });

            for (const asset of data.assets) {
                const targetPath = resolvePackageExportPath(packageDir, asset.relativePath);
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                if (asset.encoding === 'base64') {
                    fs.writeFileSync(targetPath, Buffer.from(asset.content, 'base64'));
                } else {
                    fs.writeFileSync(targetPath, asset.content, 'utf-8');
                }
            }

            const mbJson = {
                ...data.mbJson,
                packageName
            };
            fs.writeFileSync(
                path.join(packageDir, 'mb.json'),
                JSON.stringify(mbJson, null, 2),
                'utf-8'
            );

            vscode.window.showInformationMessage(
                `Modelica package exported successfully to ${packageName}`
            );
            this._setStatus('Ready');
            this._panel.dispose();
        } catch (error) {
            this._showNotification(createCadtoolErrorNotification('ERR_GENERATE_FILE_FAILED', {
                detail: error instanceof Error ? error.message : String(error),
                text: 'Failed to export Modelica package.'
            }));
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

    private _showNotification(message: Partial<CadtoolRuntimeNotification>): void {
        const level: CadtoolNotificationLevel = message.level === 'warning' || message.level === 'error'
            ? message.level
            : 'info';
        const code = typeof message.code === 'string' && isCadtoolErrorCode(message.code)
            ? message.code
            : undefined;
        const notification: CadtoolRuntimeNotification = {
            level,
            code,
            text: typeof message.text === 'string' ? message.text : String(message.text ?? ''),
            title: typeof message.title === 'string' ? message.title : undefined,
            detail: typeof message.detail === 'string' ? message.detail : undefined,
            recoveryHint: typeof message.recoveryHint === 'string' ? message.recoveryHint : undefined,
            docPath: typeof message.docPath === 'string' ? message.docPath : undefined
        };
        const uiMessage = formatCadtoolNotificationMessage(notification, {
            includeDetail: level !== 'info',
            includeRecoveryHint: level === 'error'
        });

        switch (level) {
            case 'error':
                vscode.window.showErrorMessage(uiMessage);
                return;
            case 'warning':
                vscode.window.showWarningMessage(uiMessage);
                return;
            default:
                vscode.window.showInformationMessage(uiMessage);
        }
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
            case 'renameGroup':
                vscode.window.showInformationMessage('Rename selected group');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'renameGroup'
                });
                break;
            case 'moveToGroup':
                vscode.window.showInformationMessage('Move selected group items');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'moveToGroup'
                });
                break;
            case 'ungroupGroup':
                vscode.window.showInformationMessage('Ungroup selected group');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'ungroupGroup'
                });
                break;
            case 'deleteSelection':
                vscode.window.showInformationMessage('Delete selected group items');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'deleteSelection'
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
            case 'createRefFrame':
                vscode.window.showInformationMessage('Create reference frame');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createRefFrame'
                });
                break;
            case 'createDesignPoint':
                vscode.window.showInformationMessage('Create design point');
                this._panel.webview.postMessage({
                    command: 'mbsAction',
                    action: 'createDesignPoint'
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
            case 'createJoint_screw':
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

            case 'createContact_pointPoint':
            case 'createContact_pointSurface':
            case 'measureTool':
            case 'surfaceThicken':
            case 'planarRingProcess':
            case 'cleanGroup':
            case 'createDefaultGroup': {
                const actionMessages: Record<string, string> = {
                    createContact_pointPoint: 'Creating point-point contact',
                    createContact_pointSurface: 'Creating point-surface contact',
                    measureTool: 'Running measurement tool',
                    surfaceThicken: 'Running surface thicken',
                    planarRingProcess: 'Running planar ring process',
                    cleanGroup: 'Cleaning groups',
                    createDefaultGroup: 'Creating default group'
                };

                vscode.window.showInformationMessage(actionMessages[action] ?? `Executing action: ${action}`);
                const message: Record<string, unknown> = {
                    command: 'mbsAction',
                    action: action.startsWith('createContact_') ? 'createContact' : action
                };
                if (action === 'createContact_pointPoint' || action === 'createContact_pointSurface') {
                    message.contactType = action === 'createContact_pointSurface' ? 'pointSurface' : 'pointPoint';
                }
                this._panel.webview.postMessage(message);
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
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'icons', 'svg', '32')
        );
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en" data-icons32-base="${icons32}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src ${webview.cspSource} blob:; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; connect-src ${webview.cspSource};">
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
            position: relative;
        }
        .main-body.resizing {
            cursor: col-resize;
            user-select: none;
        }
        .sidebar {
            width: 265px;
            background-color: var(--color-bg-surface);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .sidebar-right {
            width: 280px;
            background-color: var(--color-bg-surface);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .sidebar-resizer {
            width: 6px;
            flex: 0 0 6px;
            cursor: col-resize;
            position: relative;
            background: transparent;
        }
        .sidebar-resizer::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            left: 2px;
            width: 1px;
            background: var(--color-border);
            opacity: 0.95;
        }
        .sidebar-resizer:hover::before,
        .sidebar-resizer.dragging::before {
            width: 2px;
            left: 2px;
            background: #2563EB;
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
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .panel-header:hover {
            background-color: var(--color-bg-hover);
        }
        .panel-content {
            padding: var(--spacing-md);
            font-size: var(--font-size-lg);
        }
        /* Options Panel Styles */
        .panel-close-btn {
            color: #9CA3AF;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .panel-close-btn:hover {
            color: #1F2937;
            background-color: #E5E7EB;
        }
        .opt-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
        }
        .opt-name-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .opt-name-row label {
            font-size: 12px;
            color: #1F2937;
            white-space: nowrap;
            min-width: 36px;
        }
        .opt-input {
            width: 100%;
            background: #FFFFFF;
            border: 1px solid #D1D5DB;
            border-radius: 3px;
            height: 22px;
            padding: 0 6px;
            font-size: 12px;
            color: #1F2937;
            outline: none;
            box-sizing: border-box;
        }
        .opt-input:focus {
            border-color: #2563EB;
        }
        .opt-separator {
            height: 1px;
            background-color: #E5E7EB;
            margin: 4px 0;
        }
        .opt-vec3-row {
            display: flex;
            gap: 4px;
            align-items: center;
        }
        .opt-vec3-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        }
        .opt-vec3-label {
            font-size: 10px;
            color: #9CA3AF;
            text-align: center;
        }
        .opt-vec3-input {
            width: 100%;
            background: #FFFFFF;
            border: 1px solid #D1D5DB;
            border-radius: 3px;
            height: 22px;
            padding: 0 4px;
            font-size: 11px;
            color: #1F2937;
            text-align: center;
            outline: none;
            box-sizing: border-box;
        }
        .opt-vec3-input:focus {
            border-color: #2563EB;
        }
        .opt-dropdown {
            width: 100%;
            background: #FFFFFF;
            border: 1px solid #D1D5DB;
            border-radius: 3px;
            height: 24px;
            padding: 0 4px;
            font-size: 12px;
            color: #1F2937;
            outline: none;
            box-sizing: border-box;
        }
        .opt-dropdown:focus {
            border-color: #2563EB;
        }
        .opt-part-selector {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: #EFF6FF;
            border: 1px dashed #2563EB;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            color: #2563EB;
            min-height: 28px;
        }
        .opt-part-selector:hover {
            background: #DBEAFE;
        }
        .opt-part-selector.has-value {
            background: #FFFFFF;
            border-style: solid;
            color: #1F2937;
        }
        .opt-btn-primary {
            background: #2563EB;
            color: #FFFFFF;
            border: none;
            border-radius: 4px;
            padding: 6px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
        }
        .opt-btn-primary:hover {
            background: #1D4ED8;
        }
        .opt-btn-secondary {
            background: #F3F4F6;
            color: #374151;
            border: 1px solid #D1D5DB;
            border-radius: 4px;
            padding: 6px 16px;
            font-size: 12px;
            cursor: pointer;
        }
        .opt-btn-secondary:hover {
            background: #E5E7EB;
        }
        .opt-mode-btn {
            padding: 4px 10px;
            font-size: 11px;
            border: 1px solid #D1D5DB;
            border-radius: 3px;
            background: #FFFFFF;
            color: #6B7280;
            cursor: pointer;
        }
        .opt-mode-btn:hover {
            background: #F3F4F6;
        }
        .opt-mode-btn-active {
            padding: 4px 10px;
            font-size: 11px;
            border: 1px solid #2563EB;
            border-radius: 3px;
            background: #DBEAFE;
            color: #2563EB;
            cursor: pointer;
            font-weight: 500;
        }
        .opt-section-header {
            background: #F3F4F6;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 600;
            color: #374151;
            border-radius: 3px;
        }
        .opt-tab-active {
            padding: 4px 12px;
            font-size: 12px;
            border: none;
            border-bottom: 2px solid #2563EB;
            background: transparent;
            color: #2563EB;
            cursor: pointer;
            font-weight: 500;
        }
        .opt-tab {
            padding: 4px 12px;
            font-size: 12px;
            border: none;
            border-bottom: 2px solid transparent;
            background: transparent;
            color: #9CA3AF;
            cursor: pointer;
        }
        .opt-tab:hover {
            color: #6B7280;
        }
        .opt-selected-list {
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 3px;
            max-height: 120px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 4px;
        }
        .opt-selected-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            font-size: 12px;
            color: #1F2937;
        }
        .opt-selected-item .checkmark {
            color: #2563EB;
            font-size: 12px;
        }
        .opt-hint {
            font-size: 11px;
            color: #6B7280;
            font-style: italic;
        }
        .opt-label {
            font-size: 12px;
            color: #6B7280;
            margin-bottom: 2px;
        }
        .opt-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .opt-row label {
            font-size: 12px;
            color: #6B7280;
            white-space: nowrap;
            min-width: 60px;
        }
        .opt-btn-row {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 4px;
        }
        .opt-tab-bar {
            display: flex;
            gap: 0;
            border-bottom: 1px solid #E5E7EB;
        }
        .opt-mode-row {
            display: flex;
            gap: 6px;
            align-items: center;
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
            overflow: hidden;
        }
        .ribbon-tab-group {
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            min-width: 50px;
            gap: 2px;
            flex: 0 0 auto;
        }
        .ribbon-tab-content {
            display: flex;
            gap: 4px;
            flex: 1;
            align-items: flex-start;
            padding-top: 4px;
            position: relative;
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
            flex: 0 0 auto;
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
        .ribbon-dropdown-item-icon img {
            width: 16px;
            height: 16px;
            object-fit: contain;
            vertical-align: middle;
        }
        .ribbon-dropdown-item-label {
            flex: 1;
        }
        .ribbon-separator {
            width: 1px;
            background: var(--color-border-hover);
            margin: 4px 0;
            align-self: stretch;
            flex: 0 0 1px;
        }
        .ribbon-group-hidden {
            display: none !important;
        }
        .ribbon-separator-hidden {
            display: none !important;
        }
        .ribbon-more-group {
            display: none;
        }
        .ribbon-more-icon {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 1px;
            line-height: 1;
        }
        .ribbon-bar.compact {
            height: 84px;
            padding: 3px 6px;
            gap: 4px;
        }
        .ribbon-bar.compact .ribbon-tab-group {
            padding: 3px 4px;
        }
        .ribbon-bar.compact .ribbon-tab-content {
            gap: 3px;
            padding-top: 2px;
        }
        .ribbon-bar.compact .ribbon-btn {
            min-width: 40px;
            padding: 2px 3px;
        }
        .ribbon-bar.compact .ribbon-btn-icon,
        .ribbon-bar.compact .ribbon-btn-icon img {
            width: 28px;
            height: 28px;
        }
        .ribbon-bar.compact .ribbon-btn-text {
            font-size: 10px;
        }
        .ribbon-bar.icon-only {
            height: 54px;
            padding: 2px 4px;
            gap: 3px;
        }
        .ribbon-bar.icon-only .ribbon-tab-group {
            padding: 2px 3px;
            min-width: auto;
        }
        .ribbon-bar.icon-only .ribbon-tab-content {
            gap: 2px;
            padding-top: 0;
            align-items: center;
        }
        .ribbon-bar.icon-only .ribbon-btn {
            min-width: 34px;
            padding: 2px;
            gap: 0;
        }
        .ribbon-bar.icon-only .ribbon-btn-icon,
        .ribbon-bar.icon-only .ribbon-btn-icon img {
            width: 24px;
            height: 24px;
        }
        .ribbon-bar.icon-only .ribbon-btn-text,
        .ribbon-bar.icon-only .ribbon-tab-label {
            display: none;
        }
        .ribbon-bar.icon-only .ribbon-more-btn .ribbon-btn-arrow {
            display: none;
        }
        .ribbon-bar.icon-only .ribbon-separator {
            margin: 2px 0;
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
            margin: 0;
        }
        .tree-node {
            padding: 0 4px;
            min-height: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 1px;
            line-height: 18px;
        }
        .tree-node:hover {
            background-color: var(--color-bg-hover);
        }
        .tree-node.selected {
            background-color: var(--color-bg-active);
        }
        .tree-node.dragging {
            opacity: 0.55;
        }
        .tree-node.drop-target-valid {
            background-color: rgba(34, 197, 94, 0.16);
            outline: 1px solid rgba(34, 197, 94, 0.75);
        }
        .tree-node.drop-target-invalid {
            background-color: rgba(239, 68, 68, 0.14);
            outline: 1px solid rgba(239, 68, 68, 0.75);
        }
        .tree-node .expand-btn {
            width: 13px;
            height: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            border-radius: 3px;
            background-color: transparent;
            flex: 0 0 13px;
        }
        .tree-node .expand-btn img {
            width: 11px;
            height: 11px;
            display: block;
            object-fit: contain;
            opacity: 0.88;
        }
        .tree-node .expand-btn:hover {
            background-color: rgba(148, 163, 184, 0.14);
        }
        .tree-node .expand-btn:hover img {
            opacity: 1;
        }
        .tree-node .expand-spacer {
            width: 13px;
            height: 13px;
            display: inline-block;
            flex: 0 0 13px;
        }
        .tree-node .visibility-btn {
            width: 13px;
            height: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            border-radius: 2px;
        }
        .tree-node .visibility-btn img {
            width: 13px;
            height: 13px;
            display: block;
            object-fit: contain;
            opacity: 0.9;
        }
        .tree-node .visibility-btn:hover {
            background-color: var(--color-bg-hover);
        }
        .tree-node .visibility-btn:hover img {
            opacity: 1;
        }
        .tree-node .visibility-spacer {
            width: 13px;
            height: 13px;
            display: inline-block;
            flex: 0 0 13px;
        }
        .tree-node .icon {
            width: 13px;
            height: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            margin-right: 2px;
        }
        .tree-node .icon img {
            width: 13px;
            height: 13px;
            display: block;
            object-fit: contain;
        }
        .tree-node.tree-node-category .icon {
            width: 11px;
            height: 11px;
        }
        .tree-node.tree-node-category .icon img {
            width: 11px;
            height: 11px;
        }
        .tree-node .name {
            flex: 1;
            font-size: 12px;
            line-height: 18px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tree-children {
            display: none;
            margin-left: 0;
            padding-left: 0;
            border-left: 1px solid rgba(148, 163, 184, 0.28);
        }
        .tree-children.expanded {
            display: block;
        }
        /* Properties styles */
        .property-section-header {
            height: 24px;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            background: #F3F4F6;
            color: #1F2937;
            font-size: 13px;
            font-weight: 600;
        }
        .property-row {
            display: flex;
            align-items: center;
            min-height: 26px;
            gap: 4px;
            padding: 2px 8px;
        }
        .property-label {
            width: 64px;
            flex: 0 0 64px;
            color: #6B7280;
            font-size: 12px;
        }
        .property-value {
            flex: 1;
            color: #111827;
            font-size: 12px;
            min-width: 0;
        }
        .property-value.boxed {
            height: 22px;
            display: flex;
            align-items: center;
            padding: 2px 6px;
            background: #FFFFFF;
            border-radius: 3px;
            border: 1px solid #E5E7EB;
        }
        .property-separator {
            height: 1px;
            background: #E5E7EB;
            margin: 2px 0;
        }
        .property-color-value {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .property-swatch-btn {
            width: 50px;
            height: 18px;
            border-radius: 3px;
            border: 1px solid #D1D5DB;
            flex: 0 0 50px;
            cursor: pointer;
        }
        .property-swatch-btn:hover {
            border-color: #9CA3AF;
        }
        .property-material-select {
            width: 100%;
            height: 22px;
            padding: 2px 6px;
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 3px;
            color: #111827;
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }
        .property-material-select:focus {
            border-color: #2563EB;
        }
        .property-check {
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
            border: 1px solid #D1D5DB;
            background: #FFFFFF;
            color: #FFFFFF;
            font-size: 11px;
            line-height: 1;
        }
        .property-check.checked {
            background: #2563EB;
            border-color: #2563EB;
        }
        .property-sub-header {
            padding: 2px 8px;
            color: #6B7280;
            font-size: 12px;
            font-weight: 600;
            min-height: 22px;
            display: flex;
            align-items: center;
        }
        .property-vector-row .property-label {
            color: transparent;
        }
        .property-com-values {
            display: flex;
            align-items: center;
            gap: 2px;
        }
        .property-com-box {
            flex: 1;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            border-radius: 2px;
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            color: #111827;
            font-size: 10px;
            padding: 1px 3px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .property-com-unit {
            color: #9CA3AF;
            font-size: 10px;
            margin-left: 4px;
            flex: 0 0 auto;
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
            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" id="btn-import">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_import.svg" alt="导入"></span>
                        <span class="ribbon-btn-text">导入</span>
                    </button>
                    <button class="ribbon-btn" id="btn-open">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_open_file.svg" alt="打开"></span>
                        <span class="ribbon-btn-text">打开</span>
                    </button>
                    <button class="ribbon-btn" id="btn-save">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_save_file.svg" alt="保存"></span>
                        <span class="ribbon-btn-text">保存</span>
                    </button>
                    <button class="ribbon-btn" id="btn-saveas">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_save_as.svg" alt="另存"></span>
                        <span class="ribbon-btn-text">另存</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">文件</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="createGroup">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_create_group.svg" alt="组合"></span>
                        <span class="ribbon-btn-text">组合</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="ungroupGroup">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_ungroup.svg" alt="分解"></span>
                        <span class="ribbon-btn-text">分解</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="cleanGroup">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_clear.svg" alt="清理"></span>
                        <span class="ribbon-btn-text">清理</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createDefaultGroup">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_create_default_group.svg" alt="默认分组"></span>
                        <span class="ribbon-btn-text">默认分组</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">分组</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="createFrame">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_place_marker.svg" alt="标架"></span>
                        <span class="ribbon-btn-text">标架</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createRefFrame">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_place_refmarker.svg" alt="参考标架"></span>
                        <span class="ribbon-btn-text">参考标架</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createDesignPoint">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_design_pnt.svg" alt="设计点"></span>
                        <span class="ribbon-btn-text">设计点</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">基本形状</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="createJoint_fixed">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_fixed.svg" alt="固定副"></span>
                        <span class="ribbon-btn-text">固定副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_revolute">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_revolute.svg" alt="转动副"></span>
                        <span class="ribbon-btn-text">转动副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_prismatic">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_prismatic.svg" alt="平移副"></span>
                        <span class="ribbon-btn-text">平移副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_cylindrical">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_cylindrical.svg" alt="圆柱副"></span>
                        <span class="ribbon-btn-text">圆柱副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_spherical">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_spherical.svg" alt="球副"></span>
                        <span class="ribbon-btn-text">球副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_universal">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_universal.svg" alt="万向节"></span>
                        <span class="ribbon-btn-text">万向节</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_screw">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_screw.svg" alt="螺旋副"></span>
                        <span class="ribbon-btn-text">螺旋副</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createJoint_planar">
                        <span class="ribbon-btn-icon"><img src="${icons32}/joint_cad_planar.svg" alt="平面副"></span>
                        <span class="ribbon-btn-text">平面副</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">连接</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="createMotion_rotational">
                        <span class="ribbon-btn-icon"><img src="${icons32}/motion_cad_rotational.svg" alt="转动驱动"></span>
                        <span class="ribbon-btn-text">转动驱动</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createMotion_translational">
                        <span class="ribbon-btn-icon"><img src="${icons32}/motion_cad_translational.svg" alt="平移驱动"></span>
                        <span class="ribbon-btn-text">平移驱动</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">驱动</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="createContact_pointPoint">
                        <span class="ribbon-btn-icon"><img src="${icons32}/force_cad_contact_point_point.svg" alt="点点接触"></span>
                        <span class="ribbon-btn-text">点点接触</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="createContact_pointSurface">
                        <span class="ribbon-btn-icon"><img src="${icons32}/force_cad_contact_point_surface.svg" alt="点面接触"></span>
                        <span class="ribbon-btn-text">点面接触</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">力</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" data-action-id="measureTool">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_measure.svg" alt="测量"></span>
                        <span class="ribbon-btn-text">测量</span>
                    </button>
                    <button class="ribbon-btn" id="btn-explode">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_exploded_view.svg" alt="爆炸视图"></span>
                        <span class="ribbon-btn-text">爆炸视图</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="surfaceThicken">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_surface_thickening.svg" alt="曲面加厚"></span>
                        <span class="ribbon-btn-text">曲面加厚</span>
                    </button>
                    <button class="ribbon-btn" data-action-id="planarRingProcess">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_planar_loop_constraint.svg" alt="平面环"></span>
                        <span class="ribbon-btn-text">平面环</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">工具</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" id="btn-export-check">
                        <span class="ribbon-btn-icon"><img src="${icons32}/check_cad_check.svg" alt="检查"></span>
                        <span class="ribbon-btn-text">检查</span>
                    </button>
                    <button class="ribbon-btn" id="btn-accept-exit">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_cancel.svg" alt="接受并退出"></span>
                        <span class="ribbon-btn-text">接受并退出</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">导出</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" id="btn-render-config">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_option.svg" alt="设置"></span>
                        <span class="ribbon-btn-text">设置</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">设置</div>
            </div>
            <div class="ribbon-separator"></div>

            <div class="ribbon-tab-group">
                <div class="ribbon-tab-content">
                    <button class="ribbon-btn" id="btn-about">
                        <span class="ribbon-btn-icon"><img src="${icons32}/cad_about.svg" alt="关于"></span>
                        <span class="ribbon-btn-text">关于</span>
                    </button>
                </div>
                <div class="ribbon-tab-label">关于</div>
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
            <div class="sidebar-resizer" id="left-sidebar-resizer" role="separator" aria-label="Resize model browser"></div>
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
            <div class="sidebar-resizer" id="right-sidebar-resizer" role="separator" aria-label="Resize properties panel"></div>
            <!-- Right Sidebar: Properties / Options -->
            <div class="sidebar-right">
                <div class="panel">
                    <div class="panel-header" id="panel-header">
                        <span id="panel-header-text">属性</span>
                        <span id="panel-header-close" class="panel-close-btn" style="display:none">✕</span>
                    </div>
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
        window.ICONS_32_BASE = "${icons32}";
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
