exports.execute = async (args) => {
  const vscode = args.require('vscode')
  try {
    const id = vscode.window.activeTextEditor.document.fileName.split(/[/\\]/).pop().replace(/\.md$/, '')
    vscode.env.openExternal(
      vscode.Uri.parse('https://notes.dt.in.th/' + id)
    )
  } catch (error) {
    vscode.window.showErrorMessage(String(error))
  }
}
