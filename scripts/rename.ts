import 'dotenv/config'
import secrets from '../secrets'
import axios from 'axios'
import { parseArgs } from 'util'

const { positionals } = parseArgs({ allowPositionals: true })
const from = positionals[0]
const to = positionals[1]

if (!from) {
  throw new Error('Missing from')
}
if (!to) {
  throw new Error('Missing to')
}

async function main() {
  const key = secrets.apiToken
  const url = `http://localhost:21001/v2/rename`
  const { data } = await axios.post(
    url,
    { from, to },
    {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    }
  )
  const afterCmds: string[] = []
  for (const op of data.operations) {
    if (op.type === 'rename') {
      console.log(`mv data/${op.id}.md data/${op.to}.md`)
      console.log('aliases:')
      for (const alias of op.aliases) {
        console.log(`  - ${alias}`)
      }
    } else if (op.type === 'updateLink' && op.id !== from) {
      afterCmds.push(`sed -i 's/${from}/${to}/g' data/${op.id}.md`)
    } else {
      console.log(op)
    }
  }
  for (const cmd of afterCmds) {
    console.log(cmd)
  }
}

main()
