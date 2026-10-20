import { watch } from 'chokidar'
import { closeSync, constants, lstatSync, openSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { isValidNoteId, parseNote, readNoteFile, readVault, type VaultNote } from './vault'

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
    const source = isValidNoteId(id) ? readNoteFile(this.pathOf(id)) : undefined
    if (source !== undefined) {
      this.notes.set(id, parseNote(id, source))
    } else {
      this.notes.delete(id)
    }
    for (const listener of this.listeners) listener()
  }

  /** Saves a note's source, as the backoffice editor does. */
  write(id: string, source: string) {
    // O_NOFOLLOW: never write through a symlink to outside the vault.
    const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = constants
    const fd = openSync(this.pathOf(id), O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0o666)
    try {
      writeFileSync(fd, source)
    } finally {
      closeSync(fd)
    }
    this.refresh(id)
  }

  /** The note file's mtime in ms, or 0 if it's gone. */
  mtimeOf(id: string) {
    return lstatSync(this.pathOf(id), { throwIfNoEntry: false })?.mtimeMs ?? 0
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
