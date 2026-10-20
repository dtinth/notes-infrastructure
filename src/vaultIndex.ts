import { watch } from 'chokidar'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { parseNote, readVault, type VaultNote } from './vault'

/** Note ids are plain file names: no path separators, no leading dot. */
export function isValidNoteId(id: string) {
  return /^[^/\\\0]+$/.test(id) && !id.startsWith('.')
}

/** The vault, indexed in memory and kept fresh as files change. */
export class VaultIndex {
  notes: Map<string, VaultNote>
  private listeners = new Set<() => void>()

  constructor(public readonly dir: string) {
    this.notes = readVault(dir)
  }

  /** Watches the vault directory; returns a function that stops watching. */
  watch() {
    const watcher = watch(this.dir, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    })
    const refresh = (path: string) => {
      if (extname(path) === '.md') this.refresh(basename(path, '.md'))
    }
    watcher.on('add', refresh).on('change', refresh).on('unlink', refresh)
    return () => watcher.close()
  }

  /** Re-reads one note from disk, removing it if the file is gone. */
  refresh(id: string) {
    const path = this.pathOf(id)
    if (existsSync(path)) {
      this.notes.set(id, parseNote(id, readFileSync(path, 'utf-8')))
    } else {
      this.notes.delete(id)
    }
    for (const listener of this.listeners) listener()
  }

  /** Saves a note's source, as the backoffice editor does. */
  write(id: string, source: string) {
    writeFileSync(this.pathOf(id), source)
    this.refresh(id)
  }

  onChange(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private pathOf(id: string) {
    if (!isValidNoteId(id)) {
      throw new Error(`Invalid note id: ${id}`)
    }
    return join(this.dir, `${id}.md`)
  }
}
