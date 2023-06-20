// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

class CommentNode {
  constructor(
    public readonly label: string,
    public readonly line: number,
    public readonly key: string,
    public readonly children: CommentNode[]
  ) {}
}

class CommentProvider implements vscode.TreeDataProvider<CommentNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommentNode | undefined | null | void
  > = new vscode.EventEmitter<CommentNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommentNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private comments: CommentNode[] = [];

  constructor(private readonly document: vscode.TextDocument) {
    this.parseComments();
  }

  getTreeItem(element: CommentNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    treeItem.command = {
      command: "comment-explorer.jumpToLine",
      title: "",
      arguments: [element.line],
    };

    return treeItem;
  }

  getChildren(element?: CommentNode): CommentNode[] {
    if (element) {
      return element.children;
    }
    //this.parseComments();
    return this.comments;
  }

  refresh(doc: any): void {
    this.parseComments();
    this._onDidChangeTreeData.fire(null);
  }

  private parseComments(): void {
    this.comments = [];

    const top_level_containers: Record<string, CommentNode> = {};
    const all_containers: Record<string, CommentNode> = {};

    const comment_regex = /^\s*(:?\/\/|\/\*)\s*#--\s*(.+?)\s*(\*\/)?\s*$/;

    for (let i = 0; i < this.document.lineCount; i++) {
      const line = this.document.lineAt(i);
      const regex_match = line.text.match(comment_regex);

      if (regex_match) {
        let label = regex_match[2];

        if (label.match(/::/)) {
          const components = label.split("::").map((l) => l.trim());

          const top_level = components[0];

          if (!top_level_containers[top_level]) {
            const container_node = new CommentNode(top_level, i, top_level, []);
            this.comments.push(container_node);
            top_level_containers[top_level] = container_node;
            all_containers[top_level] = container_node;
          }

          let parent = top_level;
          for (let j = 1; j < components.length; j++) {
            const label = components[j];
            const is_leaf = j + 1 >= components.length;

            let key = parent + " :: " + label;
            if (is_leaf) key += " :: line number " + i;

            if (is_leaf) {
              const leaf_node = new CommentNode(label, i, key, []);
              all_containers[parent].children.push(leaf_node);
            } else {
              all_containers[key] ||= new CommentNode(label, i, key, []);

              if (!all_containers[parent].children.find((c) => c.key === key)) {
                all_containers[parent].children.push(all_containers[key]);
              }

              parent = key;
            }
          }
        } else {
          const commentNode = new CommentNode(label, i, label, []);
          this.comments.push(commentNode);
        }
      }
    }
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  if (!vscode.window.activeTextEditor) {
    return;
  }

  const commentProvider = new CommentProvider(
    vscode.window.activeTextEditor.document
  );
  // const commentTreeView = vscode.window.createTreeView("commentExplorer", {
  //   treeDataProvider: commentProvider,
  // });

  vscode.window.registerTreeDataProvider("comment-explorer", commentProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "comment-explorer.jumpToLine",
      (line: number) => {
        const position = new vscode.Position(line, 0);
        const range = new vscode.Range(position, position);
        if (vscode.window.activeTextEditor) {
          vscode.window.activeTextEditor.selection = new vscode.Selection(
            position,
            position
          );
          vscode.window.activeTextEditor.revealRange(
            range,
            vscode.TextEditorRevealType.InCenter
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((e) => {
      if (
        vscode.window.activeTextEditor &&
        e === vscode.window.activeTextEditor.document
      ) {
        commentProvider.refresh(vscode.window.activeTextEditor.document);
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
