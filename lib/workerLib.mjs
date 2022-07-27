import { workerData, parentPort } from 'node:worker_threads'
export { workerData }
export function log(message) {
  parentPort?.postMessage({
    log: { level: 'INFO', message },
  })
}
export function resolve(value) {
  parentPort?.postMessage({
    resolve: { value },
  })
}
