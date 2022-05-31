import * as vscode from 'vscode'
import axios from 'axios'
import * as path from 'path'
import * as jsonwebtoken from 'jsonwebtoken'
import { NoteSidebarItem } from './NoteSidebarItem'
import { runSearch } from './noteSearch'

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

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new NoteSidebarProvider()
  const debouncedRefresh = debounce(() => sidebarProvider.refresh())
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dtinth-notes', sidebarProvider),
    vscode.commands.registerCommand('dtinth-notes.refresh', () => {
      sidebarProvider.refresh()
    }),
    vscode.commands.registerCommand('dtinth-notes.add', async () => {
      const wsedit = new vscode.WorkspaceEdit()
      const folder = vscode.workspace.workspaceFolders?.[0]
      if (!folder) {
        return
      }
      const wsPath = folder.uri.fsPath
      const id =
        new Date(Date.now()).toJSON().replace(/\W/g, '').slice(0, 15) +
        'Z' +
        (10000 + 10000 * Math.random()).toString().slice(-4)

      const filePath = vscode.Uri.file(wsPath + '/data/' + id + '.md')
      wsedit.createFile(filePath, { ignoreIfExists: true })
      wsedit.insert(
        filePath,
        new vscode.Position(0, 0),
        '---\npublic: false\n---\n'
      )
      await vscode.workspace.applyEdit(wsedit)
      const document = await vscode.workspace.openTextDocument(filePath)
      await document.save()
      await vscode.window.showTextDocument(document)
    }),
    vscode.commands.registerCommand('dtinth-notes.preview', async () => {
      const id = getCurrentNoteId()
      if (!id) {
        vscode.window.showErrorMessage('No active note')
        return
      }
      const jwt = jsonwebtoken.sign({ id }, getSecrets().previewSigningSecret, {
        algorithm: 'HS256',
        expiresIn: 5 * 86400,
      })
      vscode.env.openExternal(
        vscode.Uri.parse('https://notes.dt.in.th/preview-' + jwt)
      )
    }),
    vscode.commands.registerCommand('dtinth-notes.search', async () => {
      return runSearch(getSecrets())
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      debouncedRefresh()
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      debouncedRefresh()
    })
  )
}

function getCurrentNoteId() {
  return vscode.window.activeTextEditor?.document.fileName
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.md$/, '')
}

function getSecrets() {
  return require('../../secrets')
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
