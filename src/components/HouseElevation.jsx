import React from 'react'

// Fixed 2-storey front elevation. Facade width scales with √(footprint area); window
// glazing size scales with FDWR. Purely presentational and self-clamping so the SVG canvas
// never breaks. Takes the building's metric footprint (length_m × width_m) and FDWR; floor
// area = length × width × 2 storeys, expressed in ft² internally for the scaling bounds.

const FT2_PER_M2 = 10.7639
const FACADE_W_MIN = 92    // px facade width at ~500 ft² floor area
const FACADE_W_MAX = 224   // px facade width at ~5000 ft² floor area
const FACADE_H = 170       // fixed 2-storey height (px)
const N_WINDOWS = 5        // 3 upper + 2 flanking the door
const SIDE_FT_MIN = Math.sqrt(500 / 2)   // ≈ 15.81 ft footprint side at 500 ft²
const SIDE_FT_MAX = Math.sqrt(5000 / 2)  // 50.00 ft footprint side at 5000 ft²

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t

function Window({ cx, cy, side }) {
  const x = cx - side / 2
  const y = cy - side / 2
  const fr = Math.max(1.6, side * 0.07)
  const mull = Math.max(1.2, side * 0.05)
  return (
    <g filter="url(#he-soft)">
      <rect x={x - fr} y={y - fr} width={side + 2 * fr} height={side + 2 * fr} rx="2"
            fill="#ffffff" stroke="#cdbfa8" strokeWidth="1" />
      <rect data-testid="he-window-glass" x={x} y={y} width={side} height={side} rx="1.5"
            fill="url(#he-glass)" stroke="#3f7fa3" strokeWidth="1" />
      <polygon points={`${x + side * 0.12},${y + side} ${x + side * 0.42},${y} ${x + side * 0.58},${y} ${x + side * 0.28},${y + side}`}
               fill="#ffffff" fillOpacity="0.22" />
      <line x1={cx} y1={y} x2={cx} y2={y + side} stroke="#ffffff" strokeWidth={mull} />
      <line x1={x} y1={cy} x2={x + side} y2={cy} stroke="#ffffff" strokeWidth={mull} />
      <rect x={x - fr - 2} y={y + side + fr} width={side + 2 * fr + 4}
            height={Math.max(2, side * 0.08)} rx="1" fill="#d8cdbb" />
    </g>
  )
}

export default function HouseElevation({ lengthM, widthM, fdwr }) {
  const floorAreaFt2 = (Number(lengthM) || 0) * (Number(widthM) || 0) * 2 * FT2_PER_M2
  const f = Number(fdwr) || 0

  // square-equivalent footprint side for the visual; clamped so the canvas never breaks
  const sideFt = clamp(Math.sqrt(floorAreaFt2 / 2), SIDE_FT_MIN, SIDE_FT_MAX)
  const t = (sideFt - SIDE_FT_MIN) / (SIDE_FT_MAX - SIDE_FT_MIN)
  const W = lerp(FACADE_W_MIN, FACADE_W_MAX, t)
  const H = FACADE_H
  const x = 150 - W / 2
  const y = 46
  const floorH = H / 2

  const doorW = Math.min(34, W * 0.26)
  const doorH = floorH * 0.78
  const dx = 150 - doorW / 2
  const dy = y + H - doorH

  // window side so total glass ≈ FDWR × facade area, capped to fit a storey and the cells
  const cellUpper = W / 3
  const cellLower = (W - doorW) / 2
  const side = Math.min(
    Math.sqrt((f * W * H) / N_WINDOWS),
    floorH * 0.6,
    cellUpper * 0.82,
    cellLower * 0.82,
  )

  const upY = y + floorH * 0.5
  const loY = y + floorH * 1.5
  const oh = Math.max(12, W * 0.1)

  return (
    <div className="house-elevation">
      <svg viewBox="0 0 300 260" role="img" aria-label="House elevation preview">
        <defs>
          <linearGradient id="he-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe7da" /><stop offset="1" stopColor="#e4d8c6" />
          </linearGradient>
          <linearGradient id="he-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#bfe0f0" /><stop offset="0.5" stopColor="#8ec3de" /><stop offset="1" stopColor="#6fa9c8" />
          </linearGradient>
          <linearGradient id="he-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f7a5a" /><stop offset="1" stopColor="#155c43" />
          </linearGradient>
          <filter id="he-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#22303a" floodOpacity="0.18" />
          </filter>
        </defs>

        <ellipse cx="150" cy={y + H + 10} rx={W * 0.62} ry="9" fill="#22303a" fillOpacity="0.10" />
        <line x1="24" y1={y + H} x2="276" y2={y + H} stroke="#c9bca6" strokeWidth="2" />

        <rect data-testid="he-facade" x={x} y={y} width={W} height={H} rx="3"
              fill="url(#he-wall)" stroke="#c9bca6" strokeWidth="1" filter="url(#he-soft)" />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
          <line key={i} x1={x + 2} y1={y + (i * H) / 10} x2={x + W - 2} y2={y + (i * H) / 10}
                stroke="#d8ccb9" strokeWidth="1" strokeOpacity="0.7" />
        ))}

        <polygon points={`${x - oh},${y} 150,${y - 30} ${x + W + oh},${y}`}
                 fill="url(#he-roof)" stroke="#0f4632" strokeWidth="1" filter="url(#he-soft)" />
        <rect x={x - 2} y={y} width={W + 4} height="4" fill="#22303a" fillOpacity="0.12" />

        <Window cx={x + (0.5 * W) / 3} cy={upY} side={side} />
        <Window cx={x + (1.5 * W) / 3} cy={upY} side={side} />
        <Window cx={x + (2.5 * W) / 3} cy={upY} side={side} />

        <rect x={dx} y={dy} width={doorW} height={doorH} rx="2"
              fill="#155c43" stroke="#0f4632" strokeWidth="1" filter="url(#he-soft)" />
        <rect x={dx + 4} y={dy + 5} width={doorW - 8} height={doorH * 0.42} rx="1.5" fill="#1f7a5a" fillOpacity="0.55" />
        <rect x={dx + 4} y={dy + doorH * 0.52} width={doorW - 8} height={doorH * 0.40} rx="1.5" fill="#1f7a5a" fillOpacity="0.55" />
        <circle cx={dx + doorW - 7} cy={dy + doorH * 0.55} r="2" fill="#e8c66a" />

        <Window cx={x + W * 0.16} cy={loY} side={side} />
        <Window cx={x + W * 0.84} cy={loY} side={side} />
      </svg>
    </div>
  )
}
