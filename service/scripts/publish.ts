import pMap from 'p-map'
import { appClient, headers } from '../src/appClient'
import { compileNote } from '../src/generateHtml'
import { supabase } from '../src/supabase'
import { unwrap } from '../src/unwrap'

const SITEGRAPH_PATH = 'notes.sitegraph.json'
const TREE_PATH = 'notes.tree.json'
const INDEX_PATH = 'notes.index.json'

class Publisher {
  async syncNoteContents() {
    await appClient.private.refresh.post({}, { headers })
    const { notes } = unwrap(await appClient.private.public.get({ headers }))!

    const localNotes = new Map(Object.entries(notes))
    const remoteNotes = new Map(
      unwrap(
        await supabase.from('notes_contents').select('id, source_version')
      )!.map((note): [string, string] => [note.id, note.source_version])
    )

    const notesToUpload: string[] = []
    const notesToDelete: string[] = []
    for (const [id, version] of localNotes) {
      if (remoteNotes.get(id) !== version) {
        notesToUpload.push(id)
      }
    }
    for (const [id] of remoteNotes) {
      if (!localNotes.has(id)) {
        notesToDelete.push(id)
      }
    }

    console.log('Notes to upload:', notesToUpload.length)
    console.log('Notes to delete:', notesToDelete.length)

    await pMap(
      notesToUpload,
      async (id) => {
        const sourceResponse = unwrap(
          await appClient.private.notes({ id }).get({ headers })
        )!
        const { note, source } = sourceResponse
        if (!note || !source) {
          console.error('Failed to fetch note:', id)
          return
        }
        await supabase
          .from('notes_contents')
          .upsert({ id, source, source_version: note.version })
        console.log('Uploaded:', id)
      },
      { concurrency: 4 }
    )
    await pMap(
      notesToDelete,
      async (id) => {
        await supabase.from('notes_contents').delete().eq('id', id)
        console.log('Deleted:', id)
      },
      { concurrency: 4 }
    )

    console.log('Syncing sitegraph...')
    const sitegraph = unwrap(await appClient.private.sitegraph.get({ headers }))
    await uploadToSupabasePublic(SITEGRAPH_PATH, JSON.stringify(sitegraph))

    console.log('Syncing tree...')
    const tree = unwrap(await appClient.private.tree.get({ headers }))
    await uploadToSupabasePublic(TREE_PATH, JSON.stringify(tree))

    console.log('Syncing index...')
    const index = unwrap(await appClient.private.publicIndex.get({ headers }))
    await uploadToSupabasePublic(INDEX_PATH, JSON.stringify(index))
  }

  async syncSearchKeys() {
    const { searchKeys } = unwrap(
      await appClient.private.searchKeys.get({ headers })
    )!
    const localSearchKeys = new Map(Object.entries(searchKeys))
    const remoteSearchKeys = new Map(
      unwrap(
        await supabase.from('notes_search_keys').select('search_key, note_id')
      )!.map((key): [string, string] => [key.search_key, key.note_id])
    )

    const keysToUpload: string[] = []
    const keysToDelete: string[] = []

    for (const [key, id] of localSearchKeys) {
      if (remoteSearchKeys.get(key) !== id) {
        keysToUpload.push(key)
      }
    }
    for (const [key] of remoteSearchKeys) {
      if (!localSearchKeys.has(key)) {
        keysToDelete.push(key)
      }
    }

    console.log('Search keys to upload:', keysToUpload.length)
    console.log('Search keys to delete:', keysToDelete.length)

    await pMap(
      keysToUpload,
      async (key) => {
        await supabase
          .from('notes_search_keys')
          .upsert({ search_key: key, note_id: localSearchKeys.get(key) })
        console.log('Uploaded:', key)
      },
      { concurrency: 4 }
    )
    await pMap(
      keysToDelete,
      async (key) => {
        await supabase.from('notes_search_keys').delete().eq('search_key', key)
        console.log('Deleted:', key)
      },
      { concurrency: 4 }
    )
  }

  compilerVersion = '2'

  async findNotesToCompile() {
    const info = unwrap(
      await supabase
        .from('notes_contents')
        .select(
          'id, source_version, compiled_source_version, compiled_compiler_version'
        )
    )!
    const toCompile: string[] = []
    for (const row of info) {
      if (
        row.compiled_compiler_version !== this.compilerVersion ||
        row.source_version !== row.compiled_source_version
      ) {
        toCompile.push(row.id)
      }
    }
    return toCompile
  }

  async compileNote(id: string) {
    const { source, source_version } = unwrap(
      await supabase
        .from('notes_contents')
        .select('source, source_version')
        .eq('id', id)
    )![0]
    const compileResult = await compileNote(source, id)
    unwrap(
      await supabase
        .from('notes_contents')
        .update({
          compiled: JSON.stringify(compileResult.result.compiled),
          compiled_source_version: source_version,
          compiled_compiler_version: this.compilerVersion,
        })
        .eq('id', id)
    )
  }

  async compileAllNotes() {
    const notesToCompile = await this.findNotesToCompile()
    console.log('Notes to compile:', notesToCompile.length)
    await pMap(notesToCompile, (id) => this.compileNote(id), { concurrency: 4 })
  }
}

async function uploadToSupabasePublic(name: string, contents: string) {
  unwrap(
    await supabase.storage
      .from('notes-public')
      .upload(name, Buffer.from(contents), {
        cacheControl: '60',
        upsert: true,
        contentType: 'application/json',
      })
  )
}

const publisher = new Publisher()

await publisher.syncNoteContents()
await publisher.syncSearchKeys()
await publisher.compileAllNotes()
