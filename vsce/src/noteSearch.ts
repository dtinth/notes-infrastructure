import * as vscode from 'vscode'
import * as path from 'path'
import axios from 'axios'

export function runSearch(secrets: any) {
  try {
    const activeTextEditor = vscode.window.activeTextEditor
    const selection = activeTextEditor ? activeTextEditor.selection : null
    const selectedText =
      activeTextEditor && selection
        ? activeTextEditor.document.getText(selection)
        : ''
    if (!activeTextEditor) return

    const qp = vscode.window.createQuickPick<SearchResultItem>()
    const currentId = activeTextEditor
      ? path.basename(activeTextEditor.document.uri.toString(), '.md')
      : null
    let latest = 0
    const search = async (searchText: string) => {
      const id = ++latest
      const items = await getItems(searchText, secrets).catch((e) => {
        vscode.window.showErrorMessage(String(e))
        throw e
      })
      if (latest === id) {
        qp.items = items.filter((x) => {
          return x.id !== currentId
        })
      }
    }
    qp.matchOnDetail = true
    qp.matchOnDescription = true
    ;(qp as any).sortByLabel = false
    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0]
      const pageId = selected.id
      qp.hide()
      qp.value = ''
      if (selection && selectedText) {
        activeTextEditor.edit((b) =>
          b.replace(selection, `[${selectedText}](${pageId})`)
        )
        // vscode.window.activeTextEditor.insertSnippet(
        //   new vscode.SnippetString(`[\${selectedText}](${pageId})`),
        // )
      } else {
        vscode.window.showTextDocument(
          vscode.Uri.file(path.resolve(__dirname, '../../data', pageId + '.md'))
        )
      }
    })
    qp.onDidChangeValue(async (searchText) => {
      search(searchText)
    })
    if (selectedText) {
      qp.placeholder = 'Link to...'
      search((currentId || '') + ' ' + selectedText)
    } else {
      qp.placeholder = 'Open...'
      search(
        (currentId || '') +
          ' ' +
          (activeTextEditor ? activeTextEditor.document.getText() : '')
      )
    }
    qp.show()
  } catch (error) {
    vscode.window.showErrorMessage(String(error))
  }
}

interface SearchResultItem extends vscode.QuickPickItem {
  id: string
}

type GetItemsResponse = {
  id: string
  title: string
  excerpt: string
  match: Record<string, string>
}[]

async function getItems(searchText: string, secrets: any) {
  const { data: results } = await axios.post<GetItemsResponse>(
    'http://127.0.0.1:21001/search',
    {
      q: searchText,
    },
    {
      params: {
        key: secrets.apiToken,
      },
    }
  )
  const items = results.map(
    ({ id, title, excerpt, match }): SearchResultItem => {
      const isLink = Object.values(match).some((x) => x.includes('links'))
      return {
        label: (isLink ? '$(link) ' : '') + title,
        id,
        description: '',
        detail: excerpt,
        alwaysShow: true,
      }
    }
  )
  return items
}
