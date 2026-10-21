import { $ } from 'bun'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import lock from '../bun.lock'
import pkg from '../package.json'

/**
 * Browser assets the static site serves next to the HTML, taken from the
 * notes-frontend release tarballs pinned in package.json.
 * Maps a path in the site to a path inside a package tarball.
 */
const SITE_ASSETS = {
  compiler: ['@notes/compiler', 'package/dist/compiler'],
  static: ['@notes/client', 'package/dist/static'],
  runtime: ['@notes/client', 'package/dist/runtime'],
} as const

type PackageName = (typeof SITE_ASSETS)[keyof typeof SITE_ASSETS][0]

function cacheDir() {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(base, 'notes', 'packages')
}

/** Downloads and extracts a pinned package tarball, once per version. */
async function ensurePackage(name: PackageName) {
  const url = pkg.dependencies[name]
  const version = url.match(/\/([^/]+)\.tgz$/)![1]
  const dir = join(cacheDir(), version)
  if (existsSync(dir)) return dir

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  // These scripts end up on the live site, so check them against the
  // integrity hash bun.lock recorded for the same tarball.
  const data = new Uint8Array(await response.arrayBuffer())
  const integrity = `sha512-${new Bun.CryptoHasher('sha512').update(data).digest('base64')}`
  const expected = (lock.packages as Record<string, unknown[]>)[name]?.[2]
  if (integrity !== expected) {
    throw new Error(`${url} does not match bun.lock: got ${integrity}, expected ${expected}`)
  }

  const tmp = `${dir}.tmp-${process.pid}`
  mkdirSync(tmp, { recursive: true })
  const tgz = join(tmp, 'package.tgz')
  await Bun.write(tgz, data)
  await $`tar -xzf ${tgz} -C ${tmp}`.quiet()
  rmSync(tgz)
  renameSync(tmp, dir)
  return dir
}

/** Where one of the site's asset directories is, downloading it if needed. */
export async function siteAssetDir(target: keyof typeof SITE_ASSETS) {
  const [name, path] = SITE_ASSETS[target]
  return join(await ensurePackage(name), path)
}

export async function copySiteAssets(outDir: string) {
  for (const [target, [name, path]] of Object.entries(SITE_ASSETS)) {
    const dir = await ensurePackage(name)
    cpSync(join(dir, path), join(outDir, target), { recursive: true })
  }
}
