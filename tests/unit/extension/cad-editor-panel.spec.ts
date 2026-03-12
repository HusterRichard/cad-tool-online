import { beforeEach, describe, expect, it, vi } from 'vitest';

type MessageHandler = (message: { command: string; [key: string]: unknown }) => unknown;

const mocks = vi.hoisted(() => {
    let messageHandler: MessageHandler | null = null;
    let disposeHandler: (() => void) | null = null;

    const webview = {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((callback: MessageHandler, _thisArg?: unknown, disposables?: Array<{ dispose: () => void }>) => {
            messageHandler = callback;
            const disposable = { dispose: vi.fn() };
            disposables?.push(disposable);
            return disposable;
        }),
        asWebviewUri: vi.fn((uri: { fsPath?: string; path?: string; toString?: () => string }) => ({
            toString: () => uri.fsPath ?? uri.path ?? String(uri)
        }))
    };

    const panel = {
        webview,
        reveal: vi.fn(),
        dispose: vi.fn(),
        onDidDispose: vi.fn((callback: () => void, _thisArg?: unknown, disposables?: Array<{ dispose: () => void }>) => {
            disposeHandler = callback;
            const disposable = { dispose: vi.fn() };
            disposables?.push(disposable);
            return disposable;
        })
    };

    return {
        createWebviewPanel: vi.fn(() => panel),
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        executeCommand: vi.fn().mockResolvedValue(undefined),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        generateCssVariables: vi.fn(() => ':root {}'),
        uriFile: vi.fn((fsPath: string) => ({ fsPath, toString: () => fsPath })),
        uriJoinPath: vi.fn((base: { fsPath?: string; path?: string }, ...parts: string[]) => {
            const root = base.fsPath ?? base.path ?? '';
            const joined = [root, ...parts].join('/').replace(/\/+/g, '/');
            return { fsPath: joined, toString: () => joined };
        }),
        getMessageHandler: () => messageHandler,
        getDisposeHandler: () => disposeHandler,
        panel,
        webview
    };
});

vi.mock('vscode', () => ({
    window: {
        activeTextEditor: undefined,
        createWebviewPanel: mocks.createWebviewPanel,
        showOpenDialog: mocks.showOpenDialog,
        showSaveDialog: mocks.showSaveDialog,
        showInformationMessage: mocks.showInformationMessage,
        showWarningMessage: mocks.showWarningMessage,
        showErrorMessage: mocks.showErrorMessage
    },
    commands: {
        executeCommand: mocks.executeCommand
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: 'C:/workspace' } }]
    },
    ViewColumn: {
        One: 1
    },
    Uri: {
        file: mocks.uriFile,
        joinPath: mocks.uriJoinPath
    }
}), { virtual: true });

vi.mock('fs', () => ({
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync
}));

vi.mock('@cadtool-online/ui', () => ({
    generateCssVariables: mocks.generateCssVariables
}));

import { CadEditorPanel } from '../../../src/panels/CadEditorPanel';

describe('CadEditorPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CadEditorPanel.currentPanel = undefined;
        mocks.showOpenDialog.mockResolvedValue(undefined);
        mocks.showSaveDialog.mockResolvedValue(undefined);
        mocks.executeCommand.mockResolvedValue(undefined);
    });

    it('creates a webview panel once and reuses it on subsequent open requests', async () => {
        const extensionUri = { fsPath: 'C:/extension' };

        await CadEditorPanel.createOrShow(extensionUri as never);
        expect(mocks.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(CadEditorPanel.currentPanel).toBeTruthy();

        await CadEditorPanel.createOrShow(extensionUri as never);
        expect(mocks.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(mocks.panel.reveal).toHaveBeenCalledTimes(1);
    });

    it('updates the status when the webview reports ready', async () => {
        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        expect(handler).toBeTypeOf('function');

        await handler?.({ command: 'ready' });

        expect(mocks.webview.postMessage).toHaveBeenCalledWith({
            command: 'setStatus',
            text: 'Ready'
        });
    });

    it('imports CADTool config JSON and forwards parsed data to the webview', async () => {
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/cadtool.config.json' }]);
        mocks.readFileSync.mockReturnValue('{"connector":[{"name":"J1"}]}');

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        await CadEditorPanel.currentPanel?.requestCadtoolConfigImport();

        expect(mocks.readFileSync).toHaveBeenCalledWith('C:/workspace/cadtool.config.json', 'utf-8');
        expect(mocks.webview.postMessage).toHaveBeenCalledWith({
            command: 'importCadtoolConfig',
            fileName: 'cadtool.config.json',
            data: { connector: [{ name: 'J1' }] }
        });
    });

    it('exports CADTool config objects as formatted JSON', async () => {
        mocks.showSaveDialog.mockResolvedValue([{ fsPath: 'C:/workspace/cadtool.config.json' }][0]);

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        await (CadEditorPanel.currentPanel as unknown as { _handleExportCadtoolConfig: (data: unknown) => Promise<void> })
            ._handleExportCadtoolConfig({ connector: [{ name: 'J1' }] });

        expect(mocks.writeFileSync).toHaveBeenCalledWith(
            'C:/workspace/cadtool.config.json',
            '{\n  "connector": [\n    {\n      "name": "J1"\n    }\n  ]\n}',
            'utf-8'
        );
        expect(mocks.showInformationMessage).toHaveBeenCalledWith(
            'CADTool config exported successfully to cadtool.config.json'
        );
    });

    it('loads STEP bytes from disk and forwards them to the webview', async () => {
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/assembly.step' }]);
        mocks.readFileSync.mockReturnValue(Buffer.from([1, 2, 3, 4]));

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        await handler?.({ command: 'importStep' });

        expect(mocks.readFileSync).toHaveBeenCalledWith('C:/workspace/assembly.step');
        expect(mocks.webview.postMessage).toHaveBeenCalledWith({
            command: 'loadStepFile',
            fileName: 'assembly.step',
            fileContent: new Uint8Array([1, 2, 3, 4])
        });
    });
});
