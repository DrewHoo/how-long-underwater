// Chart data helpers. Pure functions, no React, no DOM. Kept separate so
// they're trivial to unit-test or reuse if the UI gets ported.

// One JSON ticker file from public/data/<SYM>.json carries:
//   closes, dates, athIdx, athRecov, athBuyable, athMaxDD, athCurrentRel, stats
// `athLevels(ticker)` zips those parallel arrays into per-ATH records the
// chart can map over directly.
export function athLevels(t) {
  const max = t.stats.athClose
  return t.athIdx.map((closeIdx, k) => {
    const price = t.closes[closeIdx]
    return {
      idx: closeIdx,
      date: t.dates[closeIdx],
      price,
      pct: price / max,
      perm: t.athRecov[k] == null,
      recov: t.athRecov[k],
      buyable: t.athBuyable[k],
      maxDD: t.athMaxDD ? t.athMaxDD[k] : 0,
      currentRel: t.athCurrentRel ? t.athCurrentRel[k] : 1,
    }
  })
}

export function nowPct(t) {
  return t.stats.lastClose / t.stats.athClose
}

// ---------------------------------------------------------------
// Shared time axis — used by the row chart.
//
// Every row plots ATHs at their date position on the same horizontal
// span (default: the last 30 years). That makes the dot-com cluster,
// '08, and the 2021 peaks line up visually across tickers.
// ---------------------------------------------------------------
export const AXIS_YEARS = 30
export const AXIS_END_MS = Date.UTC(
  new Date().getUTCFullYear(),
  new Date().getUTCMonth(),
  new Date().getUTCDate(),
)
export const AXIS_START_MS = AXIS_END_MS - AXIS_YEARS * 365.25 * 24 * 3600 * 1000

export function dateToAxis(dateStr) {
  const t = Date.parse(dateStr)
  return (t - AXIS_START_MS) / (AXIS_END_MS - AXIS_START_MS)
}

// Decade boundaries (Jan 1 of each multiple of 10) within the visible window.
export function decadeTicks() {
  const startYear = new Date(AXIS_START_MS).getUTCFullYear()
  const endYear = new Date(AXIS_END_MS).getUTCFullYear()
  const out = []
  for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) {
    out.push({
      year: y,
      pos: (Date.UTC(y, 0, 1) - AXIS_START_MS) / (AXIS_END_MS - AXIS_START_MS),
    })
  }
  return out
}

// ---------------------------------------------------------------
// Per-ticker log price axis — kept for the OG image and any future
// alt view. Not used by the live row chart anymore.
// ---------------------------------------------------------------
const _floorCache = new WeakMap()

export function tickerFloor(t) {
  let f = _floorCache.get(t)
  if (f != null) return f
  let min = 1
  for (const idx of t.athIdx) {
    const p = t.closes[idx] / t.stats.athClose
    if (p < min) min = p
  }
  // Touch below the lowest ATH; never less than 1e-6 (numerical guard).
  f = Math.max(1e-6, min * 0.7)
  _floorCache.set(t, f)
  return f
}

export function pctToAxis(t, pct) {
  const floor = tickerFloor(t)
  if (pct <= floor) return 0
  if (pct >= 1) return 1
  return 1 - Math.log(pct) / Math.log(floor)
}

// Decade-ish labels between floor and 100%.
export function logLabels(t) {
  const floor = tickerFloor(t)
  const fmt = (p) => {
    if (p >= 0.01) return (p * 100).toFixed(0) + '%'
    if (p >= 0.001) return (p * 100).toFixed(1) + '%'
    return (p * 100).toFixed(2) + '%'
  }
  const out = [{ pct: 1, label: '100%' }]
  let v = 1
  while (v / 10 > floor * 1.05) {
    v /= 10
    out.push({ pct: v, label: fmt(v) })
  }
  const last = out[out.length - 1].pct
  if (floor < last * 0.5) out.push({ pct: floor, label: fmt(floor) })
  return out
}

// ---------------------------------------------------------------
// Buyer-perspective color encoding — the C3 / time-underwater scheme.
//
// Permanent ATHs are pure win (green). Everything else is colored by
// how many trading days the price spent at-or-below: a few days is a
// blip (olive), a year-plus is the kind of ATH that left people
// underwater for half a career (deep red).
// ---------------------------------------------------------------
export const COLOR = {
  victory:  '#2f7a3b',
  safe:     '#6c7c2b',
  meh:      '#b39120',
  scary:    '#c66a2b',
  disaster: '#e63b2e',
  ink:      '#1a1814',
  bg:       '#f1ead6',
}

export function colorByTime(level) {
  if (level.perm) return COLOR.victory
  const days = level.buyable
  // ~10 years of trading days (2520) is the upper anchor of the log scale.
  const t = Math.max(0, Math.min(1, Math.log10(1 + days) / Math.log10(2520)))
  if (t < 0.33) return COLOR.safe
  if (t < 0.55) return COLOR.meh
  if (t < 0.80) return COLOR.scary
  return COLOR.disaster
}
