/** @type {typeof import('minisearch').default} */
// @ts-ignore
const MiniSearch = require('minisearch')
const stemmer = require('stemmer')
const stopwords = require('stopwords/english')
const englishStopwords = new Set(stopwords.english)
englishStopwords.delete('vs')

const options = {
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
  fields: ['text', 'title', 'links', 'aka'],
  storeFields: ['title', 'excerpt', 'topic', 'aka'],
  searchOptions: {
    prefix: true,
    boost: { title: 3, link: 5, aka: 2 },
  },
}
module.exports = {
  /**
   * @returns {SearchEngine}
   */
  create() {
    return {
      minisearch: new MiniSearch(options),
      documentMap: new Map(),
    }
  },
}
