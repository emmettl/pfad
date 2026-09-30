import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
const MAX_FILE = 25 * 1024 * 1024
const MAX_SCAFFOLD = 2 * 1024 * 1024
let total = 0, count = 0
async function visit(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name)
    if (file.isDirectory()) { await visit(path); continue }
    const { size } = await stat(path)
    if (size > MAX_FILE) throw new Error(`Static asset exceeds 25 MiB: ${path}`)
    total += size; count++
  }
}
await visit('dist')
if (total > MAX_SCAFFOLD) throw new Error('Scaffold exceeded its 2 MiB budget; review data admission before widening it')
if (count > 20000) throw new Error('Static asset count exceeds the hosting limit')
console.log(`PFAD scaffold: ${count} files, ${total} bytes`)
