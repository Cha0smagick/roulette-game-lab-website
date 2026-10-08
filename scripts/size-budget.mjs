/**
 * Fails the build when the published site exceeds its gzipped budget.
 *
 * Why gzipped, and why total: what a visitor downloads is the gzipped body, and
 * what they download is the whole page plus every asset it pulls in. Measuring a
 * single entry chunk would let a new 90 kB script slip past a budget that only
 * ever looked at the HTML.
 *
 * Why this is a script and not a CI step in YAML: the same check has to be
 * runnable locally before a push, or it only ever tells you that you were wrong
 * in public. `npm run size` and the CI step are the same file.
 *
 * Compression level 9 is deliberate. Brotli (what GitHub Pages actually serves)
 * would report smaller numbers, and a budget calibrated on numbers the reader
 * never sees is a budget calibrated on a lie. Gzip -9 is the pessimistic
 * figure, which is the one worth failing on.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, relative, sep } from 'node:path'

const DIST = 'dist'
/**
 * 120 kB, in bytes. The site currently sits near 30 kB, so this is roughly four
 * times headroom. A budget nobody hits is decoration; one that is hit in an
 * ordinary week forces the conversation about what the feature is worth.
 */
const BUDGET_BYTES = 120 * 1024

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`No ${DIST}/ directory. Run "npm run build" first.`)
  process.exit(1)
}

const rows = files
  .map((file) => {
    const bytes = readFileSync(file)
    return {
      name: relative(DIST, file).split(sep).join('/'),
      raw: bytes.length,
      gz: gzipSync(bytes, { level: 9 }).length,
    }
  })
  .sort((a, b) => b.gz - a.gz)

const totalRaw = rows.reduce((sum, r) => sum + r.raw, 0)
const totalGz = rows.reduce((sum, r) => sum + r.gz, 0)

const width = Math.max(...rows.map((r) => r.name.length), 4)
const kb = (n) => `${(n / 1024).toFixed(2)} kB`

console.log('file'.padEnd(width), 'gzipped'.padStart(10), 'raw'.padStart(10))
for (const row of rows) {
  console.log(row.name.padEnd(width), kb(row.gz).padStart(10), kb(row.raw).padStart(10))
}
console.log('-'.repeat(width + 22))
console.log(`${rows.length} files`.padEnd(width), kb(totalGz).padStart(10), kb(totalRaw).padStart(10))
console.log(`budget`.padEnd(width), kb(BUDGET_BYTES).padStart(10))

if (totalGz > BUDGET_BYTES) {
  const over = totalGz - BUDGET_BYTES
  console.error(
    `\nOver budget by ${kb(over)}. Something added to the site and nobody priced it.`,
  )
  process.exit(1)
}

console.log(`\nUnder budget by ${kb(BUDGET_BYTES - totalGz)}.`)