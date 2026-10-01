// Use the browser's number/string serialisation for cross-language identities.
// Python's 2.0 and exponent formatting otherwise differ from JSON.stringify.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { manifestIdentityPayload } from '../../src/search/manifest.ts'
const data = JSON.parse(readFileSync(0, 'utf8'))
process.stdout.write(createHash('sha256').update(manifestIdentityPayload(data)).digest('hex'))
