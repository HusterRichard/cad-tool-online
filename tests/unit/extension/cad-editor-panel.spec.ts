import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'path';

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
        getConfiguration: vi.fn(),
        configurationGet: vi.fn(),
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        generateCssVariables: vi.fn(() => ':root {}'),
        homedir: vi.fn(() => '/home/user'),
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
        workspaceFolders: [{ uri: { fsPath: 'C:/workspace' } }],
        getConfiguration: mocks.getConfiguration
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
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync
}));

vi.mock('os', () => ({
    homedir: mocks.homedir
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
        mocks.getConfiguration.mockReturnValue({ get: mocks.configurationGet });
        mocks.configurationGet.mockImplementation((_key: string, fallback?: string) => fallback);
        mocks.existsSync.mockReturnValue(true);
        mocks.homedir.mockReturnValue('/home/user');
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

    it('opens STEP import from the sysplorer model directory when it exists', async () => {
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/assembly.step' }]);
        mocks.readFileSync.mockReturnValue(Buffer.from([1, 2, 3, 4]));

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        await handler?.({ command: 'importStep' });

        const stepModelDir = path.join('/home/user', 'syslab-server', 'sysplorer', 'model');
        expect(mocks.existsSync).toHaveBeenCalledWith(stepModelDir);
        expect(mocks.uriFile).toHaveBeenCalledWith(stepModelDir);
        expect(mocks.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
            defaultUri: expect.objectContaining({ fsPath: stepModelDir })
        }));
    });

    it('uses a configured relative STEP import directory when provided', async () => {
        mocks.configurationGet.mockImplementation((key: string, fallback?: string) => (
            key === 'stepImport.defaultDirectory' ? 'custom/models' : fallback
        ));
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/assembly.step' }]);
        mocks.readFileSync.mockReturnValue(Buffer.from([1, 2, 3, 4]));

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        await handler?.({ command: 'importStep' });

        const configuredDir = path.join('/home/user', 'custom', 'models');
        expect(mocks.getConfiguration).toHaveBeenCalledWith('cadtool-online');
        expect(mocks.existsSync).toHaveBeenCalledWith(configuredDir);
        expect(mocks.uriFile).toHaveBeenCalledWith(configuredDir);
        expect(mocks.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
            defaultUri: expect.objectContaining({ fsPath: configuredDir })
        }));
    });

    it('uses a configured absolute STEP import directory when provided', async () => {
        mocks.configurationGet.mockImplementation((key: string, fallback?: string) => (
            key === 'stepImport.defaultDirectory' ? '/mnt/shared/step-models' : fallback
        ));
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/assembly.step' }]);
        mocks.readFileSync.mockReturnValue(Buffer.from([1, 2, 3, 4]));

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        await handler?.({ command: 'importStep' });

        expect(mocks.existsSync).toHaveBeenCalledWith('/mnt/shared/step-models');
        expect(mocks.uriFile).toHaveBeenCalledWith('/mnt/shared/step-models');
        expect(mocks.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
            defaultUri: expect.objectContaining({ fsPath: '/mnt/shared/step-models' })
        }));
    });

    it('falls back to the home directory when the sysplorer model directory is missing', async () => {
        mocks.existsSync.mockReturnValue(false);
        mocks.showOpenDialog.mockResolvedValue([{ fsPath: 'C:/workspace/assembly.step' }]);
        mocks.readFileSync.mockReturnValue(Buffer.from([1, 2, 3, 4]));

        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();
        await handler?.({ command: 'importStep' });

        expect(mocks.existsSync).toHaveBeenCalledWith(path.join('/home/user', 'syslab-server', 'sysplorer', 'model'));
        expect(mocks.uriFile).toHaveBeenCalledWith('/home/user');
        expect(mocks.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
            defaultUri: expect.objectContaining({ fsPath: '/home/user' })
        }));
    });

    it('forwards point-point contact ribbon actions with the normalized contact type', async () => {
        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();

        await handler?.({ command: 'ribbonAction', action: 'createContact_pointPoint' });

        expect(mocks.showInformationMessage).toHaveBeenCalledWith('Creating point-point contact');
        expect(mocks.webview.postMessage).toHaveBeenCalledWith({
            command: 'mbsAction',
            action: 'createContact',
            contactType: 'pointPoint'
        });
    });

    it('forwards point-surface contact ribbon actions with the normalized contact type', async () => {
        await CadEditorPanel.createOrShow({ fsPath: 'C:/extension' } as never);
        const handler = mocks.getMessageHandler();

        await handler?.({ command: 'ribbonAction', action: 'createContact_pointSurface' });

        expect(mocks.showInformationMessage).toHaveBeenCalledWith('Creating point-surface contact');
        expect(mocks.webview.postMessage).toHaveBeenCalledWith({
            command: 'mbsAction',
            action: 'createContact',
            contactType: 'pointSurface'
        });
    });
});
