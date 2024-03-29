import 'dotenv/config'
import tar, { ReadEntry } from 'tar'
import { PassThrough, Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createSearchEngine } from '../../lib/searchEngine'
import { indexDocumentIntoSearchEngine } from '../../lib/indexer'
import { App } from 'octokit'
import { createHash } from 'crypto'
import pMap from 'p-map'
import { log, resolve } from '../../lib/workerLib'
import { readFileSync } from 'fs'
import { basename } from 'path'
import {
  DocumentRepository,
  generatePublicIndex,
} from '../../lib/generatePublicIndex'
import { createClient } from '@supabase/supabase-js'
import { GoogleAuth } from 'google-auth-library'
import axios from 'axios'
import { generateSitegraph } from '../../lib/generateSitegraph'

const supabase = createClient(
  'https://htrqhjrmmqrqaccchyne.supabase.co',
  process.env.SUPABASE_API_KEY!
)

type TarFilter = (path: string, entry: ReadEntry) => boolean

async function* readTar(input: Readable, filter: TarFilter) {
  const entryStream = new PassThrough({ objectMode: true })
  const pipelinePromise = pipeline(
    input,
    new tar.Parse({
      filter,
      onentry: async (entry) => {
        entryStream.write(entry)
      },
    })
  ).then(() => {
    entryStream.end()
  })
  for await (const entry of entryStream) {
    const buffers: Buffer[] = []
    for await (const data of entry) {
      buffers.push(data)
    }
    const content = Buffer.concat(buffers)
    yield { entry, content }
  }
  await pipelinePromise
}

async function loadTar() {
  const app = new App({
    appId: 83405,
    privateKey: readFileSync(
      process.env.GITHUB_APPLICATION_CREDENTIALS || '',
      'utf8'
    ),
  })
  const octokit = await app.getInstallationOctokit(12187926)
  const owner = String(process.env.VAULT_OWNER)
  const repo = String(process.env.VAULT_REPO)
  const result = await octokit.rest.repos.downloadTarballArchive({
    owner,
    repo,
    ref: 'main',
  })
  const ab = result.data as ArrayBuffer
  log(`Downloaded tarball archive of size ${ab.byteLength}`)
  return ab
}

async function loadPublicNotes() {
  const tarball = new PassThrough()
  tarball.end(Buffer.from(await loadTar()))

  /** @type {Map<string, Buffer>} */
  const sourceMap = new Map()
  const searchEngine = createSearchEngine()

  let header = 'Indexing documents'
  let written = header.length
  process.stdout.write(header)

  const filter = (path, entry) => {
    const name = basename(entry.path)
    return entry.type === 'File' && !!name.match(/^[^/]+\.md$/)
  }

  for await (const item of readTar(tarball, filter)) {
    const source = item.content.toString()
    const path = basename(item.entry.path)
    const id = indexDocumentIntoSearchEngine(searchEngine, path, source, {
      publicOnly: true,
    })
    if (id) {
      sourceMap.set(id, item.content)
      process.stdout.write('.')
    } else {
      process.stdout.write('_')
    }
    written++
    if (written >= 72) {
      process.stdout.write('\n')
      written = 0
    }
  }
  if (written > 0) {
    process.stdout.write('\n')
  }

  return { searchEngine, sourceMap }
}

async function loadState() {
  const { data, error } = await supabase.storage
    .from('notes-private')
    .download('state.json')
  if (error) throw error
  const oldState = JSON.parse(await data.text())
  if (!oldState.files) {
    oldState.files = {}
  }
  return /** @type {PublishingState} */ oldState
}

