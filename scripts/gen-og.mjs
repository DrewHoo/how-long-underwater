// Generate a 1200x630 OG preview image. Run with: node scripts/gen-og.mjs
// The output (public/og.png) is committed; CI does not regenerate it.
//
// Brand mirrors the on-page paper aesthetic — cream background, serif
// italic headline in oxblood/ink, and a single stylized leaderboard
// row on the right showing the time-underwater color ramp.

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'public')
mkdirSync(outDir, { recursive: true })

const W = 1200
const H = 630

// Palette pulled verbatim from src/chart-utils.js COLOR + src/styles.css :root.
const BG       = '#f1ead6'
const INK      = '#1a1814'
const INK_SOFT = '#4a4338'
const RED      = '#e63b2e'
const RULE     = 'rgba(26, 24, 20, 0.18)'

const COLOR = {
  victory:  '#2f7a3b',
  short:    '#5aa14a',
  safe:     '#6c7c2b',
  meh:      '#b39120',
  scary:    '#c66a2b',
  disaster: '#e63b2e',
}

// Twelve ticks placed left-to-right along a horizontal axis. The recency
// of an ATH grows toward the right; older ones tend to be permanent
// (green), recent ones are still underwater (red). This is the shape
// the real charts hint at over and over.
const ticks = [
  { x:  20, c: COLOR.victory,  half: 22 },
  { x:  60, c: COLOR.victory,  half: 22 },
  { x: 100, c: COLOR.victory,  half: 22 },
  { x: 145, c: COLOR.safe,     half: 18 },
  { x: 190, c: COLOR.safe,     half: 18 },
  { x: 235, c: COLOR.meh,      half: 18 },
  { x: 285, c: COLOR.meh,      half: 18 },
  { x: 335, c: COLOR.scary,    half: 18 },
  { x: 385, c: COLOR.scary,    half: 18 },
  { x: 430, c: COLOR.disaster, half: 24 },
  { x: 470, c: COLOR.disaster, half: 24 },
  { x: 505, c: COLOR.disaster, half: 24 },
]
const NOW_X = 530

const ticksSvg = ticks.map(t => `
  <line x1="${t.x}" x2="${t.x}" y1="${-t.half}" y2="${t.half}"
    stroke="${t.c}" stroke-width="${t.half >= 22 ? 4 : 3}" />
`).join('')

// Color-ramp legend — gradient bar with end labels, à la the sibling OG.
// Five-stop gradient mirrors the COLOR ramp used on the page.

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Top rule, like the masthead on the page -->
  <line x1="60" y1="120" x2="${W - 60}" y2="120" stroke="${INK}" stroke-width="1.5"/>

  <!-- Eyebrow -->
  <text x="60" y="100" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
    font-size="22" fill="${INK_SOFT}" letter-spacing="3.5" font-weight="700">
    DREWHOOVER.COM
  </text>

  <!-- Headline (serif italic emulated via system serif) -->
  <text x="60" y="230" font-family="'DM Serif Display', Didot, 'Bodoni MT', Garamond, 'Times New Roman', serif"
    font-size="64" fill="${INK}" font-style="italic" letter-spacing="-1">
    Should You Buy
  </text>
  <text x="60" y="298" font-family="'DM Serif Display', Didot, 'Bodoni MT', Garamond, 'Times New Roman', serif"
    font-size="64" fill="${RED}" font-style="italic" letter-spacing="-1">
    an All-Time High?
  </text>

  <!-- Subhead -->
  <text x="60" y="380" font-family="'DM Serif Display', Didot, 'Bodoni MT', Garamond, 'Times New Roman', serif"
    font-size="26" fill="${INK}" font-style="italic">
    Sometimes yes; sometimes brutally
  </text>
  <text x="60" y="416" font-family="'DM Serif Display', Didot, 'Bodoni MT', Garamond, 'Times New Roman', serif"
    font-size="26" fill="${INK}" font-style="italic">
    no — colored by recovery time.
  </text>

  <!-- Footer (corpus) -->
  <text x="60" y="555" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
    font-size="16" fill="${INK_SOFT}" letter-spacing="1.5" font-weight="700">
    200+ TICKERS · NASDAQ 100 · S&amp;P 100 · TECH ETFS · GOLD · BTC
  </text>

  <!-- Bottom rule + URL accent -->
  <line x1="60" y1="585" x2="${W - 60}" y2="585" stroke="${INK}" stroke-width="1.5"/>
  <rect x="60" y="595" width="80" height="3" fill="${RED}"/>

  <!-- Right column: stylized leaderboard row -->
  <g transform="translate(640, 215)">
    <!-- card -->
    <rect x="0" y="0" width="500" height="220" rx="0" fill="#faf4e0"
      stroke="${INK}" stroke-width="1"/>
    <!-- row "symbol" -->
    <text x="22" y="42" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
      font-size="22" fill="${INK}" font-weight="700">SPY</text>
    <text x="22" y="62" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
      font-size="11" fill="${INK_SOFT}">SPDR S&amp;P 500 ETF</text>

    <!-- chart row -->
    <g transform="translate(22, 130)">
      <line x1="-4" x2="${510}" y1="0" y2="0" stroke="${INK}" stroke-width="1.4"/>
      ${ticksSvg}
      <!-- today marker -->
      <line x1="${NOW_X}" x2="${NOW_X}" y1="-26" y2="26"
        stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 3"/>
    </g>
  </g>

  <defs>
    <linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"    stop-color="${COLOR.victory}"/>
      <stop offset="20%"   stop-color="${COLOR.short}"/>
      <stop offset="40%"   stop-color="${COLOR.safe}"/>
      <stop offset="60%"   stop-color="${COLOR.meh}"/>
      <stop offset="80%"   stop-color="${COLOR.scary}"/>
      <stop offset="100%"  stop-color="${COLOR.disaster}"/>
    </linearGradient>
  </defs>
  <!-- Legend strip under the card -->
  <g transform="translate(660, 472)">
    <rect x="0" y="0" width="460" height="10" fill="url(#ramp)"/>
    <text x="0" y="30" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
      font-size="12" fill="${INK_SOFT}">permanent ATH</text>
    <text x="460" y="30" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
      font-size="12" fill="${INK_SOFT}" text-anchor="end">2+ years underwater</text>
  </g>
</svg>`

const out = resolve(outDir, 'og.png')
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(out)
console.log(`wrote ${out}`)
