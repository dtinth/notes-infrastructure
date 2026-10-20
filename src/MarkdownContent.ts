import { toText } from 'hast-util-to-text'
import memoizeOne from 'memoize-one'
import { micromark } from 'micromark'
import { gfmFootnote, gfmFootnoteHtml } from 'micromark-extension-gfm-footnote'
import {
  gfmStrikethrough,
  gfmStrikethroughHtml,
} from 'micromark-extension-gfm-strikethrough'
import { gfmTable, gfmTableHtml } from 'micromark-extension-gfm-table'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export class MarkdownContent {
  constructor(public source: string) {}

  private getHtml = memoizeOne(() => {
    return micromark(this.source, {
      allowDangerousHtml: true,
      extensions: [
        gfmFootnote(),
        gfmStrikethrough({ singleTilde: true }),
        gfmTable(),
      ],
      htmlExtensions: [
        gfmFootnoteHtml(),
        gfmStrikethroughHtml(),
        gfmTableHtml(),
      ],
    })
  })

  private getHast = memoizeOne(() => {
    return unified().use(rehypeParse, { fragment: true }).parse(this.getHtml())
  })

  private getLinks = memoizeOne(() => {
    const links: string[] = []
    visit(this.getHast(), (node) => {
      const href = node.type === 'element' && node.properties?.href
      if (typeof href === 'string') {
        links.push(href)
      }
    })
    return links
  })

  private getText = memoizeOne(() => {
    return toText(this.getHast())
  })

  get links(): string[] {
    return this.getLinks()
  }

  get text(): string {
    return this.getText()
  }
}
