import React from 'react'

// Read-only mirror of the envelope carried from the Prescriptive tab, shown as the
// effective ecp_state with a source tag per row. Heating is fixed for the MVP.
const Tag = ({ kind }) => <span className={`mirror-tag tag-${kind}`}>{kind}</span>

export default function EnvelopeMirror({ ecpState, sources }) {
  const rows = [
    ['Above-grade wall', `RSI ${ecpState.above_grade_wall.rsi.toFixed(2)}`, sources.aboveGradeWall],
    ['Below-grade wall', `RSI ${ecpState.below_grade_wall.rsi.toFixed(2)}`, sources.belowGradeWall],
    ['Windows', `RSI ${ecpState.windows.rsi.toFixed(2)} · SHGC ${ecpState.windows.shgc}`, sources.windows],
    ['Airtightness', `${ecpState.airtightness_ach50} ACH₅₀`, sources.airtightness],
    ['Ventilation', `SRE ${Math.round(ecpState.hrv.sre * 100)}%`, sources.ventilation],
    ['DHW', `EF/UEF ${ecpState.dhw.ef}`, sources.dhw],
  ]
  return (
    <div className="envelope-mirror">
      <div className="label">YOUR DESIGN — from Prescriptive tab (read-only)</div>
      <table className="mirror-table">
        <tbody>
          {rows.map(([name, val, src]) => (
            <tr key={name}>
              <td>{name}</td><td><b>{val}</b></td><td><Tag kind={src} /></td>
            </tr>
          ))}
          <tr>
            <td>Heating</td><td><b>Electric baseboard</b></td><td><Tag kind="fixed" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
