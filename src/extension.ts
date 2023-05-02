import * as vscode from 'vscode';

let markStartPosition: vscode.Position | null = null;
let decorationType: vscode.TextEditorDecorationType | null = null;

export function activate(context: vscode.ExtensionContext) {
  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)', // Set the red box background color
    isWholeLine: false,
  });

  const disposable = vscode.commands.registerCommand('emacsMarkMode.toggle', () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    if (markStartPosition === null) {
      markStartPosition = editor.selection.active;
      vscode.window.showInformationMessage('Mark set.');
    } else {
      const currentCursorPosition = editor.selection.active;
      editor.selection = new vscode.Selection(markStartPosition, currentCursorPosition);
      markStartPosition = null;
      clearDecoration(editor);
    }
  });

  context.subscriptions.push(disposable); 

  const disposable2 = vscode.commands.registerCommand('emacsMarkMode.removeMark', () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    if (markStartPosition !== null) {
      markStartPosition = null;
      clearDecoration(editor);
    }
  });

  context.subscriptions.push(disposable2); 

  const disposable3 = vscode.commands.registerCommand('emacsMarkMode.cutSelection', () => {
    const editor = vscode.window.activeTextEditor;
  
    if (!editor) {
      return;
    }
  
    const cutSelectedText = () => {
      const selectedText = editor.document.getText(editor.selection);
  
      vscode.env.clipboard.writeText(selectedText).then(() => {
        editor.edit(editBuilder => {
          editBuilder.delete(editor.selection);
        });
      });
      markStartPosition = null;
      clearDecoration(editor);
    };
  
    if (markStartPosition !== null) {
      const currentCursorPosition = editor.selection.active;
      editor.selection = new vscode.Selection(markStartPosition, currentCursorPosition);
      cutSelectedText();
    } else {
      cutSelectedText();
    }
  });
  

  context.subscriptions.push(disposable3); 

  // Listen for changes in the text editor's selection
  const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
    if (markStartPosition !== null) {
      const editor = event.textEditor;
      const currentCursorPosition = editor.selection.active;
      updateDecoration(editor, markStartPosition, currentCursorPosition);
    }
  });

  // Add the selection change event listener disposable to the context's subscriptions
  context.subscriptions.push(selectionChangeDisposable);
}

export function deactivate() {
  markStartPosition = null;
}

function clearDecoration(editor: vscode.TextEditor) {
  if (decorationType) {
    editor.setDecorations(decorationType, []);
  }
}

// DONE-TODO(): Try cutting based on this range because the normal selection is a bit wonky
// TODO(): Rewrite to save mark and move to mark
function updateDecoration(
  editor: vscode.TextEditor,
  startPosition: vscode.Position,
  endPosition: vscode.Position
) {
  if (decorationType) {
    const range = new vscode.Range(startPosition, endPosition);
    editor.setDecorations(decorationType, [range]);
  }
}
