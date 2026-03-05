import * as vscode from 'vscode';
import { CadEditorPanel } from './panels/CadEditorPanel';
import { registerCadtoolLanguageFeatures } from './language/cadtoolLanguageFeatures';

export function activate(context: vscode.ExtensionContext) {
    console.log('CadToolOnline extension is now active');
    vscode.window.showInformationMessage('CadToolOnline extension activated!');

    registerCadtoolLanguageFeatures(context);

    const openEditorCommand = vscode.commands.registerCommand(
        'cadtool-online.openEditor',
        () => {
            console.log('Opening CAD Editor...');
            vscode.window.showInformationMessage('Opening CAD Editor...');
            CadEditorPanel.createOrShow(context.extensionUri);
        }
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

    context.subscriptions.push(openEditorCommand, openCadtoolDocsCommand);
}

export function deactivate() {
    console.log('CadToolOnline extension is now deactivated');
}
