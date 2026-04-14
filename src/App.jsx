import { useState, useEffect, useRef } from 'react'

/* ─── helpers ─────────────────────────────────────────── */
function fmt(secs) {
  if (!isFinite(secs) || secs <= 0) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getHealthScore(level, dischargingTime) {
  // Estimate health: if battery is above 80% and discharge time < 2h → degraded
  // Typical full-charge runtime expectation: 6h = 21600s
  const EXPECTED_FULL = 21600
  if (!isFinite(dischargingTime) || dischargingTime <= 0) return null
  const estimatedFull = dischargingTime / level
  const ratio = estimatedFull / EXPECTED_FULL
  const health = Math.min(100, Math.round(ratio * 100))
  return health
}

function getHealthLabel(score) {
  if (score === null) return { label: 'UNKNOWN', color: '#888' }
  if (score >= 80) return { label: 'EXCELLENT', color: '#00ff88' }
  if (score >= 60) return { label: 'GOOD', color: '#aaff00' }
  if (score >= 40) return { label: 'FAIR', color: '#ffcc00' }
  if (score >= 20) return { label: 'DEGRADED', color: '#ff8800' }
  return { label: 'CRITICAL', color: '#ff2244' }
}

function getLevelColor(pct) {
  if (pct >= 60) return '#00ff88'
  if (pct >= 30) return '#ffcc00'
  return '#ff2244'
}

/* ─── Animated ring ───────────────────────────────────── */
function Ring({ pct, color, size = 220 }) {
  const r = (size - 24) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a1a" strokeWidth="14" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{
          filter: `drop-shadow(0 0 8px ${color})`,
          transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease',
          opacity: 0.5,
        }}
      />
    </svg>
  )
}

/* ─── Scan line overlay ───────────────────────────────── */
function Scanlines() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
    }} />
  )
}

/* ─── Stat card ───────────────────────────────────────── */
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#0f0f0f',
      border: `1px solid ${accent}33`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 4,
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#555', letterSpacing: 3, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 20, fontWeight: 700, color: accent }}>{value}</span>
      {sub && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#444' }}>{sub}</span>}
    </div>
  )
}

/* ─── No support state ────────────────────────────────── */
function UnsupportedState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
      <p style={{ fontFamily: "'Orbitron'", color: '#ff4444', fontSize: 16, marginBottom: 12 }}>BATTERY API NOT SUPPORTED</p>
      <p style={{ fontFamily: "'Share Tech Mono'", color: '#555', fontSize: 12, maxWidth: 360, margin: '0 auto', lineHeight: 1.8 }}>
        Your browser does not support the Web Battery Status API.<br />
        Use <strong style={{ color: '#888' }}>Chrome</strong> or <strong style={{ color: '#888' }}>Edge</strong> on desktop/Android for full functionality.<br /><br />
        <em style={{ color: '#333' }}>Safari and Firefox have removed this API for privacy reasons.</em>
      </p>
    </div>
  )
}

