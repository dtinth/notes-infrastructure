import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { Worker } from 'node:worker_threads'

const defaultCreateLog = (id) => (entry) => {
  console.log(
    `[${new Date().toJSON()}] [${id}] [${entry.level}] ${entry.message}`
  )
}

export const createFileLog = (name) => {
  const filename = `.data/logs/${name}.log`
  mkdirSync('.data/logs', { recursive: true })
  writeFileSync(filename, '')
  return (id) => {
    const write = (message) => {
      appendFileSync(filename, `[${new Date().toJSON()}] ${message}\n`)
    }
    write(`Start worker id: ${id}`)
    return (entry) => {
      write(`[${entry.level}] ${entry.message}`)
    }
  }
}

export function runWorker(
  filename,
  data,
  { createLog = defaultCreateLog } = {}
) {
  const id = randomUUID()
  const log = createLog(id)
  const resultPromise = (() => {
    const worker = new Worker(filename, { workerData: { data, id } })
    return new Promise((resolve, reject) => {
      worker.on('message', (msg) => {
        if (msg.log) {
          log(msg.log)
        } else if (msg.resolve) {
          resolve(msg.resolve.value)
        }
      })
      worker.on('error', reject)
      worker.on('exit', (code) => {
        log({ level: 'DEBUG', message: `worker exited with code ${code}` })
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`))
        }
        resolve(undefined)
      })
    })
  })()
  return { resultPromise }
}
