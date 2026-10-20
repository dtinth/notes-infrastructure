import MiniSearch, { type Options } from 'minisearch'
import { stemmer } from 'stemmer'
import stopwords from 'stopwords/english'
import type { PublicTree } from './tree'
import type { VaultNote } from './vault'

const englishStopwords = new Set<string>(stopwords.english)
englishStopwords.delete('vs')
englishStopwords.delete('recent')

/** Must match the options the frontend loads the index with. */
export const searchEngineOptions: Options = {
  idField: 'id',
  tokenize: (string) => string.match(/\w+/g) || [],
  processTerm: (term) => {
    if (term.length > 32) return null
    return englishStopwords.has(term) ? null : stemmer(term)
  },
  fields: ['text', 'title', 'links', 'aka', 'names'],
  storeFields: ['title', 'excerpt', 'topic', 'aka'],
  searchOptions: {
    prefix: true,
    boost: { title: 3, link: 5, aka: 2 },
  },
}

/** The search index of listed notes, as served at api/index.json. */
export function generateSearchIndex(
  notes: Map<string, VaultNote>,
  tree: PublicTree,
) {
  const searchEngine = new MiniSearch(searchEngineOptions)
  for (const id of Object.keys(tree.nodes)) {
    const note = notes.get(id)
    if (note) searchEngine.add(note)
  }
  return searchEngine.toJSON()
}

/** Maps each lowercased slug and alias of a public note to its id. */
export function generateSearchKeys(notes: Iterable<VaultNote>) {
  const searchKeys = new Map<string, string>()
  for (const note of notes) {
    if (!note.public) continue
    for (const name of note.names.split(' ')) {
      searchKeys.set(name.toLowerCase(), note.id)
    }
  }
  return searchKeys
}

