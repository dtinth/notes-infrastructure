import { Listr, ListrTask } from 'listr2'

export interface TaskArgs {
  log: (text: string) => void
}

export class Tasks {
  private tasks: ListrTask[] = []
  private concurrent: boolean
  constructor(options: { concurrent?: boolean } = {}) {
    this.concurrent = options.concurrent ?? true
  }
  add<T>(text: string, f: (args: TaskArgs) => Promise<T>) {
    this.tasks.push({
      title: text,
      task: (_ctx, task) =>
        f({
          log: (text) => (task.output = text),
        }),
    })
    return this
  }
  addTasks(text: string, tasks: Tasks) {
    this.tasks.push({
      title: text,
      task: () => tasks.toListr(),
    })
    return this
  }
  run() {
    return this.toListr().run()
  }
  private toListr() {
    return new Listr(this.tasks, { concurrent: this.concurrent })
  }
}
