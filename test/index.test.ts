import { describe, expect, test } from 'bun:test'
import { generateSearchKeys } from '../src/search'
import { generateSitegraph } from '../src/sitegraph'
import { generatePublicTree } from '../src/tree'
import { parseNote, readVault } from '../src/vault'

const notes = readVault(`${import.meta.dir}/../example-vault`)

describe('parseNote', () => {
  test('takes the title from the first sentence when there is none', () => {
    const note = parseNote('X', 'Hello world. More text here.')
    expect(note.title).toBe('Hello world')
    // Legacy quirk, kept because the search index depends on it.
    expect(note.text).toBe('. More text here.')
  })

  test('marks topic titles and collects aliases and internal links', () => {
    const note = notes.get('JavaScript')!
    expect(note.title).toBe('JavaScript (topic)')
    expect(note.names).toBe('JavaScript js')
    expect(note.links).toBe('Article')
  })

  test('ignores external links', () => {
    const note = parseNote('X', '[a](https://example.com) [b](Other)')
    expect(note.links).toBe('Other')
  })
})

describe('generatePublicTree', () => {
  const tree = generatePublicTree(notes)

  test('includes public notes reachable from HomePage', () => {
    expect(Object.keys(tree.nodes)).toEqual(['Article', 'HomePage', 'JavaScript'])
    expect(tree.nodes.Article.parent).toBe('JavaScript')
  })

  test('leaves out unlisted and private notes', () => {
    expect(tree.nodes.Hidden).toBeUndefined()
    expect(tree.nodes.Draft).toBeUndefined()
  })
})

test('generateSitegraph lists each listed note with its links', () => {
  const sitegraph = generateSitegraph(notes, generatePublicTree(notes))
  expect(sitegraph.nodes.HomePage.links).toEqual([
    { link: 'JavaScript' },
    { link: 'Draft' },
  ])
})

test('generateSearchKeys maps lowercased names of public notes', () => {
  const keys = generateSearchKeys(notes.values())
  expect(keys.get('js')).toBe('JavaScript')
  expect(keys.get('hidden')).toBe('Hidden')
  expect(keys.has('draft')).toBe(false)
})
