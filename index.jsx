// system_monitor.widget/index.jsx
// Live system stats dashboard for Übersicht

// ── Config ─────────────────────────────────────────────────────────────────
const MAX_HISTORY = 60
const W_GRAPH    = 244
const H_GRAPH    = 44

const ACCENT = "#5e9eff"
const GREEN  = "#30d158"
const ORANGE = "#ff9f0a"
const RED    = "#ff453a"
const PURPLE = "#bf5af2"

// Module-level ring buffer — persists across refreshes in Übersicht
let _cpuRing = Array(MAX_HISTORY).fill(0)

// ── Übersicht exports ──────────────────────────────────────────────────────
export const command =
  `bash "$HOME/Library/Application Support/Übersicht/widgets/system_monitor.widget/stats.sh" 2>/dev/null`

export const refreshFrequency = 3000

export const className = `
  top: 20px;
  left: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-size: 11px;
  color: rgba(255,255,255,0.9);
  width: 280px;
  background: rgba(22, 27, 38, 0.90);
  backdrop-filter: blur(34px) saturate(190%);
  -webkit-backdrop-filter: blur(34px) saturate(190%);
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.18);
  padding: 16px 18px 14px;
  box-sizing: border-box;
  box-shadow: 0 16px 52px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.04);
`

// ── Drag + remembered position ─────────────────────────────────────────────
// Übersicht has no native dragging; move the widget's positioned container
// and persist its coordinates in localStorage.
const POS_KEY = "system-monitor-widget-pos"

function initDrag(node) {
  if (!node) return
  let box = node.parentElement
  while (box && box !== document.body && !["absolute", "fixed"].includes(getComputedStyle(box).position)) {
    box = box.parentElement
  }
  if (!box || box === document.body || box.__dragInit) return
  box.__dragInit = true
  box.style.cursor = "move"
  box.style.userSelect = "none"

  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY) || "null")
    if (s && typeof s.left === "number" && typeof s.top === "number") {
      box.style.left = s.left + "px"
      box.style.top = s.top + "px"
    }
  } catch (_) {}

  let drag = null
  const onMove = (e) => {
    if (!drag) return
    box.style.left = drag.ox + (e.clientX - drag.sx) + "px"
    box.style.top = drag.oy + (e.clientY - drag.sy) + "px"
  }
  const onUp = () => {
    document.removeEventListener("mousemove", onMove)
    document.removeEventListener("mouseup", onUp)
    if (drag) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({
          left: parseInt(box.style.left, 10) || 0,
          top: parseInt(box.style.top, 10) || 0,
        }))
      } catch (_) {}
    }
    drag = null
  }
  box.addEventListener("mousedown", (e) => {
    drag = { sx: e.clientX, sy: e.clientY, ox: box.offsetLeft, oy: box.offsetTop }
    e.preventDefault()
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  })
}

