const axios = require('axios').default
const formatISO = require('date-fns/formatISO')

require('make-promises-safe')
const start = new Date()
;(async () => {
  const githubConfig = {
    headers: { Authorization: 'Bearer ' + process.env.BOT_GITHUB_TOKEN },
    responseType: 'json',
  }
  const paths = [
    {
      path: 'entries-count.json',
      getMessage: (count) =>
        `Update notes count: ${count} as of ${formatISO(start)}`,
    },
  ]
  for (const { path, getMessage } of paths) {
    const { data: existing } = await axios.get(
      'https://api.github.com/repos/dtinth/notes-stats/contents/' + path,
      githubConfig
    )
    const existingContent = Buffer.from(existing.content, 'base64').toString()
    const { data: next } = await axios.get(
      process.env.NOTES_API_PREFIX + '/' + path,
      { responseType: 'json' }
    )
    const nextContent = JSON.stringify(next)
    if (existingContent.trim() !== nextContent.trim()) {
      console.log('Update', path)
      await axios.put(
        'https://api.github.com/repos/dtinth/notes-stats/contents/' + path,
        {
          message: getMessage(nextContent),
          content: Buffer.from(nextContent).toString('base64'),
          sha: existing.sha,
        },
        githubConfig
      )
    }
  }
})()
