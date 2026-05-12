// Generate favicon assets from a single SVG source. Run with:
//   node scripts/gen-favicon.mjs
// Writes:
//   public/favicon.svg          — modern browsers (vector, any size)
//   public/favicon-32.png       — generic small-pixel fallback
//   public/favicon-192.png      — Android, PWA
//   public/apple-touch-icon.png — iOS home-screen icon (180x180)

import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'public')
mkdirSync(outDir, { recursive: true })

// Cream paper square with a five-bar "barcode" running the leaderboard's
// time-underwater color ramp: green (permanent) → olive → amber →
// burnt-orange → deep red (decade+ underwater). The dot is the red
// accent that mirrors the on-page masthead.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#f1ead6"/>
  <line x1="10" y1="18" x2="10" y2="46" stroke="#2f7a3b" stroke-width="6" stroke-linecap="round"/>
  <line x1="22" y1="20" x2="22" y2="44" stroke="#6c7c2b" stroke-width="6" stroke-linecap="round"/>
  <line x1="34" y1="20" x2="34" y2="44" stroke="#b39120" stroke-width="6" stroke-linecap="round"/>
  <line x1="46" y1="18" x2="46" y2="46" stroke="#c66a2b" stroke-width="6" stroke-linecap="round"/>
  <line x1="56" y1="14" x2="56" y2="50" stroke="#e63b2e" stroke-width="6" stroke-linecap="round"/>
</svg>`

writeFileSync(resolve(outDir, 'favicon.svg'), svg + '\n')
console.log('wrote favicon.svg')

const png = [
  { name: 'favicon-32.png',       size: 32 },
  { name: 'favicon-192.png',      size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]
for (const { name, size } of png) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, name))
  console.log(`wrote ${name}`)
}
