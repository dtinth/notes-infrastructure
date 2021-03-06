const fs = require('fs')
const express = require('express')
const glob = require('glob')
const { createHash } = require('crypto')
const app = express()
const chokidar = require('chokidar')
const jsonwebtoken = require('jsonwebtoken')
const secrets = require('../secrets')
const searchEngine = require('../lib/searchEngine').create()
const { indexDocumentIntoSearchEngine } = require('../lib/indexer')
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

chokidar
  .watch('data', {
    ignored: /\.git/,
    awaitWriteFinish: true,
  })
  .on('all', (event, path) => {
    console.log(event, path)
    if (event === 'add' || event === 'change') {
      if (path.match(/^data\/(\w+)\.md$/)) {
        indexDocumentIntoSearchEngine(
          searchEngine,
          path,
          fs.readFileSync(path, 'utf8')
        )
      }
    }
  })

app.use(express.static('public'))

const server = app.listen(21001, () => {
  console.log(server.address())
})
