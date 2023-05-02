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


  //////////// Undo Tree ////////////
  
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      const undoTree = getUndoTreeForDocument(e.document);
      undoTree.addNode(e.contentChanges[0]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.customUndo', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        undoTree.undo();
        await applyDiff(editor.document, undoTree.current, true);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.customRedo', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await applyDiff(editor.document, undoTree.current, false);
        undoTree.redo();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.showUndoTree', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await displayUndoTree(undoTree);
      }
    })
  );

  // Register custom keybindings for traversing the tree
  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.moveDown', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await traverseTree(editor.document, undoTree, 'down');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.moveUp', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await traverseTree(editor.document, undoTree, 'up');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.moveLeft', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await traverseTree(editor.document, undoTree, 'left');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.moveRight', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await traverseTree(editor.document, undoTree, 'right');
      }
    })
  );






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


//////////// Undo Tree ////////////

class UndoTreeNode {
  parent: UndoTreeNode | null;
  children: UndoTreeNode[];
  diff: vscode.TextDocumentContentChangeEvent | null;

  constructor(parent: UndoTreeNode | null, diff: vscode.TextDocumentContentChangeEvent | null) {
    this.parent = parent;
    this.children = [];
    this.diff = diff;
  }
}

async function applyDiff(document: vscode.TextDocument, node: UndoTreeNode, undo: boolean) {
  const edit = new vscode.WorkspaceEdit();
  const diff = node.diff;

  if (diff) {
    const range = undo ? diff.range : diff.range.with(undefined, diff.range.start.translate(0, diff.text.length));
    const text = undo ? diff.text : '';
    edit.replace(document.uri, range, text);
    await vscode.workspace.applyEdit(edit);
  }
}

class UndoTree {
  current: UndoTreeNode;
  root: UndoTreeNode;

  constructor() {
    this.root = new UndoTreeNode(null, null);
    this.current = this.root;
  }

  addNode(diff: vscode.TextDocumentContentChangeEvent) {
    const newNode = new UndoTreeNode(this.current, diff);
    this.current.children.push(newNode);
    this.current = newNode;
  }

  undo() {
    if (this.current.parent) {
      this.current = this.current.parent;
    }
  }

  redo() {
    if (this.current.children.length > 0) {
      this.current = this.current.children[0];
    }
  }
}

const undoTrees: Map<string, UndoTree> = new Map();

function getUndoTreeForDocument(document: vscode.TextDocument): UndoTree {
  const uri = document.uri.toString();
  if (!undoTrees.has(uri)) {
    undoTrees.set(uri, new UndoTree());
  }
  return undoTrees.get(uri)!;
}

/// Rendering

function renderTree(tree: UndoTree, currentNode: UndoTreeNode | null = null): string[] {
  function renderNode(node: UndoTreeNode, lines: string[]): string[] {
    const childrenCount = node.children.length;
    if (childrenCount === 0) {
      return [node === currentNode ? 'x' : 'o'];
    }

    const childLines: string[][] = node.children.map((child) => renderNode(child, lines));
    const maxChildHeight = Math.max(...childLines.map((lines) => lines.length));

    const extendedChildLines = childLines.map((lines) => {
      const padding = Array(maxChildHeight - lines.length).fill(' ');
      return padding.concat(lines);
    });

    const horizontalLine = extendedChildLines.map(() => ' ').join('_');
    const verticalLines = extendedChildLines.map(() => '|').join(' ');

    const nodeSymbol = node === currentNode ? 'x' : 'o';
    const nodeLine = `${nodeSymbol}${horizontalLine}`;

    return [nodeLine, verticalLines].concat(...extendedChildLines);
  }

  return renderNode(tree.root, []);
}

async function displayUndoTree(tree: UndoTree) {
  const text = renderTree(tree, tree.current).join('\n');
  const uri = vscode.Uri.parse(`untitled:${encodeURIComponent('Undo Tree')}`);
  const doc = await vscode.workspace.openTextDocument({ content: text, language: 'plaintext' });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}

async function traverseTree(document: vscode.TextDocument, undoTree: UndoTree, direction: 'up' | 'down' | 'left' | 'right') {
  switch (direction) {
    case 'up':
      undoTree.undo();
      await applyDiff(document, undoTree.current, true);
      break;
    case 'down':
      await applyDiff(document, undoTree.current, false);
      undoTree.redo();
      break;
    case 'left':
      if (undoTree.current.parent && undoTree.current.parent.children.length > 1) {
        const index = undoTree.current.parent.children.indexOf(undoTree.current);
        if (index > 0) {
          undoTree.current = undoTree.current.parent.children[index - 1];
          await applyDiff(document, undoTree.current, false);
        }
      }
      break;
    case 'right':
      if (undoTree.current.parent && undoTree.current.parent.children.length > 1) {
        const index = undoTree.current.parent.children.indexOf(undoTree.current);
        if (index < undoTree.current.parent.children.length - 1) {
          undoTree.current = undoTree.current.parent.children[index + 1];
          await applyDiff(document, undoTree.current, false);
        }
      }
      break;
  }
}
