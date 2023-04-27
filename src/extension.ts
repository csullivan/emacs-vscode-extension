import * as vscode from 'vscode';

let at_last_edit = false;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('extension.statefulKeybind', () => {
        // 
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (at_last_edit) {
                at_last_edit = false;
                vscode.commands.executeCommand('workbench.action.navigateBack');
            } else {
                at_last_edit = true;
                vscode.commands.executeCommand('workbench.action.navigateToLastEditLocation');
            }
        }
    });

    context.subscriptions.push(disposable);

    const disposable2 = vscode.commands.registerCommand('extension.exampleSearchAndReplace', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const searchTerm = await vscode.window.showInputBox({ prompt: 'Enter the search term' });
        if (!searchTerm) {
            return;
        }

        const replaceTerm = await vscode.window.showInputBox({ prompt: 'Enter the replace term' });
        if (!replaceTerm) {
            return;
        }

        editor.edit(editBuilder => {
            const document = editor.document;
            const documentText = document.getText();
            const searchRegex = new RegExp(escapeRegExp(searchTerm), 'g');

            let match;
            while ((match = searchRegex.exec(documentText)) !== null) {
                const range = new vscode.Range(
                    document.positionAt(match.index),
                    document.positionAt(match.index + match[0].length)
                );
                editBuilder.replace(range, replaceTerm);
            }
        });
    });

    context.subscriptions.push(disposable2);


    function escapeRegExp(string: string): string {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
    }
    
}

