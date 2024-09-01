import MiniSearch, { Options } from 'minisearch'
import { stemmer } from 'stemmer'
import stopwords from 'stopwords/english'
import { IdentitySet } from './IdentitySet'
import { Note } from './Note'

type NoteSidebarItem = import('../../vsce/src/NoteSidebarItem').NoteSidebarItem

const englishStopwords = new Set(stopwords.english)
englishStopwords.delete('vs')
englishStopwords.delete('recent')

export const searchEngineOptions: Options = {
  idField: 'id',
  tokenize: (string, fieldName) => {
    try {
      return string.match(/\w+/g) || []
    } catch (error) {
      console.error('Cannot tokenize %s', fieldName, error)
      return []
    }
  },
  processTerm: (term, _fieldName) => {
    const stem = stemmer(term)
    const termIsStopword = englishStopwords.has(term)
    if (term.length > 32) return null
    return termIsStopword ? null : stem
  },
  fields: ['text', 'title', 'links', 'aka', 'names'],
  storeFields: ['title', 'excerpt', 'topic', 'aka'],
  searchOptions: {
    prefix: true,
    boost: { title: 3, link: 5, aka: 2 },
  },
}

export class NotesDatabase {
  minisearch = new MiniSearch(searchEngineOptions)
  documentMap = new Map<string, Note>()
  contentsMap = new Map<string, string>()
  identitySet = new IdentitySet()
}
