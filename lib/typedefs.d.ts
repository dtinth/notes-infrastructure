type SearchEngine = {
  minisearch: import('minisearch').default
  documentMap: Map<string, JournalDocument>
  contentsMap: Map<string, string>
  redirectMap: Map<string, string>
}

type JournalDocument = {
  id: string
  topic: boolean
  text: string
  links: string
  aka: string
  excerpt: string
  title: string
  public: boolean
  names: string
}

type NoteSidebarItem = import('../vsce/src/NoteSidebarItem').NoteSidebarItem
