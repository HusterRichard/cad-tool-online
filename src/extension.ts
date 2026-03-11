import * as vscode from 'vscode';
import { CadEditorPanel } from './panels/CadEditorPanel';
import { registerCadtoolLanguageFeatures } from './language/cadtoolLanguageFeatures';
import { registerModelicaCadtoolFeatures } from './language/modelicaCadtoolFeatures';

export function activate(context: vscode.ExtensionContext) {
    console.log('CadToolOnline extension is now active');
    vscode.window.showInformationMessage('CadToolOnline extension activated!');

    registerCadtoolLanguageFeatures(context);
    registerModelicaCadtoolFeatures(context);

    const openCadEditor = async () => {
        console.log('Opening CAD Editor...');
        vscode.window.showInformationMessage('Opening CAD Editor...');
        await CadEditorPanel.createOrShow(context.extensionUri, { openInNewWindow: false });
    };

    const openEditorCommand = vscode.commands.registerCommand(
        'cadtool-online.openEditor',
        openCadEditor
    );

    const openEditorFromMenuCommand = vscode.commands.registerCommand(
        'cadtool-online.openEditorFromMenu',
        openCadEditor
    );

    const openCadtoolDocsCommand = vscode.commands.registerCommand(
        'cadtool-online.openCadtoolDocs',
        async () => {
            const docsUrl = 'https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox.html';
            const opened = await vscode.env.openExternal(vscode.Uri.parse(docsUrl));
            if (!opened) {
                vscode.window.showErrorMessage(`Failed to open CADTool docs: ${docsUrl}`);
            }
        }
    );

    const exportCadtoolConfigCommand = vscode.commands.registerCommand(
        'cadtool-online.exportCadtoolConfig',
        () => {
            const panel = CadEditorPanel.currentPanel;
            if (!panel) {
                vscode.window.showInformationMessage('Please open CAD Editor first, then export CADTool config.');
                return;
            }

            panel.requestCadtoolConfigExport();
        }
    );

    const importCadtoolConfigCommand = vscode.commands.registerCommand(
        'cadtool-online.importCadtoolConfig',
        async () => {
            const panel = CadEditorPanel.currentPanel;
            if (!panel) {
                vscode.window.showInformationMessage('Please open CAD Editor first, then import CADTool config.');
                return;
            }

            await panel.requestCadtoolConfigImport();
        }
    );

    context.subscriptions.push(
        openEditorCommand,
        openEditorFromMenuCommand,
        openCadtoolDocsCommand,
        exportCadtoolConfigCommand,
        importCadtoolConfigCommand
    );
}

export function deactivate() {
    console.log('CadToolOnline extension is now deactivated');
}
