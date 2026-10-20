import { expect, test } from 'bun:test'
import matter from 'gray-matter'
import { addRevision, makePublic } from '../backoffice/src/frontmatter'

const note = `---
title: Caddy
aliases:
  - caddy
created: 2020-11-21
updates:
  - date: 2025-12-22
    description: Updated for Dokploy.

facebook: https://example.com
---

# Caddy
`

test('makePublic sets public and keeps an existing created date', () => {
  const result = makePublic(note, '2026-10-21')
  expect(result).toStartWith('---\npublic: true\ntitle: Caddy\n')
  expect(result).toEndWith('---\n\n# Caddy\n')
  expect(matter(result).data.public).toBe(true)
  expect(result).toContain('created: 2020-11-21')
  expect(result).not.toContain('2026-10-21')
})

test('makePublic flips public: false and adds created', () => {
  const result = makePublic('---\npublic: false\n---\nHello', '2026-10-21')
  expect(result).toBe('---\npublic: true\ncreated: 2026-10-21\n---\nHello')
})

test('makePublic adds front matter to a note without it', () => {
  expect(makePublic('# Hi\n', '2026-10-21')).toBe('---\npublic: true\ncreated: 2026-10-21\n---\n# Hi\n')
})

test('addRevision appends to updates, right after its last entry', () => {
  const result = addRevision(note, 'Fixed: the "port" part', '2026-10-21')
  expect(result).toContain(
    '    description: Updated for Dokploy.\n  - date: 2026-10-21\n    description: "Fixed: the \\"port\\" part"\n\nfacebook:',
  )
  const { data } = matter(result)
  expect(data.updates).toHaveLength(2)
  expect(data.updates[1].description).toBe('Fixed: the "port" part')
  expect(data.facebook).toBe('https://example.com')
})

test('addRevision starts updates when there are none', () => {
  expect(addRevision('---\ntitle: X\n---\n', 'First', '2026-10-21')).toBe(
    '---\ntitle: X\nupdates:\n  - date: 2026-10-21\n    description: First\n---\n',
  )
})
