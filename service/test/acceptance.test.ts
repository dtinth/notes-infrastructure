import { expect, test } from 'bun:test'
import { ofetch } from 'ofetch'

// @ts-ignore
const { default: secrets } = await import('../../secrets')

const apiFetch = ofetch.create({
  baseURL:
    process.env.NOTES_VERSION === 'new'
      ? 'http://localhost:21024'
      : 'http://localhost:21001',
})
const authenticatedApiFetch = apiFetch.create({
  headers: { Authorization: `Bearer ${secrets.apiToken}` },
})

test('/v2/hello', async () => {
  expect((await apiFetch('/v2/hello')) as string).toEqual('meow')
})

test('/v2/info', async () => {
  expect(await authenticatedApiFetch<any>('/v2/info?slug=Windows')).toEqual({
    editUrl: expect.stringMatching(/^https:\/\/github.+$/),
    privateToken: expect.stringMatching(/^ey.+$/),
    vscodeDevUrl: expect.stringMatching(/^https:\/\/vscode\.dev.+$/),
  })
})
