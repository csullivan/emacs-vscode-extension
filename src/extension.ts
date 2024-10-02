import * as vscode from 'vscode';
import * as path from 'path';
import fetch from 'node-fetch';


let markStartPosition: vscode.Position | null = null;
let decorationType: vscode.TextEditorDecorationType | null = null;
let isApplyingDiff = false;
const undoTreeVisualizations: Map<string, vscode.Uri> = new Map();

// Define the type for the position data
interface PositionData {
  line: number;
  column: number;
  file_path: string;
}

export function activate(context: vscode.ExtensionContext) {
  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(141, 110, 199, 0.3)', // Set the red box background color
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

  const disposable4 = vscode.commands.registerCommand('emacsMarkMode.commentRegion', () => {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      return;
    }

    const commentSelectedRegion = () => {
      vscode.commands.executeCommand('editor.action.commentLine');
      markStartPosition = null;
      clearDecoration(editor);
    };

    if (markStartPosition !== null) {
      const currentCursorPosition = editor.selection.active;
      editor.selection = new vscode.Selection(markStartPosition, currentCursorPosition);
      commentSelectedRegion();
    } else if (!editor.selection.isEmpty) {
      commentSelectedRegion();
    }
    // If markStartPosition is null and there's no active selection, do nothing
  });

  context.subscriptions.push(disposable4);

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
      if (!isApplyingDiff && e.document.uri.scheme === 'file' && e.document === vscode.window.activeTextEditor?.document) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const undoTree = getUndoTreeForDocument(editor.document);
          const fileState = editor.document.getText();
          undoTree.addNode(fileState);
        }
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.customUndo', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        undoTree.undo();
        await applyFileState(undoTree.current);
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.customRedo', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await applyFileState(undoTree.current);
        undoTree.redo();
      }
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('emacsMarkMode.showUndoTree', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const undoTree = getUndoTreeForDocument(editor.document);
        await displayUndoTree(undoTree, editor.document);
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




  let disposableOpenEmacs = vscode.commands.registerCommand('emacs.openEmacs', () => {
      let editor = vscode.window.activeTextEditor;
      if (!editor) {
          return;
      }
      editor.document.save();
      let lineNumber = editor.selection.active.line + 1; // lines are 0-indexed
      let columnNumber = editor.selection.active.character + 1; // characters are 0-indexed
      let terminal = vscode.window.createTerminal(`Emacs: ${editor.document.fileName}`);
      terminal.sendText(`emacs +${lineNumber}:${columnNumber} ${editor.document.fileName}`);
      terminal.show();
      vscode.commands.executeCommand('workbench.action.terminal.moveToEditor').then(() => {
          terminal.show();
      });
      terminal.show();

  });



  context.subscriptions.push(disposableOpenEmacs);


  function isPositionData(data: any): data is PositionData {
    return 'line' in data && 'column' in data && 'file_path' in data;
  }

  let disposable_server = vscode.commands.registerCommand('extension.openFileAtLineAndColumn', async () => {
    // Fetch the line, column, and file path from the Python server
    const response = await fetch('http://localhost:5000/position');
    const data = await response.json(); 
    if (!isPositionData(data)) {
        console.error('Invalid position data', data);
        return;
    }
    const positionData: PositionData = data;
    const line = positionData.line - 1;
    const column = positionData.column;
    const filePath = path.resolve(positionData.file_path);
    // console.log('filePath', filePath);
    // console.log('line', line);
    // console.log('column', column);

    
    // Check if the document is already open
    let document: vscode.TextDocument | undefined = vscode.workspace.textDocuments.find(doc => doc.fileName === filePath);

    // Open the file if it's not already open
    if (!document) {
        document = await vscode.workspace.openTextDocument(filePath);
    }

    // Open the document in the editor
    const editor = await vscode.window.showTextDocument(document);

    // Move the cursor
    const position = new vscode.Position(line, column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
});

context.subscriptions.push(disposable_server);




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
  fileState: string | null;

  constructor(parent: UndoTreeNode | null, fileState: string | null) {
    this.parent = parent;
    this.children = [];
    this.fileState = fileState;
  }
}

async function applyFileState(node: UndoTreeNode) {
  isApplyingDiff = true;
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (node.fileState !== null) {
      const entireRange = editor.document.validateRange(
        new vscode.Range(0, 0, Infinity, Infinity)
      );
      await editor.edit((editBuilder) => {
        editBuilder.replace(entireRange, node.fileState!);
      });
    }
  } finally {
    isApplyingDiff = false;
  }
}

