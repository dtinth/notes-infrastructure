import { Glob } from 'bun'
import fs from 'fs'
import path from 'path'
import { NotesDatabase } from '../src/NotesDatabase'
import { indexNote } from '../src/indexNote'

const glob = new Glob('*.md')

const db = new NotesDatabase()
const basePath = '../data'

console.log('Indexing all notes...')
for await (const filePath of glob.scan(basePath)) {
  const slug = path.basename(filePath, '.md')
  indexNote(db, slug, fs.readFileSync(`${basePath}/${filePath}`, 'utf-8'))
}

const visited = new Set<string>()
const queue = ['HomePage']
const costMap = new Map<string, { cost: number; via?: string }>([
  ['HomePage', { cost: 0 }],
])
const table: {}[] = []
console.log('Building public graph...')
while (queue.length > 0) {
  const slug = queue.shift()!
  const note = db.documentMap.get(slug)
  if (!note) continue
  if (!note.public) continue
  if (visited.has(slug)) continue
  const thisCost = costMap.get(slug)!.cost
  visited.add(slug)
  table.push({
    slug,
    title: note.title.slice(0, 64),
    cost: thisCost,
    parent: costMap.get(slug)!.via,
  })
  const links = note.links.split(' ')
  const childCost = thisCost + links.length * (note.topic ? 0.5 : 1)
  for (const link of links) {
    if (link) {
      queue.push(link)
      if (!costMap.has(link) || childCost < costMap.get(link)!.cost) {
        costMap.set(link, { cost: childCost, via: slug })
      }
    }
  }
  queue.sort((a, b) => costMap.get(a)!.cost - costMap.get(b)!.cost)
}
console.log('Graph built. Number of reachable public notes:', visited.size)
console.table(table)
