import MiniSearch from 'minisearch'
import { searchEngineOptions } from './search'
import type { VaultNote } from './vault'

export interface NoteSearchResult {
  id: string
  title: string
  excerpt: string
  public: boolean
  /** The query matched one of its links: it links to the note searched for. */
  linksHere: boolean
}

/**
 * Searches every note in the vault, private ones too, for the backoffice's
 * Cmd+K (as legacy's `/search` did for the VS Code extension). The index is
 * rebuilt on the first search after the vault changes.
 */
export class NoteSearch {
  private engine?: MiniSearch<VaultNote>

  constructor(private notes: Map<string, VaultNote>) {}

  invalidate() {
    this.engine = undefined
  }

  search(query: string, limit = 50): NoteSearchResult[] {
    if (!this.engine) {
      this.engine = new MiniSearch<VaultNote>(searchEngineOptions)
      this.engine.addAll([...this.notes.values()])
    }
    return this.engine
      .search(query)
      .slice(0, limit)
      .map((result) => {
        const note = this.notes.get(result.id)!
        return {
          id: note.id,
          title: note.title,
          excerpt: note.excerpt,
          public: note.public,
          linksHere: Object.values(result.match).some((fields) => fields.includes('links')),
        }
      })
  }
}
