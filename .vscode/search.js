const path = require('path')
const axios = require('axios')
const secrets = require('../secrets')

exports.execute = async (args) => {
  /** @type {typeof import('vscode')} */
  const vscode = args.require('vscode')
  try {
    const activeTextEditor = vscode.window.activeTextEditor
    const selection = activeTextEditor ? activeTextEditor.selection : null
    const selectedText = activeTextEditor
      ? activeTextEditor.document.getText(selection)
      : ''

    const qp = vscode.window.createQuickPick()
    const currentId = activeTextEditor
      ? path.basename(activeTextEditor.document.uri.toString(), '.md')
      : null
    let latest = 0
    const search = async (searchText) => {
      const id = ++latest
      const items = await getItems(searchText).catch((e) => {
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
    qp.sortByLabel = false
    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0]
      const pageId = selected.id
      qp.hide()
      qp.value = ''
      if (selectedText) {
        activeTextEditor.edit((b) =>
          b.replace(selection, `[${selectedText}](${pageId})`)
        )
        // vscode.window.activeTextEditor.insertSnippet(
        //   new vscode.SnippetString(`[\${selectedText}](${pageId})`),
        // )
      } else {
        vscode.window.showTextDocument(
          vscode.Uri.file(path.resolve(__dirname, '../data', pageId + '.md'))
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

async function getItems(searchText) {
  const { data: results } = await axios.post(
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
  const items = results.map(({ id, title, excerpt, match }) => {
    const isLink = Object.values(match).some((x) => x.includes('links'))
    return {
      label: (isLink ? '$(link) ' : '') + title,
      id,
      description: id,
      detail: excerpt,
      alwaysShow: true,
    }
  })
  return items
}