/* ─── Main App ────────────────────────────────────────── */
export default function App() {
  const [battery, setBattery] = useState(null)
  const [supported, setSupported] = useState(true)
  const [tick, setTick] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!('getBattery' in navigator)) {
      setSupported(false)
      return
    }

    let bat = null

    const update = () => setBattery(b => b ? { ...b } : null)

    navigator.getBattery().then(b => {
      bat = b
      setBattery({
        level: b.level,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      })

      const sync = () => setBattery({
        level: b.level,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      })

      b.addEventListener('levelchange', sync)
      b.addEventListener('chargingchange', sync)
      b.addEventListener('chargingtimechange', sync)
      b.addEventListener('dischargingtimechange', sync)
    }).catch(() => setSupported(false))

    // Live clock tick every second
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000)

    return () => {
      clearInterval(timerRef.current)
    }
  }, [])

  const pct = battery ? Math.round(battery.level * 100) : 0
  const levelColor = battery ? getLevelColor(pct) : '#333'
  const healthScore = battery ? getHealthScore(battery.level, battery.dischargingTime) : null
  const { label: healthLabel, color: healthColor } = getHealthLabel(healthScore)

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: "'Share Tech Mono', monospace",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>

      <Scanlines />

      {/* Ambient glow bg */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${levelColor}08 0%, transparent 70%)`,
        transition: 'background 1s ease',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: '#333', letterSpacing: 4, textTransform: 'uppercase' }}>DIAGNOSTIC SYSTEM</p>
            <h1 style={{
              margin: '4px 0 0',
              fontFamily: "'Orbitron', monospace",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
              color: '#fff',
              textShadow: `0 0 30px ${levelColor}66`,
            }}>BATTERY HEALTH</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontFamily: "'Orbitron'", fontSize: 18, color: levelColor, letterSpacing: 1 }}>{timeStr}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#333', letterSpacing: 1 }}>{dateStr}</p>
          </div>
        </div>

        {!supported ? <UnsupportedState /> : (
          <>
            {/* ── Ring + Center ── */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, position: 'relative' }}>
              <div style={{ position: 'relative', width: 220, height: 220 }}>
                <Ring pct={pct} color={levelColor} size={220} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 56, fontWeight: 900,
                    color: levelColor,
                    lineHeight: 1,
                    textShadow: `0 0 40px ${levelColor}`,
                  }}>{battery ? pct : '—'}</span>
                  <span style={{ fontSize: 13, color: '#555', marginTop: 2, letterSpacing: 4 }}>PERCENT</span>
                  {battery && (
                    <div style={{
                      marginTop: 10,
                      padding: '3px 10px',
                      background: battery.charging ? '#00ff8822' : '#ff222211',
                      border: `1px solid ${battery.charging ? '#00ff8844' : '#ff222233'}`,
                      borderRadius: 2,
                      fontSize: 10,
                      color: battery.charging ? '#00ff88' : '#ff4444',
                      letterSpacing: 3,
                    }}>
                      {battery.charging ? '⚡ CHARGING' : '◉ DISCHARGING'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats grid ── */}
            {battery ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <StatCard
                  label="Battery Level"
                  value={`${pct}%`}
                  sub={`${battery.level.toFixed(4)} raw`}
                  accent={levelColor}
                />
                <StatCard
                  label="Health Est."
                  value={healthScore !== null ? `${healthScore}%` : 'N/A'}
                  sub={healthLabel}
                  accent={healthColor}
                />
                <StatCard
                  label="Time to Full"
                  value={battery.charging ? fmt(battery.chargingTime) : '—'}
                  sub={battery.charging ? 'until charged' : 'not charging'}
                  accent="#00aaff"
                />
                <StatCard
                  label="Time Remaining"
                  value={!battery.charging ? fmt(battery.dischargingTime) : '—'}
                  sub={!battery.charging ? 'until empty' : 'plugged in'}
                  accent="#ff8800"
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#333', fontSize: 12, letterSpacing: 2 }}>
                INITIALIZING SENSORS...
              </div>
            )}

            {/* ── Health bar ── */}
            {healthScore !== null && (
              <div style={{ marginTop: 16, padding: '16px 18px', background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>Estimated Health Score</span>
                  <span style={{ fontFamily: "'Orbitron'", fontSize: 12, color: healthColor }}>{healthLabel}</span>
                </div>
                <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${healthScore}%`,
                    background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`,
                    boxShadow: `0 0 10px ${healthColor}`,
                    borderRadius: 3,
                    transition: 'width 1.2s ease',
                  }} />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 10, color: '#333', lineHeight: 1.7 }}>
                  * Health estimated from discharge rate vs 6h baseline. Actual health varies by device usage pattern.
                </p>
              </div>
            )}

            {/* ── Info box ── */}
            <div style={{ marginTop: 10, padding: '12px 18px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4 }}>
              <p style={{ margin: 0, fontSize: 10, color: '#2a2a2a', lineHeight: 1.8, letterSpacing: 1 }}>
                ℹ BATTERY STATUS API · LIVE UPDATES · CHROME / EDGE REQUIRED<br />
                HEALTH = ESTIMATED · BASED ON RUNTIME VS 6H BASELINE
              </p>
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 10, color: '#222', letterSpacing: 2 }}>
            BATTERY HEALTH MONITOR · v1.0.0
          </p>
        </div>

      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; }
      `}</style>
    </div>
  )
}
