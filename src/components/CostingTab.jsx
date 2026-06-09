import React from 'react'
import { costDesign } from '../costing'
import GeometryInputs from './GeometryInputs'

const fmtCad = n => '$' + Math.round(n).toLocaleString('en-CA')

// Costing tab: geometry inputs (shared with Performance) drive the areas;
// the breakdown lists each upgraded category's incremental cost + a total.
export default function CostingTab({ selections, wallSelection, wallRsi, geometry, onGeometryChange }) {
  const { lineItems, total, areas } = costDesign({ selections, wallSelection, wallRsi, geometry })
  const windowInvalid = areas.windowArea <= 0

  return (
    <div className="costing-tab">
      <div className="costing-inputs">
        <GeometryInputs
          geometry={geometry}
          onChange={onGeometryChange}
          fdwrError={windowInvalid ? 'FDWR too low for this footprint — raise FDWR or the footprint' : null}
        />
      </div>
      <div className="costing-output">
        {lineItems.length === 0 ? (
          <div className="costing-empty">
            No upgrades selected — choose envelope or mechanical upgrades on the Prescriptive tab to see their cost.
          </div>
        ) : (
          <table className="costing-table">
            <thead>
              <tr><th>Upgrade</th><th>Detail</th><th>Area</th><th>Rate</th><th>Cost</th></tr>
            </thead>
            <tbody>
              {lineItems.map(li => (
                <tr key={li.categoryId} title={[li.basis, li.notes].filter(Boolean).join(' — ')}>
                  <td>{li.label}</td>
                  <td>{li.detail}</td>
                  <td>{li.area != null ? `${li.area.toFixed(1)} m²` : '—'}</td>
                  <td>{li.rate != null ? `$${li.rate}/m²` : 'flat'}</td>
                  <td>{fmtCad(li.cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4">Total incremental cost above base.h2k</td>
                <td>{fmtCad(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
