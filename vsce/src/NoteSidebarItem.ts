import * as vscode from 'vscode'

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
