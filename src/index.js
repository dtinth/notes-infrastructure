const fs = require('fs')
const express = require('express')
const glob = require('glob')
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

app.get('/public', async (req, res, next) => {
  try {
    const publicSearchEngine = require('../lib/searchEngine').create()
    for (const path of glob.sync('data/*.md')) {
      indexDocumentIntoSearchEngine(
        publicSearchEngine,
        path,
        fs.readFileSync(path, 'utf8'),
        { publicOnly: true }
      )
    }
    res.json(
      Array.from(publicSearchEngine.documentMap.values()).map((doc) => {
        const { text, ...others } = doc
        return others
      })
    )
  } catch (error) {
    next(error)
  }
})

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
