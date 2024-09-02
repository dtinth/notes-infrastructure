import fs from 'fs'
import path from 'path'

export interface NotesSource {
  scan(): AsyncGenerator<string>
  read(filePath: string): Promise<string>
}

export class NotesFileSystemSource implements NotesSource {
  constructor(private basePath = '../data') {}

  async *scan() {
    for (const filePath of fs.readdirSync(this.basePath)) {
      if (path.extname(filePath) !== '.md') continue
      yield path.basename(filePath, '.md')
    }
  }

  async read(slug: string) {
    return fs.readFileSync(`${this.basePath}/${slug}.md`, 'utf-8')
  }
}
