const fs = require('fs')
const http = require('http')
const express = require('express')
const glob = require('glob')
const { createHash } = require('crypto')
const app = express()
const jsonwebtoken = require('jsonwebtoken')
const secrets = require('../secrets')
const searchEngine = require('./store').searchEngine
const importFresh = require('import-fresh')

app.use(express.json())

app.get('/entry', async (req, res, next) => {
  try {
    const jwt = String(req.query.jwt)
    /** @type {any} */
    const data = jsonwebtoken.verify(jwt, secrets.previewSigningSecret, {
      algorithms: ['HS256'],
    })
    const id = String(data.id).replace(/\W/g, '')
    res.json({
      data: fs.readFileSync('data/' + id + '.md', 'utf8'),
    })
  } catch (error) {
    next(error)
  }
})

/** @type {import('express').RequestHandler} */
const requireApiAuth = (req, res, next) => {
  if (req.query.key !== secrets.apiToken) {
    res.status(401).send('unauthorized')
  }
  next()
}

app.get('/search', requireApiAuth, async (req, res, next) => {
  try {
    const results = searchEngine.minisearch.search(String(req.query.q || ''))
    res.json(results)
  } catch (error) {
    next(error)
  }
})

app.post('/sync', requireApiAuth, async (req, res, next) => {
  try {
    const id = String(req.body.id).replace(/\W/g, '')
    if (!id) {
      res.status(400).send('No ID')
      return
    }
    const filePath = 'data/' + id + '.md'

    const currentContents = fs.existsSync(filePath)
      ? fs.readFileSync(filePath)
      : null
    const currentHash = currentContents
      ? createHash('sha1').update(currentContents).digest('hex')
      : null

    const result = {
      written: false,
      status: 'Retrieved note entry',
      contents: currentContents?.toString('utf8'),
      hash: currentHash,
    }
    if (req.body.write) {
      const newContents = Buffer.from(req.body.write.contents)
      const newHash = createHash('sha1').update(newContents).digest('hex')
      if (currentHash && newHash === currentHash) {
        result.status = 'Already up-to-date'
        result.written = true
      } else if (
        currentHash &&
        currentHash !== req.body.write.lastSynchronizedHash
      ) {
        result.status = 'Data conflict'
      } else if (req.body.write.lastSynchronizedHash && !currentHash) {
        result.status = 'Removed from here'
      } else {
        result.status = 'Saved'
        result.written = true
        fs.writeFileSync(filePath, newContents)
        result.contents = newContents.toString('utf8')
        result.hash = newHash
      }
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.get('/sidebar', requireApiAuth, async (req, res, next) => {
  try {
    const sidebar = /** @type {typeof import('./sidebar')} */ (importFresh(
      './sidebar'
    ))
    const results = await sidebar.getSidebar({
      searchEngine,
      currentDocumentId: req.query.id ? String(req.query.id) : undefined,
    })
    res.json(results)
  } catch (error) {
    next(error)
  }
})

app.post('/search', requireApiAuth, async (req, res, next) => {
  try {
    const results = searchEngine.minisearch.search(req.body.q)
    res.json(results)
  } catch (error) {
    next(error)
  }
})

const publicApp = express.Router()
app.use('/public/' + secrets.publicPathPrefix, publicApp)

publicApp.get('/entries-count.json', async (req, res, next) => {
  try {
    const files = glob.sync('data/*.md')
    res.json(files.length)
  } catch (error) {
    next(error)
  }
})

publicApp.get('/link-graph.json', async (req, res, next) => {
  try {
    res.json(getGraph())
  } catch (error) {
    next(error)
  }
})

/**
 * @param {string} docId
 */
const getNodeId = (docId) => {
  return createHash('sha1')
    .update(secrets.nodeIdHashingSalt)
    .update(docId)
    .digest('base64')
}

function getGraph() {
  const graph = {}
  /**
   * @param {string} docId
   */
  const getNode = (docId) => {
    const nodeId = getNodeId(docId)
    let node = graph[nodeId]
    if (!node) {
      node = { links: [] }
      graph[nodeId] = node
    }
    return node
  }
  for (const value of searchEngine.documentMap.values()) {
    for (const link of value.links.split(' ').filter((x) => x)) {
      const node = getNode(value.id)
      node.links.push(getNodeId(link))
    }
  }
  return graph
}

app.use(express.static('public'))

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/v2/')) {
    import('./serverV2').then(async ({ app }) => {
      await app.ready()
      app.server.emit('request', req, res)
    })
  } else {
    app(req, res)
  }
})

server.listen(21001, () => {
  console.log(server.address())
})
