import 'dotenv/config.js'
import tar from 'tar'
import { PassThrough, Readable } from 'stream'
import { pipeline } from 'stream/promises'
import searchEngineFactory from '../../lib/searchEngine.js'
import { indexDocumentIntoSearchEngine } from '../../lib/indexer.js'
import { App } from 'octokit'
import { spawn, spawnSync } from 'child_process'
import { Storage } from '@google-cloud/storage'
import { createHash } from 'crypto'
import pMap from 'p-map'
import { log, resolve } from '../../lib/workerLib.mjs'
import { readFileSync } from 'fs'
import { basename } from 'path'

const bucket = new Storage().bucket('dtinth-notes.appspot.com')

async function* readTar(input, filter) {
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
    const buffers = []
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
  const ab = /** @type {ArrayBuffer} */ (result.data)
  log(`Downloaded tarball archive of size ${ab.byteLength}`)
  return ab
}

async function loadPublicNotes() {
  // spawnSync('cd data && git fetch origin main', {
  //   shell: true,
  //   stdio: 'inherit',
  // })
  // const data = spawn('cd data && git archive origin/main', {
  //   shell: true,
  //   stdio: ['ignore', 'pipe', 'inherit'],
  // })
  // const tarball = data.stdout

  const tarball = new PassThrough()
  tarball.end(Buffer.from(await loadTar()))

  /** @type {Map<string, Buffer>} */
  const sourceMap = new Map()
  const searchEngine = searchEngineFactory.create()

  let header = 'Indexing documents'
  let written = header.length
  process.stdout.write(header)

  const filter = (path, entry) => {
    const name = basename(entry.path)
    return entry.type === 'File' && name.match(/^[^/]+\.md$/)
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
  const oldState = JSON.parse(
    (await bucket.file('notes/state.json').download())[0].toString()
  )
  if (!oldState.files) {
    oldState.files = {}
  }
  return /** @type {PublishingState} */ (oldState)
}

async function main() {
  const oldState = await loadState()
  const newState = JSON.parse(JSON.stringify(oldState))
  const { searchEngine, sourceMap } = await loadPublicNotes()

  /** @type {Map<string, string>} */
  const hashMap = new Map()
  const toUpload = new Set()
  const toDelete = new Set()
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
        await file.save(/** @type {Buffer} */ (sourceMap.get(id)))
        log('=> Uploaded: ' + id)
      }),
      ...Array.from(toDelete).map((id) => async () => {
        const file = bucket.file(`notes/public/${id}.md`)
        await file.delete()
        log('=> Deleted: ' + id)
      }),
    ],
    (f) => f(),
    { concurrency: 16 }
  )
  if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
    await bucket.file('notes/state.json').save(JSON.stringify(newState))
    log('=> Updated state')
  } else {
    log('=> No changes')
  }
  resolve('ok')
}

main()
