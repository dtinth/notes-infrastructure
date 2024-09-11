import pMap from 'p-map'
import { appClient, headers } from '../src/appClient'
import { supabase } from '../src/supabase'
import { TaskArgs, Tasks } from '../src/Tasks'
import { unwrap } from '../src/unwrap'

const SITEGRAPH_PATH = 'notes.sitegraph.json'
const TREE_PATH = 'notes.tree.json'
const INDEX_PATH = 'notes.index.json'

class Publisher {
  async syncNoteContents({ log }: TaskArgs) {
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

    log(
      `to upload: ${notesToUpload.length}, to delete: ${notesToDelete.length}`
    )

    await pMap(
      notesToUpload,
      async (id) => {
        const sourceResponse = unwrap(
          await appClient.private.notes({ id }).get({ headers })
        )!
        const { note, source } = sourceResponse
        if (!note || !source) {
          log(`failed to fetch note: ${id}`)
          return
        }
        await supabase
          .from('notes_contents')
          .upsert({ id, source, source_version: note.version })
        log(`uploaded: ${id}`)
      },
      { concurrency: 4 }
    )
    await pMap(
      notesToDelete,
      async (id) => {
        await supabase.from('notes_contents').delete().eq('id', id)
        log(`deleted: ${id}`)
      },
      { concurrency: 4 }
    )
  }

  async syncSitegraph({ log }: TaskArgs) {
    const sitegraph = unwrap(await appClient.private.sitegraph.get({ headers }))
    await uploadToSupabasePublic(SITEGRAPH_PATH, JSON.stringify(sitegraph))
    log('synced sitegraph')
  }

  async syncTree({ log }: TaskArgs) {
    const tree = unwrap(await appClient.private.tree.get({ headers }))
    await uploadToSupabasePublic(TREE_PATH, JSON.stringify(tree))
    log('synced tree')
  }

  async syncIndex({ log }: TaskArgs) {
    const index = unwrap(await appClient.private.publicIndex.get({ headers }))
    await uploadToSupabasePublic(INDEX_PATH, JSON.stringify(index))
    log('synced index')
  }

  async syncSearchKeys({ log }: TaskArgs) {
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

    log(`to upload: ${keysToUpload.length}, to delete: ${keysToDelete.length}`)

    await pMap(
      keysToUpload,
      async (key) => {
        await supabase
          .from('notes_search_keys')
          .upsert({ search_key: key, note_id: localSearchKeys.get(key) })
        log(`uploaded: ${key}`)
      },
      { concurrency: 4 }
    )
    await pMap(
      keysToDelete,
      async (key) => {
        await supabase.from('notes_search_keys').delete().eq('search_key', key)
        log(`deleted: ${key}`)
      },
      { concurrency: 4 }
    )
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

await new Tasks()
  .add('note contents', (args) => publisher.syncNoteContents(args))
  .add('sitegraph', (args) => publisher.syncSitegraph(args))
  .add('tree', (args) => publisher.syncTree(args))
  .add('index', (args) => publisher.syncIndex(args))
  .add('search keys', (args) => publisher.syncSearchKeys(args))
  .run()
