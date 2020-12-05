exports.execute = async (args) => {
  const vscode = args.require('vscode')
  try {
    const axios = require('axios')
    const dotenv = require('dotenv')
    const fs = require('fs')
    const cfg = dotenv.parse(fs.readFileSync(vscode.workspace.rootPath + '/.env'))

    let state = global.dtinthSearch
    if (!state) {
      state = {}
      global.dtinthSearch = state
    }

    const q = await vscode.window.showInputBox({ prompt: 'What do you want to search for?', value: state.q })
    if (!q) {
      return
    }

    state.q = q

    let cache = global.dtinthSearch.cache
    if (!cache || cache.version != 2) {
      cache = new Map()
      cache.version = 2
      global.dtinthSearch.cache = cache
    }

    const selected = await vscode.window.showQuickPick((async () => {
      let result = cache.get(q)
      if (!result) {
        result = (await axios.get('https://api.bing.microsoft.com/v7.0/search', {
          params: { q },
          headers: {
            'Ocp-Apim-Subscription-Key': cfg.AZURE_BING_API_KEY
          }
        })).data
        cache.set(q, result)
      }
      return result.webPages.value.map(p => ({
        label: p.name,
        description: p.snippet,
        detail: p.url,
      }))
    })())

    if (selected) {
      vscode.window.activeTextEditor.insertSnippet(
        new vscode.SnippetString(`${selected.detail} "${selected.label}"`),
      )
    }
  } catch (error) {
    vscode.window.showErrorMessage(String(error))
  }
}
