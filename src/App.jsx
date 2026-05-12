import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  athLevels, colorByTime, COLOR,
  AXIS_START_MS, AXIS_END_MS, AXIS_YEARS, dateToAxis, decadeTicks,
} from './chart-utils.js'

const BASE = import.meta.env.BASE_URL

// Default "featured" surface: long-history names that anchor the chart and
// give scrollers an immediate read on the time-axis story. TSLA is in here
// because its red, never-recovered ATH bar is funny.
const FEATURED = [
  'SPY', 'QQQ',
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'META',
  'TSLA',
  'SMH', 'SOXQ',
  'BTC-USD',
]
const FEATURED_RANK = new Map(FEATURED.map((s, i) => [s, i]))

// ─────────────────────────────────────────────────────────────
// Top-level: loads index.json, then fetches every ticker's
// detail file in parallel. Shows a progress count while loading.
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [index, setIndex] = useState(null)
  const [tickers, setTickers] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await fetch(`${BASE}data/index.json`).then(r => r.json())
        if (cancelled) return
        setIndex(idx)
        setProgress({ done: 0, total: idx.tickers.length })

        const results = new Array(idx.tickers.length)
        let done = 0
        await Promise.all(idx.tickers.map(async (t, i) => {
          try {
            const d = await fetch(`${BASE}data/${encodeURIComponent(t.symbol)}.json`).then(r => r.json())
            results[i] = d
          } catch {
            results[i] = null
          }
          done++
          if (!cancelled) setProgress({ done, total: idx.tickers.length })
        }))
        if (cancelled) return
        const ok = results.filter(Boolean)
        ok.forEach(t => { athLevels(t) })
        setTickers(ok)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (error) return <main className="state state--error">Couldn't load data: {error}</main>
  if (!tickers) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <main className="state">
        <Mast />
        <div className="loader">
          Loading <strong>{progress.done}/{progress.total || '…'}</strong> tickers
          <div className="loader-bar"><div className="loader-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      </main>
    )
  }
  return <Leaderboard tickers={tickers} generatedAt={index?.generatedAt} />
}

function Mast() {
  return (
    <header className="mast">
      <div className="mast-title">How long <em>underwater?</em></div>
      <div className="mast-sub">every all-time high, colored by how long you'd have stayed underwater</div>
    </header>
  )
}

