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
      annual: t.athAnnualReturn ? t.athAnnualReturn[k] : null,
    }
  })
}

// The row SVG uses an inset (12 of 840 viewBox units) on each side so the
// axis sits inside the container edges. Both the chart row and the
// background timeline need this fraction to line up.
export const AXIS_INSET_FRAC = 12 / 840

// Per-ticker stats restricted to the visible window. Cached per ticker.
const _windowedCache = new WeakMap()
export function windowedAthStats(t) {
  const cached = _windowedCache.get(t)
  if (cached) return cached
  let athCount = 0
  let permCount = 0
  for (let k = 0; k < t.athIdx.length; k++) {
    const frac = dateToAxis(t.dates[t.athIdx[k]])
    if (frac < 0 || frac > 1) continue
    athCount++
    if (t.athRecov[k] == null) permCount++
  }
  // Years of history the ticker actually has inside the window. A 5-year-old
  // ETF gets credited with 5 years (not 30), so ATHs-per-year is honest.
  const firstMs = Date.parse(t.dates[0])
  const effectiveStartMs = Math.max(AXIS_START_MS, firstMs)
  const yearsInWindow = Math.max(0.25, (AXIS_END_MS - effectiveStartMs) / (365.25 * 86400000))
  const athsPerYear = athCount / yearsInWindow
  const result = { athCount, permCount, athsPerYear, yearsInWindow }
  _windowedCache.set(t, result)
  return result
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
// Permanent ATHs are pure win (deep green). Non-permanent ATHs are
// linearly bucketed by trading days at-or-below the ATH price:
//   ≤  3 months → light green   (still pretty harmless)
//   3–6 months  → olive
//   6–12 months → yellow
//   1–2 years   → burnt orange
//   2+ years    → red
// ~252 trading days per calendar year is the conversion.
// ---------------------------------------------------------------
export const COLOR = {
  victory:  '#2f7a3b',   // permanent ATH
  short:    '#5aa14a',   // ≤ 3 months
  safe:     '#6c7c2b',   // 3–6 months
  meh:      '#b39120',   // 6–12 months
  scary:    '#c66a2b',   // 1–2 years
  disaster: '#e63b2e',   // 2+ years
  ink:      '#1a1814',
  bg:       '#f1ead6',
}

const D_3M = 63
const D_6M = 126
const D_1Y = 252
const D_2Y = 504

export function colorByTime(level) {
  if (level.perm) return COLOR.victory
  const days = level.buyable
  if (days <= D_3M) return COLOR.short
  if (days <= D_6M) return COLOR.safe
  if (days <= D_1Y) return COLOR.meh
  if (days <= D_2Y) return COLOR.scary
  return COLOR.disaster
}
