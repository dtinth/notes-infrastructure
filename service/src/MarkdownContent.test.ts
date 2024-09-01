import { expect, test } from 'bun:test'
import { MarkdownContent } from './MarkdownContent'

test('parses inline links', async () => {
  const md = new MarkdownContent('[meow](nyan) [ok](https://www.google.com/)')
  expect(md.links).toEqual(['nyan', 'https://www.google.com/'])
})

test('parses external links', async () => {
  const md = new MarkdownContent('[yay][meow]\n\n[meow]: nyaa')
  expect(md.links).toEqual(['nyaa'])
})

test('returns text', async () => {
  const md = new MarkdownContent('# hello world\n\n**[this](that)** was a link')
  expect(md.text).toEqual('hello world\n\nthis was a link')
})
