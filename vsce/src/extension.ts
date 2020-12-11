import * as vscode from 'vscode'
import axios from 'axios'
import * as path from 'path'

export class NoteSidebarProvider
  implements vscode.TreeDataProvider<NoteSidebarItem> {
  currentTree: Promise<NoteSidebarItem[]> | null = null
  _onDidChangeTreeData = new vscode.EventEmitter<
    void | NoteSidebarItem | null | undefined
  >()

  refresh() {
    this.currentTree = null
    this._onDidChangeTreeData.fire()
  }

  onDidChangeTreeData = this._onDidChangeTreeData.event

  getTreeItem(
    element: NoteSidebarItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    const outItem: vscode.TreeItem = { ...element }
    if (element.noteId) {
      outItem.resourceUri = vscode.Uri.file(
        path.resolve(__dirname, '../../data', element.noteId + '.md')
      )
      outItem.command = {
        command: 'vscode.open',
        arguments: [outItem.resourceUri],
        title: 'Open this file',
      }
    }
    if (element.icon) {
      outItem.iconPath = new vscode.ThemeIcon(
        element.icon.id,
        element.icon.color
          ? new vscode.ThemeColor(element.icon.color)
          : undefined
      )
    }
    return outItem
  }

  getChildren(
    element?: NoteSidebarItem
  ): vscode.ProviderResult<NoteSidebarItem[]> {
    if (element) {
      return element.children ?? []
    }
    if (!this.currentTree) {
      const secrets = require('../../secrets')
      const key = secrets.apiToken
      const activeTextEditor = vscode.window.activeTextEditor
      const id = activeTextEditor
        ? path.basename(activeTextEditor.document.uri.toString(), '.md')
        : ''
      this.currentTree = axios
        .get(
          'http://localhost:21001/sidebar' +
            '?key=' +
            encodeURIComponent(key) +
            '&id=' +
            encodeURIComponent(id)
        )
        .then((r) => {
          return r.data
        })
        .catch((e) => {
          return [{ id: 'error', label: 'Error: ' + e }]
        })
    }
    return this.currentTree
  }
}

export interface NoteSidebarItem {
  id: string
  label: string
  noteId?: string
  children?: NoteSidebarItem[]
  collapsibleState?: vscode.TreeItemCollapsibleState
  icon?: {
    id: string
    color: string
  }
}

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new NoteSidebarProvider()
  const debouncedRefresh = debounce(() => sidebarProvider.refresh())
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dtinth-notes', sidebarProvider),
    vscode.commands.registerCommand('dtinth-notes.refresh', () => {
      sidebarProvider.refresh()
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      debouncedRefresh()
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      debouncedRefresh()
    })
  )
}

function debounce(action: () => void) {
  let t: NodeJS.Timeout | undefined
  return () => {
    if (t) {
      clearTimeout(t)
    }
    t = setTimeout(() => action(), 500)
  }
}

export function deactivate() {}
