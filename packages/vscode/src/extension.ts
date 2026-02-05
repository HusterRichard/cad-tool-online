import * as vscode from 'vscode';
import { CadEditorPanel } from './webview/CadEditorPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('CadToolOnline extension is now active');
    vscode.window.showInformationMessage('CadToolOnline extension activated!');

    const openEditorCommand = vscode.commands.registerCommand(
        'cadtool-online.openEditor',
        () => {
            console.log('Opening CAD Editor...');
            vscode.window.showInformationMessage('Opening CAD Editor...');
            CadEditorPanel.createOrShow(context.extensionUri);
        }
    );

    context.subscriptions.push(openEditorCommand);
}

export function deactivate() {
    console.log('CadToolOnline extension is now deactivated');
}
