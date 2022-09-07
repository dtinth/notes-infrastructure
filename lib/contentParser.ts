import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token'

const parser = new MarkdownIt({ html: true })

export class MarkdownContent {
  tokens: Token[]

  constructor(public content: string) {
    this.tokens = parser.parse(content, {})
  }

  get links(): string[] {
    const links: string[] = []
    for (const token of this.tokens) {
      if (token.type === 'inline') {
        for (const child of token.children || []) {
          if (child.type === 'link_open') {
            links.push(child.attrGet('href') || '')
          }
        }
      }
    }
    return links
  }
}
