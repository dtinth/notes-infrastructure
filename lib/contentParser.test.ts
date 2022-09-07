import test from 'node:test'
import assert from 'assert'
import { MarkdownContent } from './contentParser'

test('parses inline links', async () => {
  const md = new MarkdownContent('[meow](nyan) [ok](https://www.google.com/)')
  assert.deepEqual(md.links, ['nyan', 'https://www.google.com/'])
})

test('parses external links', async () => {
  const md = new MarkdownContent('[meow]\n\n[meow]: nyaa')
  assert.deepEqual(md.links, ['nyaa'])
})