class UndoTree {
  current: UndoTreeNode;
  root: UndoTreeNode;
  selectedChildIndex: number;

  constructor() {
    this.root = new UndoTreeNode(null, null);
    this.current = this.root;
    this.selectedChildIndex = 0;
  }

  addNode(fileState: string) {
    const newNode = new UndoTreeNode(this.current, fileState);
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
      // Use the selectedChildIndex to determine which child node to move to.
      this.current = this.current.children[this.selectedChildIndex];
      this.selectedChildIndex = 0;
    }
  }}

const undoTrees: Map<string, UndoTree> = new Map();

function getUndoTreeForDocument(document: vscode.TextDocument): UndoTree {
  const uri = document.uri.toString();
  if (!undoTrees.has(uri)) {
    undoTrees.set(uri, new UndoTree());
  }
  return undoTrees.get(uri)!;
}


/// Rendering

function renderTree(tree: UndoTreeNode, currentNode: UndoTreeNode, selectedChildIndex: number): string[] {
  let lines: string[] = [];

  function traverse(node: UndoTreeNode, depth: number, prefix: string, isLastSibling: boolean, isSelectedChild: boolean) {
    const isCurrentNode = node === currentNode;
    lines.push(prefix + (isCurrentNode ? "x" : "o") + (isSelectedChild ? "*" : ""));

    if (node.children.length > 0) {
      const childPrefix = prefix.slice(0, -3) + (isLastSibling ? "   " : "|  ");
      for (let i = 0; i < node.children.length; i++) {
        if (i > 0) {
          lines.push(childPrefix + "|");
        }
        // Mark the child with "*" only if the current node is the active node
        const markChild = isCurrentNode && i === selectedChildIndex;
        traverse(node.children[i], depth + 1, childPrefix + (i < node.children.length - 1 ? "|__" : "\\  "), i === node.children.length - 1, markChild);
      }
    }
  }

  traverse(tree, 0, "", true, false);
  return lines;
}

async function displayUndoTree(tree: UndoTree, document: vscode.TextDocument) {
  const text = renderTree(tree.root, tree.current, tree.selectedChildIndex).join('\n');
  const documentUri = document.uri.toString();
  const existingVisualizationUri = undoTreeVisualizations.get(documentUri);

  if (existingVisualizationUri) {
    // Update the content of the existing undo tree visualization file.
    const existingDoc = await vscode.workspace.openTextDocument(existingVisualizationUri);
    const entireRange = existingDoc.validateRange(
      new vscode.Range(0, 0, Infinity, Infinity)
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(existingVisualizationUri, entireRange, text);
    await vscode.workspace.applyEdit(edit);
    await vscode.window.showTextDocument(existingDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  } else {
    // Create a new undo tree visualization file and store the mapping.
    const uri = vscode.Uri.parse(`untitled:${encodeURIComponent('Undo Tree')}`);
    const doc = await vscode.workspace.openTextDocument({ content: text, language: 'plaintext' });
    await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    undoTreeVisualizations.set(documentUri, uri);
  }

  // Switch back to the original document.
  const originalEditor = vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === documentUri
  );
  if (originalEditor) {
    await vscode.window.showTextDocument(originalEditor.document, { viewColumn: originalEditor.viewColumn });
  } else {
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

async function traverseTree(document: vscode.TextDocument, undoTree: UndoTree, direction: 'up' | 'down' | 'left' | 'right') {
  switch (direction) {
    case 'up':
      undoTree.undo();
      await applyFileState(undoTree.current);
      break;
    case 'down':
      await applyFileState(undoTree.current);
      undoTree.redo();
      break;
    case 'right':
      if (undoTree.current.children.length > 1) {
        undoTree.selectedChildIndex = Math.max(0, undoTree.selectedChildIndex - 1);
      }
      break;
    case 'left':
      if (undoTree.current.children.length > 1) {
        undoTree.selectedChildIndex = Math.min(undoTree.current.children.length - 1, undoTree.selectedChildIndex + 1);
      }
      break;
  }
    // Update the visualization after traversing the tree
    await displayUndoTree(undoTree, document);

}


