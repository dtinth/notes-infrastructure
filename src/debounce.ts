/**
 * Runs `task` once things have been quiet for `delayMs`, never twice at the
 * same time. A trigger during a run schedules one more run after it.
 */
export function debounced(
  task: () => Promise<void>,
  delayMs: number,
  onError: (error: unknown) => void = console.error,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let pending = false

  const run = async () => {
    timer = undefined
    if (running) {
      pending = true
      return
    }
    running = task().catch(onError)
    await running
    running = undefined
    if (pending) {
      pending = false
      trigger()
    }
  }
  const trigger = () => {
    clearTimeout(timer)
    timer = setTimeout(run, delayMs)
  }
  /** Runs now (after any run in progress) instead of waiting. */
  const flush = async () => {
    clearTimeout(timer)
    await running
    await run()
    await running
  }
  return { trigger, flush }
}