function Leaderboard({ tickers, generatedAt }) {
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('featured')

  const filtered = useMemo(() => {
    if (filter === 'all') return tickers
    return tickers.filter(t => t.category === filter)
  }, [tickers, filter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortKey === 'featured') {
      arr.sort((a, b) => {
        const A = FEATURED_RANK.has(a.symbol) ? FEATURED_RANK.get(a.symbol) : Infinity
        const B = FEATURED_RANK.has(b.symbol) ? FEATURED_RANK.get(b.symbol) : Infinity
        if (A !== B) return A - B
        // tie-breaker: % unbroken descending
        return (b.stats.settledPctUnbroken ?? 0) - (a.stats.settledPctUnbroken ?? 0)
      })
    } else {
      arr.sort((a, b) => (b.stats[sortKey] ?? 0) - (a.stats[sortKey] ?? 0))
    }
    return arr
  }, [filtered, sortKey])

  return (
    <main>
      <Mast />

      <section className="lede-row">
        <p className="lede">
          Every closing-price all-time high in {tickers.length} tickers, plotted on a shared {AXIS_YEARS}-year timeline.
          Green ticks were never undercut — those are the buys-of-a-lifetime.
          Red ticks left buyers underwater for years; the dot-com cluster around 2000 should be obvious.
          Tap or hover any row to scrub the ladder.
        </p>
        <Legend />
      </section>

      <section className="controls">
        <div className="seg">
          {[
            ['all', 'All'], ['stock', 'Stocks'], ['etf', 'ETFs'],
            ['commodity', 'Commodities'], ['crypto', 'Crypto'],
          ].map(([v, l]) => (
            <button key={v} className={`seg-btn ${filter === v ? 'is-active' : ''}`} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg seg--right">
          <span className="seg-label">sort</span>
          {[
            ['featured', 'featured'],
            ['settledPctUnbroken', '% unbroken'],
            ['permAthCount', 'still standing'],
            ['pctOffAth', 'off ATH'],
          ].map(([v, l]) => (
            <button key={v} className={`seg-btn ${sortKey === v ? 'is-active' : ''}`} onClick={() => setSortKey(v)}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <ol className="board">
        {sorted.map((t, i) => (
          <Row key={t.symbol} ticker={t} rank={i + 1} />
        ))}
      </ol>

      <Methodology generatedAt={generatedAt} tickerCount={tickers.length} />
    </main>
  )
}

function Legend() {
  const items = [
    [COLOR.victory,  'permanent — never undercut'],
    [COLOR.short,    '≤ 3 months at-or-below'],
    [COLOR.safe,     '3–6 months'],
    [COLOR.meh,      '6–12 months'],
    [COLOR.scary,    '1–2 years'],
    [COLOR.disaster, '2+ years underwater'],
  ]
  return (
    <div className="legend">
      {items.map(([c, l], i) => (
        <span key={i} className="legend-item">
          <svg width="20" height="14" aria-hidden="true">
            <line x1="10" y1="0" x2="10" y2="14" stroke={c} strokeWidth="3" />
          </svg>
          {l}
        </span>
      ))}
      <span className="legend-item">
        <svg width="20" height="14" aria-hidden="true">
          <line x1="10" y1="0" x2="10" y2="14" stroke={COLOR.ink} strokeDasharray="3 3" strokeWidth="1.2" />
        </svg>
        today
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// One leaderboard row: rank + symbol/name + scrubbable barcode +
// permanent-share bar + drawdown indicator.
// ─────────────────────────────────────────────────────────────
const DECADES = decadeTicks()

function Row({ ticker, rank }) {
  const levels = useMemo(
    () => athLevels(ticker).filter(l => dateToAxis(l.date) >= 0),
    [ticker],
  )
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)
  const wrapRef = useRef(null)

  const W = 840, H = 64
  const left = 12, right = W - 12
  const yMid = H / 2
  const xOfFrac = (frac) => left + frac * (right - left)
  const xOfDate = (dateStr) => xOfFrac(Math.max(0, Math.min(1, dateToAxis(dateStr))))

  function nearestByAxis(axisPos) {
    if (!levels.length) return null
    let best = levels[0], bd = Math.abs(dateToAxis(best.date) - axisPos)
    for (let i = 1; i < levels.length; i++) {
      const d = Math.abs(dateToAxis(levels[i].date) - axisPos)
      if (d < bd) { bd = d; best = levels[i] }
    }
    return best
  }

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const axisPos = Math.max(0, Math.min(1, px / rect.width))
    const a = nearestByAxis(axisPos)
    if (!a) return
    const xLocal = Math.max(0, Math.min(1, dateToAxis(a.date))) * rect.width
    setHover({ axisPos, xLocal, a })
  }

  const active = hover?.a || null
  const pct = (ticker.stats.settledPctUnbroken ?? 0) * 100
  const off = ticker.stats.pctOffAth * 100

  return (
    <li className="row">
      <div className="row-rank">{String(rank).padStart(2, '0')}</div>
      <div className="row-name">
        <div className="row-symbol">{ticker.symbol}</div>
        <div className="row-fullname">{ticker.name}</div>
      </div>
      <div ref={wrapRef} className="row-chart">
        <svg ref={svgRef}
          width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => { if (e.touches[0]) onMove({ clientX: e.touches[0].clientX }) }}
          onTouchEnd={() => setHover(null)}
        >
          <line className="axis-line" x1={left - 4} x2={right + 4} y1={yMid} y2={yMid} />
          {DECADES.map((d) => (
            <line key={d.year} className="crosshatch"
              x1={xOfFrac(d.pos)} x2={xOfFrac(d.pos)}
              y1={yMid - 8} y2={yMid + 8} />
          ))}
          {levels.map((l, i) => {
            const isActive = active && active.idx === l.idx
            const stroke = colorByTime(l)
            const half = l.perm ? 20 : 14
            return (
              <line key={i}
                x1={xOfDate(l.date)} x2={xOfDate(l.date)}
                y1={yMid - half} y2={yMid + half}
                stroke={stroke}
                strokeWidth={isActive ? 3 : l.perm ? 2.4 : 1.4} />
            )
          })}
          <line className="now-line"
            x1={xOfFrac(1)} x2={xOfFrac(1)}
            y1={yMid - 16} y2={yMid + 16} />
          {hover && active && (
            <line stroke={COLOR.ink} strokeOpacity="0.55" strokeWidth="0.7"
              x1={xOfDate(active.date)} x2={xOfDate(active.date)} y1={4} y2={H - 4}
              strokeDasharray="2 3" />
          )}
        </svg>
        {hover && active && (
          <Tooltip ticker={ticker} level={active}
            x={hover.xLocal}
            y={yMid}
            side={hover.axisPos > 0.6 ? 'left' : 'right'} />
        )}
      </div>
      <div className="row-pct">
        <div className="pct-bar">
          <div className="pct-track">
            <div className="pct-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className="pct-num">{pct.toFixed(0)}%</span>
        </div>
        <div className="pct-cap">{ticker.stats.permAthCount} of {ticker.stats.athCount} ATHs never undercut</div>
      </div>
      <div className="row-off">
        {off < 0.5
          ? <span className="off-at">at ATH</span>
          : <span>−{off.toFixed(1)}% off</span>}
      </div>
    </li>
  )
}

function Tooltip({ ticker, level, x, y, side }) {
  if (!level) return null
  const W = 220
  const offset = 12
  const leftPx = side === 'right' ? x + offset : x - W - offset
  const c = colorByTime(level)
  const yrs = level.buyable / 252
  let detail
  if (level.perm) {
    detail = (
      <>
        <div className="t-row t-row--big" style={{ color: c }}>permanent ATH — never undercut</div>
        <div className="t-row t-row--sub">a buyer here got in at the floor.</div>
      </>
    )
  } else {
    detail = (
      <>
        <div className="t-row t-row--big" style={{ color: c }}>
          {yrs >= 1 ? `${yrs.toFixed(1)} years at-or-below` : `${level.buyable} days at-or-below`}
        </div>
        <div className="t-row t-row--sub">
          worst drawdown −{(level.maxDD * 100).toFixed(0)}% · first undercut after {level.recov} days
        </div>
      </>
    )
  }
  return (
    <div className="tip" style={{ top: y, left: leftPx, width: W }}>
      <div className="t-eyebrow">{ticker.symbol} ATH</div>
      <div className="t-date">{level.date}</div>
      <div className="t-price">
        ${level.price.toFixed(2)} · {(level.pct * 100).toFixed(1)}% of peak
      </div>
      {detail}
    </div>
  )
}

function Methodology({ generatedAt, tickerCount }) {
  return (
    <section className="meth">
      <h3>Notes</h3>
      <ul>
        <li>
          {tickerCount} tickers — Nasdaq 100 + S&amp;P 100 (deduped union) plus
          major tech / growth / sector / semi ETFs, gold and silver, and a
          few flavors of bitcoin. Daily prices are <strong>split- and dividend-adjusted closes</strong> from Yahoo Finance.
        </li>
        <li>
          A close is a <strong>permanent floor</strong> if no later close was at-or-below it.
          The "% unbroken" column corrects for recency: it only counts ATHs from at least a year ago.
        </li>
        <li>
          Every row shares the same horizontal axis: the last {AXIS_YEARS} years, ending today (dashed vertical line).
          ATHs before the window are hidden; rows for younger tickers (BTC, ARM, PLTR) just start later.
        </li>
        <li>
          Color encodes how many trading days the close stayed at-or-below the ATH afterward, in linear bins:
          ≤3 months stays green, 3–6 olive, 6–12 yellow, 1–2 years orange, 2+ years red.
        </li>
        <li>
          Only <em>closes</em> are checked, not intraday lows.
        </li>
        <li>
          Data refreshed {generatedAt ? new Date(generatedAt).toLocaleString() : '—'}.
        </li>
      </ul>
    </section>
  )
}
