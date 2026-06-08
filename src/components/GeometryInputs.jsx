import React from 'react'

// Footprint as L×W number fields (builders think in dimensions) + FDWR number
// field. Floor area = L×W×2 (stories fixed at 2 per the locked design decision).
export default function GeometryInputs({ geometry, onChange, fdwrError }) {
  const { length_m, width_m, fdwr } = geometry
  const floorArea = (Number(length_m) || 0) * (Number(width_m) || 0) * 2

  const num = (field) => (e) => onChange(field, parseFloat(e.target.value))

  return (
    <div className="geometry-inputs">
      <div className="label">GEOMETRY</div>
      <div className="geometry-footprint">
        <label>
          Length (m)
          <input type="number" step="0.1" value={length_m} onChange={num('length_m')} />
        </label>
        <span className="geometry-times">×</span>
        <label>
          Width (m)
          <input type="number" step="0.1" value={width_m} onChange={num('width_m')} />
        </label>
        <span className="geometry-area">= {floorArea.toFixed(1)} m² · 2 storeys</span>
      </div>
      <label className="geometry-fdwr">
        FDWR (fraction)
        <input type="number" step="0.01" min="0.05" max="0.40" title="0.05–0.40" value={fdwr} onChange={num('fdwr')} />
      </label>
      {fdwrError && <div className="field-error">{fdwrError}</div>}
    </div>
  )
}
