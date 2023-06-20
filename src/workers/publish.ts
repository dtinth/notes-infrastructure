import 'dotenv/config'
import tar, { ReadEntry } from 'tar'
import { PassThrough, Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createSearchEngine } from '../../lib/searchEngine'
import { indexDocumentIntoSearchEngine } from '../../lib/indexer'
import { App } from 'octokit'
import { Storage } from '@google-cloud/storage'
import { createHash } from 'crypto'
import pMap from 'p-map'
import { log, resolve } from '../../lib/workerLib'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { generatePublicIndex } from '../../lib/generatePublicIndex'
import * as Minio from 'minio'
import { createClient } from '@supabase/supabase-js'
import { GoogleAuth } from 'google-auth-library'

const bucket = new Storage().bucket('dtinth-notes.appspot.com')
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
  // const oldState = JSON.parse(
  //   (await bucket.file('notes/state.json').download())[0].toString()
  // )
  // const oldState: PublishingState = { files: {} }
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

  // {
  //   const id = 'HDRQRCode'
  //   const file = bucket.file(`notes/public/${id}.md`)
  //   await file.save(/** @type {Buffer} */ sourceMap.get(id))
  //   log('=> Uploaded: ' + id)
  //   return
  // }

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
    const response = await fetch(
      'https://notes.dt.in.th/api/revalidate?path=/' + id,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceAccountIdToken}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error(
        `Unable to revalidate ${id}: ${response.status} ${response.statusText}`
      )
    }
    const data = await response.json()
    if (!data.revalidated) {
      throw new Error(`Unable to revalidate ${id}: ${JSON.stringify(data)}`)
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
        const file = bucket.file(`notes/public/${id}.md`)
        await file.save(/** @type {Buffer} */ sourceMap.get(id))
        log('=> Uploaded (GCS): ' + id)
      }),
      ...Array.from(toDelete).map((id) => async () => {
        const file = bucket.file(`notes/public/${id}.md`)
        await file.delete()
        log('=> Deleted (GCS): ' + id)
      }),
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
    await bucket.file('notes/state.json').save(JSON.stringify(newState))
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

  const publicIndex = await generatePublicIndex({
    repo: {
      getDocument: async (id) => searchEngine.documentMap.get(id),
    },
    log,
  })

  log('Save search index')
  await uploadPublic('index.search.json', JSON.stringify(publicIndex.indexData))

  log('Save tree')
  await uploadPublic('index.tree.json', JSON.stringify(publicIndex.indexNode))

  log('Save sitemap')
  await uploadToSupabase(
    'index.txt',
    publicIndex.ids
      .map((id) => {
        return `https://notes.dt.in.th/${id}`
      })
      .join('\n')
  )
  await bucket.file('notes/public/index.txt').save(
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

async function uploadToGcs(name: string, contents: string) {
  return await bucket.file('notes/public/' + name).save(contents)
}
async function uploadToSupabase(name: string, contents: string) {
  const { data, error } = await supabase.storage
    .from('notes-public')
    .upload(name, Buffer.from(contents), { cacheControl: '60', upsert: true })
  if (error) throw error
}
async function uploadToOci(name: string, contents: string) {
  const minioClient = new Minio.Client({
    endPoint:
      'axioqr1tqh1r.compat.objectstorage.ap-singapore-1.oraclecloud.com',
    useSSL: true,
    accessKey: process.env.OCI_ACCESS_KEY_ID!,
    secretKey: process.env.OCI_SECRET_ACCESS_KEY!,
  })
  await minioClient.putObject('dtinth-notes', name, contents, {
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=300',
  })
}
async function uploadPublic(name: string, contents: string) {
  return Promise.all([
    uploadToGcs(name, contents),
    uploadToOci(name, contents),
    uploadToSupabase(name, contents),
  ])
}

/**
 * @param {string} audience
 */
async function getServiceAccountIdToken(audience: string) {
  const auth = new GoogleAuth()
  const client = await auth.getClient()
  if (!('fetchIdToken' in client)) throw new Error('No fetchIdToken')
  const token = await client.fetchIdToken(audience)
  return token
}