// ── Render ─────────────────────────────────────────────────────────────────
export const render = ({ output }) => {
  // Parse JSON
  let s = null
  try { s = JSON.parse(output || "{}") } catch (_) {}

  // Update CPU history ring buffer
  if (s && typeof s.cpu === "number") {
    _cpuRing = [..._cpuRing.slice(1), s.cpu]
  }

  if (!s) return (
    <div style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 11 }}>
      Loading…
    </div>
  )

  // ── Derived values ────────────────────────────────────────────────────
  const cpuPct   = typeof s.cpu === "number" ? s.cpu : null
  const cpuColor = cpuPct === null ? ACCENT : cpuPct > 80 ? RED : cpuPct > 60 ? ORANGE : ACCENT

  let ramUsed = null, ramTotal = null, ramPct = 0
  if (s.ram) {
    const parts = s.ram.split(",")
    ramUsed  = parts[0]
    ramTotal = parts[1]
    ramPct   = parseFloat(parts[2]) || 0
  }
  const ramColor = ramPct > 90 ? RED : ramPct > 75 ? ORANGE : GREEN

  const gpuPct   = typeof s.gpu === "number" ? s.gpu : null
  const gpuColor = gpuPct === null ? PURPLE : gpuPct > 80 ? RED : gpuPct > 50 ? ORANGE : PURPLE

  const battPct   = typeof s.battery === "number" ? s.battery : null
  const battColor = battPct === null ? GREEN : battPct < 20 ? RED : battPct < 40 ? ORANGE : GREEN

  const netUp   = typeof s.net_up   === "number" ? s.net_up   : null
  const netDown = typeof s.net_down === "number" ? s.net_down : null

  // ── CPU graph SVG ────────────────────────────────────────────────────
  const graphPts = _cpuRing.map((v, i) => {
    const x = ((i / (MAX_HISTORY - 1)) * W_GRAPH).toFixed(1)
    const y = (H_GRAPH - (Math.min(100, v) / 100) * (H_GRAPH - 2) - 1).toFixed(1)
    return `${x},${y}`
  }).join(" ")
  const fillPts = `0,${H_GRAPH} ${graphPts} ${W_GRAPH},${H_GRAPH}`

  return (
    <div style={{ boxSizing: "border-box" }} ref={initDrag}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.88)", letterSpacing: "1.2px" }}>
          SYSTEM MONITOR
        </span>
        <span style={{ fontSize: 8, color: GREEN, letterSpacing: "1px", opacity: 0.85 }}>● LIVE</span>
      </div>

      {/* CPU + Graph */}
      <div style={{ marginBottom: 11 }}>
        <RowHeader
          label="CPU"
          value={cpuPct !== null ? `${cpuPct.toFixed(1)}%` : "N/A"}
          color={cpuColor}
        />
        <div style={{
          marginTop: 5,
          background: "rgba(0,0,0,0.22)",
          borderRadius: 7,
          overflow: "hidden",
          border: `1px solid ${cpuColor}33`,
        }}>
          <svg width={W_GRAPH} height={H_GRAPH} style={{ display: "block" }}>
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={cpuColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={cpuColor} stopOpacity="0.02" />
              </linearGradient>
              <clipPath id="graphClip">
                <rect x="0" y="0" width={W_GRAPH} height={H_GRAPH} />
              </clipPath>
            </defs>
            <g clipPath="url(#graphClip)">
              <polygon points={fillPts}  fill="url(#cpuGrad)" />
              <polyline
                points={graphPts}
                fill="none"
                stroke={cpuColor}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* RAM */}
      <div style={{ marginBottom: 11 }}>
        <RowHeader
          label="RAM"
          sub={ramUsed && ramTotal ? `${ramUsed} / ${ramTotal} GB` : ""}
          value={ramPct > 0 ? `${ramPct}%` : "N/A"}
          color={ramColor}
        />
        <Bar pct={ramPct} color={ramColor} />
      </div>

      {/* GPU */}
      <div style={{ marginBottom: 11 }}>
        <RowHeader
          label="GPU"
          value={gpuPct !== null ? `${gpuPct.toFixed(0)}%` : "N/A"}
          color={gpuColor}
        />
        <Bar pct={gpuPct || 0} color={gpuColor} />
      </div>

      {/* Disk storage */}
      <div style={{ marginBottom: 11 }}>
        <RowHeader
          label="DISK"
          sub={typeof s.disk_used_gb === "number" && typeof s.disk_total_gb === "number" ? `${s.disk_used_gb} / ${s.disk_total_gb} GB used` : ""}
          value={typeof s.disk_pct === "number" ? `${s.disk_pct}%` : "N/A"}
          color={typeof s.disk_pct === "number" && s.disk_pct >= 90 ? RED : typeof s.disk_pct === "number" && s.disk_pct >= 75 ? ORANGE : GREEN}
        />
        <Bar
          pct={typeof s.disk_pct === "number" ? s.disk_pct : 0}
          color={typeof s.disk_pct === "number" && s.disk_pct >= 90 ? RED : typeof s.disk_pct === "number" && s.disk_pct >= 75 ? ORANGE : GREEN}
        />
        {s.disk_free_gb !== null && s.disk_free_gb !== undefined && (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 4 }}>
            {s.disk_free_gb} GB available
          </div>
        )}
      </div>

      {/* CPU Temperature */}
      <div style={{ marginBottom: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <span style={labelStyle}>CPU TEMP</span>
          <span style={{ color: ORANGE, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {typeof s.cpu_temp === "number" ? `${s.cpu_temp}°C` : "N/A"}
          </span>
        </div>
        {typeof s.cpu_temp === "number" && <Bar pct={s.cpu_temp} color={ORANGE} />}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0 11px" }} />

      {/* Battery */}
      <div style={{ marginBottom: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <span style={labelStyle}>BATTERY</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {s.charging && <span style={{ color: GREEN, fontSize: 10 }}>⚡</span>}
            <span style={{ color: battColor, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {battPct !== null ? `${battPct.toFixed(0)}%` : "N/A"}
            </span>
          </div>
        </div>
        {battPct !== null && <Bar pct={battPct} color={battColor} />}
      </div>

      {/* Network */}
      <div>
        <span style={{ ...labelStyle, display: "block", marginBottom: 5 }}>NETWORK</span>
        <div style={{ display: "flex", gap: 7 }}>
          <NetCard dir="↑  UP"   value={netUp}   color={ACCENT} />
          <NetCard dir="↓  DOWN" value={netDown} color={GREEN}  />
        </div>
      </div>

    </div>
  )
}

// ── Helper components ──────────────────────────────────────────────────────

const labelStyle = {
  color: "rgba(255,255,255,0.42)",
  fontSize: 10,
  letterSpacing: "0.8px",
}

const RowHeader = ({ label, sub, value, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {sub && <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 9 }}>{sub}</span>}
    </div>
    <span style={{ color, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
)

const Bar = ({ pct, color }) => (
  <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
    <div style={{
      height: "100%",
      width: `${Math.min(100, Math.max(0, pct || 0))}%`,
      background: color,
      borderRadius: 2,
      transition: "width 0.9s ease",
      boxShadow: `0 0 6px ${color}77`,
    }} />
  </div>
)

const NetCard = ({ dir, value, color }) => (
  <div style={{
    flex: 1,
    background: "rgba(255,255,255,0.075)",
    borderRadius: 9,
    padding: "6px 9px",
    border: "1px solid rgba(255,255,255,0.10)",
  }}>
    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginBottom: 2, letterSpacing: "0.5px" }}>{dir}</div>
    <div style={{ color, fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
      {value !== null ? `${value.toFixed(2)} MB/s` : "N/A"}
    </div>
  </div>
)
