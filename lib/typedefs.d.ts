type SearchEngine = {
  minisearch: import('minisearch').default
  documentMap: Map<string, JournalDocument>
}

type JournalDocument = {
  id: string
  topic: boolean
  text: string
  links: string
  excerpt: string
  title: string
}