async function main() {
  const { searchEngine, sourceMap } = await loadPublicNotes()
  const oldState = await loadState()
  const newState = JSON.parse(JSON.stringify(oldState))

  const hashMap = new Map<string, string>()
  const toUpload = new Set<string>()
  const toDelete = new Set<string>()
  for (const [from, to] of searchEngine.redirectMap) {
    if (!sourceMap.has(from)) {
      sourceMap.set(from, generateRedirect(to))
    }
  }

  const serviceAccountIdToken = await getServiceAccountIdToken(
    'https://notes.dt.in.th'
  )
  const revalidate = async (id: string) => {
    const response = await axios.post(
      'https://notes.dt.in.th/api/revalidate?path=/' + id,
      {},
      { headers: { Authorization: `Bearer ${serviceAccountIdToken}` } }
    )
    if (!response.data.revalidated) {
      throw new Error(
        `Unable to revalidate ${id}: ${JSON.stringify(response.data)}`
      )
    }
    log('=> Revalidated: ' + id)
  }

  // Generate redirects from lowercased paths to the original paths
  {
    const ids = Array.from(sourceMap.keys())
    for (const id of ids) {
      const lowercased = id.toLowerCase()
      if (lowercased !== id && !sourceMap.has(lowercased)) {
        sourceMap.set(lowercased, generateRedirect(id))
      }
    }
  }
  for (const [id, source] of sourceMap) {
    const hash = createHash('sha1').update(source).digest('hex')
    hashMap.set(id, hash)
    if (oldState.files[id] !== hash) {
      toUpload.add(id)
      newState.files[id] = hash
    }
  }
  for (const id of Object.keys(oldState.files)) {
    if (!sourceMap.has(id)) {
      toDelete.add(id)
      delete newState.files[id]
    }
  }
  log('=> Number of files to upload: ' + toUpload.size)
  log('=> Number of files to delete: ' + toDelete.size)

  await pMap(
    [
      ...Array.from(toUpload).map((id) => async () => {
        const { data, error } = await supabase
          .from('notes')
          .upsert({ id, contents: sourceMap.get(id).toString() })
        if (error) throw new Error(JSON.stringify(error))
        log('=> Uploaded (Supabase): ' + id)
        await revalidate(id)
      }),
      ...Array.from(toDelete).map((id) => async () => {
        const { data, error } = await supabase
          .from('notes')
          .delete()
          .match({ id })
        if (error) throw new Error(JSON.stringify(error))
        log('=> Deleted (Supabase): ' + id)
      }),
    ],
    (f) => f(),
    { concurrency: 16 }
  )

  if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
    await supabase.storage
      .from('notes-private')
      .upload('state.json', Buffer.from(JSON.stringify(newState)), {
        cacheControl: '1',
        upsert: true,
      })
    log('=> Updated state')
  } else {
    log('=> No changes')
  }

  const repo: DocumentRepository = {
    getDocument: async (id) => searchEngine.documentMap.get(id),
  }
  const publicIndex = await generatePublicIndex({ repo, log })
  const sitegraph = await generateSitegraph({ publicIndex, repo })

  log('Save search index')
  await uploadToSupabasePublic(
    'index.search.json',
    JSON.stringify(publicIndex.indexData)
  )

  log('Save tree')
  await uploadToSupabasePublic(
    'index.tree.json',
    JSON.stringify(publicIndex.indexNode)
  )

  log('Save graph')
  await uploadToSupabasePublic('index.graph.json', JSON.stringify(sitegraph))

  log('Save sitemap')
  await uploadToSupabasePublic(
    'index.txt',
    publicIndex.ids
      .map((id) => {
        return `https://notes.dt.in.th/${id}`
      })
      .join('\n')
  )
  resolve('ok')
}

main()
function generateRedirect(to: string): any {
  return Buffer.from(
    [
      '---',
      'public: true',
      'redirect_to: ' + JSON.stringify(to),
      '---',
      `Redirect to [${to}](${to})`,
    ].join('\n')
  )
}

async function uploadToSupabasePublic(name: string, contents: string) {
  const { data, error } = await supabase.storage
    .from('notes-public')
    .upload(name, Buffer.from(contents), { cacheControl: '60', upsert: true })
  if (error) throw error
}

async function getServiceAccountIdToken(audience: string) {
  const auth = new GoogleAuth()
  const client = await auth.getClient()
  if (!('fetchIdToken' in client)) throw new Error('No fetchIdToken')
  const token = await client.fetchIdToken(audience)
  return token
}
