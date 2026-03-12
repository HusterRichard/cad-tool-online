import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    registerCommand: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    openExternal: vi.fn(),
    uriParse: vi.fn((value: string) => ({ value, toString: () => value })),
    createOrShow: vi.fn(),
    registerCadtoolLanguageFeatures: vi.fn(),
    registerModelicaCadtoolFeatures: vi.fn()
}));

vi.mock('vscode', () => ({
    commands: {
        registerCommand: mocks.registerCommand
    },
    window: {
        showInformationMessage: mocks.showInformationMessage,
        showErrorMessage: mocks.showErrorMessage
    },
    env: {
        openExternal: mocks.openExternal
    },
    Uri: {
        parse: mocks.uriParse
    }
}), { virtual: true });

vi.mock('../../../src/panels/CadEditorPanel', () => ({
    CadEditorPanel: {
        currentPanel: undefined as
            | {
                requestCadtoolConfigExport: () => void;
                requestCadtoolConfigImport: () => Promise<void>;
            }
            | undefined,
        createOrShow: mocks.createOrShow
    }
}));

vi.mock('../../../src/language/cadtoolLanguageFeatures', () => ({
    registerCadtoolLanguageFeatures: mocks.registerCadtoolLanguageFeatures
}));

vi.mock('../../../src/language/modelicaCadtoolFeatures', () => ({
    registerModelicaCadtoolFeatures: mocks.registerModelicaCadtoolFeatures
}));

import { activate } from '../../../src/extension';
import { CadEditorPanel } from '../../../src/panels/CadEditorPanel';

type ExtensionContextLike = {
    extensionUri: { fsPath: string };
    subscriptions: Array<{ dispose: () => void }>;
};

function createContext(): ExtensionContextLike {
    return {
        extensionUri: { fsPath: 'C:/extension' },
        subscriptions: []
    };
}

function registerDisposable() {
    return { dispose: vi.fn() };
}

function getRegisteredCallback(commandId: string): (...args: unknown[]) => unknown {
    const call = mocks.registerCommand.mock.calls.find(([id]) => id === commandId);
    expect(call, `Missing command registration for ${commandId}`).toBeTruthy();
    return call?.[1] as (...args: unknown[]) => unknown;
}

describe('extension activate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.registerCommand.mockImplementation((_id: string, _callback: (...args: unknown[]) => unknown) => registerDisposable());
        mocks.openExternal.mockResolvedValue(true);
        CadEditorPanel.currentPanel = undefined;
    });

    it('registers expected commands and language features', () => {
        const context = createContext();

        activate(context as never);

        expect(mocks.registerCadtoolLanguageFeatures).toHaveBeenCalledWith(context);
        expect(mocks.registerModelicaCadtoolFeatures).toHaveBeenCalledWith(context);
        expect(mocks.registerCommand).toHaveBeenCalledTimes(5);
        expect(mocks.registerCommand.mock.calls.map(([id]) => id)).toEqual([
            'cadtool-online.openEditor',
            'cadtool-online.openEditorFromMenu',
            'cadtool-online.openCadtoolDocs',
            'cadtool-online.exportCadtoolConfig',
            'cadtool-online.importCadtoolConfig'
        ]);
        expect(context.subscriptions).toHaveLength(5);
    });

    it('opens the CAD editor from both entry commands', async () => {
        const context = createContext();
        activate(context as never);

        await getRegisteredCallback('cadtool-online.openEditor')();
        await getRegisteredCallback('cadtool-online.openEditorFromMenu')();

        expect(mocks.createOrShow).toHaveBeenNthCalledWith(
            1,
            context.extensionUri,
            { openInNewWindow: false }
        );
        expect(mocks.createOrShow).toHaveBeenNthCalledWith(
            2,
            context.extensionUri,
            { openInNewWindow: false }
        );
    });

    it('shows an error when opening docs fails', async () => {
        const context = createContext();
        mocks.openExternal.mockResolvedValue(false);

        activate(context as never);
        await getRegisteredCallback('cadtool-online.openCadtoolDocs')();

        expect(mocks.uriParse).toHaveBeenCalledWith(
            'https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox.html'
        );
        expect(mocks.showErrorMessage).toHaveBeenCalledWith(
            'Failed to open CADTool docs: https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox.html'
        );
    });

    it('prompts users to open the editor before import or export when no panel exists', async () => {
        const context = createContext();

        activate(context as never);
        getRegisteredCallback('cadtool-online.exportCadtoolConfig')();
        await getRegisteredCallback('cadtool-online.importCadtoolConfig')();

        expect(mocks.showInformationMessage).toHaveBeenCalledWith(
            'Please open CAD Editor first, then export CADTool config.'
        );
        expect(mocks.showInformationMessage).toHaveBeenCalledWith(
            'Please open CAD Editor first, then import CADTool config.'
        );
    });

    it('delegates import and export requests to the active panel', async () => {
        const context = createContext();
        const requestCadtoolConfigExport = vi.fn();
        const requestCadtoolConfigImport = vi.fn().mockResolvedValue(undefined);
        CadEditorPanel.currentPanel = {
            requestCadtoolConfigExport,
            requestCadtoolConfigImport
        };

        activate(context as never);
        getRegisteredCallback('cadtool-online.exportCadtoolConfig')();
        await getRegisteredCallback('cadtool-online.importCadtoolConfig')();

        expect(requestCadtoolConfigExport).toHaveBeenCalledTimes(1);
        expect(requestCadtoolConfigImport).toHaveBeenCalledTimes(1);
    });
});
