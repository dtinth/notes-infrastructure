const jsonwebtoken = require('jsonwebtoken')
const secrets = require('../secrets')

exports.execute = async (args) => {
  const vscode = args.require('vscode')
  try {
    const id = vscode.window.activeTextEditor.document.fileName
      .split(/[/\\]/)
      .pop()
      .replace(/\.md$/, '')
    const jwt = jsonwebtoken.sign({ id }, secrets.previewSigningSecret, {
      algorithm: 'HS256',
      expiresIn: 86400,
    })
    vscode.env.openExternal(
      vscode.Uri.parse('https://notes.dt.in.th/preview-' + jwt)
    )
  } catch (error) {
    vscode.window.showErrorMessage(String(error))
  }
}
