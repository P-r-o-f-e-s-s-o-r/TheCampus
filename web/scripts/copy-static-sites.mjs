import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const sites = ['Explore', 'Evelve', 'Engineer']

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true })
}

for (const site of sites) {
  const from = join(root, site)
  if (!existsSync(from)) continue
  cpSync(from, join(dist, site), { recursive: true })
  console.log(`Copied ${site}/ -> dist/${site}/`)
}
