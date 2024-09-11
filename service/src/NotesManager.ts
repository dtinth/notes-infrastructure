import DataLoader from 'dataloader'
import pLimit from 'p-limit'
import { indexNote, unindexNote } from '../src/indexNote'
import { NotesDatabase } from './NotesDatabase'
import { NotesSource } from './NotesSource'

export class NotesManager {
  db = new NotesDatabase()
  constructor(public source: NotesSource) {}

  private log(message: string) {
    console.log(message)
  }

  private mutex = pLimit(1)
  private indexUpdater = new DataLoader(
    async (timestamps: readonly number[]) => {
      await this.mutex(() => this.doUpdateIndex())
      return timestamps
    },
    { batchScheduleFn: (callback) => setTimeout(callback, 100) },
  )

  private async doUpdateIndex() {
    const extraNotes = new Set<string>(this.db.identitySet)
    this.log('Starting indexing...')
    let added = 0
    let changed = 0
    let removed = 0
    for await (const slug of this.source.scan()) {
      const existedBefore = this.db.identitySet.has(slug)
      const content = await this.source.read(slug)
      const indexed = indexNote(this.db, slug, content)
      extraNotes.delete(slug)
      if (indexed) {
        if (existedBefore) {
          changed++
        } else {
          added++
        }
      }
    }
    for (const slug of extraNotes) {
      unindexNote(this.db, slug)
      removed++
    }
    this.log(
      `Indexing done. Added: ${added}, Changed: ${changed}, Removed: ${removed}`,
    )
  }

  async indexAll() {
    return this.indexUpdater.load(Date.now())
  }

  async index(id: string) {
    await this.mutex(async () => {
      const content = await this.source.read(id)
      indexNote(this.db, id, content)
    })
  }
}
