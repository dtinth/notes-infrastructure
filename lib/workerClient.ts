import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { Worker } from 'node:worker_threads'

interface LogEntry {
  level: 'DEBUG'
  message: string
}

const defaultCreateLog = (id: string) => (entry: LogEntry) => {
  console.log(
    `[${new Date().toJSON()}] [${id}] [${entry.level}] ${entry.message}`
  )
}

export const createFileLog = (name: string) => {
  const filename = `.data/logs/${name}.log`
  mkdirSync('.data/logs', { recursive: true })
  writeFileSync(filename, '')
  return (id: string) => {
    const write = (message: string) => {
      appendFileSync(filename, `[${new Date().toJSON()}] ${message}\n`)
    }
    write(`Start worker id: ${id}`)
    return (entry: LogEntry) => {
      write(`[${entry.level}] ${entry.message}`)
    }
  }
}

export function runWorker(
  filename: string,
  data: any,
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
