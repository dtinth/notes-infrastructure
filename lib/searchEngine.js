// @ts-check
/** @type {typeof import('minisearch').default} */
// @ts-ignore
const MiniSearch = require('minisearch')
const stemmer = require('stemmer')
const stopwords = require('stopwords/english')
const englishStopwords = new Set(stopwords.english)
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
  fields: ['text', 'title', 'links'],
  storeFields: ['title', 'excerpt', 'topic'],
  searchOptions: {
    prefix: true,
    boost: { title: 2, link: 5 },
  },
}
module.exports = {
  create() {
    return new MiniSearch(options)
  },
  load(json) {
    return MiniSearch.loadJSON(json, options)
  },
}