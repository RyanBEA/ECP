import React from 'react'
import { categories, wallTypes, calculateWallRsi } from '../data/ecpData'

export default function PrintSummary({ selections, wallSelection, wallPoints, totalPoints, selectedTier }) {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

  // Resolve selected standard categories into rows
  const rows = Object.entries(selections).map(([categoryId, optionIndex]) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category || optionIndex === null) return null
    const option = category.options[optionIndex]
    const dirSymbol = category.direction === 'higher' ? '≥' : '≤'
    const label = option.label
      ? `${option.label} (${dirSymbol} ${option.value} ${category.unit})`
      : `${dirSymbol} ${option.value} ${category.unit}`
    return { name: category.name, label, points: option.points }
  }).filter(Boolean)

  // Wall row
  const hasWall = wallPoints > 0 || wallSelection.wallType || wallSelection.simpleIndex !== undefined
  const isBuilderMode = wallSelection.wallType && wallSelection.simpleIndex === undefined
  let wallLabel = ''
  let wallDetails = null

  if (hasWall) {
    if (isBuilderMode) {
      const rsi = calculateWallRsi(wallSelection)
      wallLabel = rsi ? `RSI ${rsi.toFixed(2)}` : 'Incomplete'

      const wallTypeName = wallTypes.find(w => w.id === wallSelection.wallType)?.label || wallSelection.wallType
      const assemblyLabel = wallSelection.assemblyType === 'doubleStud' ? 'Double Stud' : 'Single Stud'
      const isIcf = wallSelection.wallType === 'icf'

      const isDoubleStud = wallSelection.assemblyType === 'doubleStud'

      // Build framing detail line based on assembly type
      let framingDetail = null
      if (!isIcf) {
        if (isDoubleStud) {
          const parts = [`Stud Spacing: ${wallSelection.studSpacing}`]
          if (wallSelection.outerStud && wallSelection.innerStud) {
            parts.push(`Studs: ${wallSelection.outerStud} + ${wallSelection.innerStud}`)
          }
          if (wallSelection.plate) parts.push(`Plate: ${wallSelection.plate}`)
          if (wallSelection.doubleStudMaterial) parts.push(`Fill: ${wallSelection.doubleStudMaterial}`)
          framingDetail = parts.join(' | ')
        } else if (wallSelection.studSpacing) {
          const parts = [`Stud Spacing: ${wallSelection.studSpacing}`]
          const cavity = [wallSelection.cavityMaterial, wallSelection.cavityType].filter(Boolean).join(', ')
          if (cavity) parts.push(`Cavity: ${cavity}`)
          framingDetail = parts.join(' | ')
        }
      }

      // Service wall detail
      let serviceDetail = null
      if (wallSelection.hasServiceWall && wallSelection.serviceCavityMaterial) {
        const parts = [wallSelection.serviceSpacing, wallSelection.serviceCavityMaterial, wallSelection.serviceCavityType].filter(Boolean)
        serviceDetail = `Service Wall: ${parts.join(', ')}`
      }

      wallDetails = {
        wallType: isIcf ? wallTypeName : `${wallTypeName}, ${assemblyLabel}`,
        framing: framingDetail,
        serviceWall: serviceDetail,
        contIns: wallSelection.contInsType && wallSelection.contInsThickness && wallSelection.contInsThickness !== 'None'
          ? `${wallSelection.contInsType}, ${wallSelection.contInsThickness}`
          : null,
        totalRsi: rsi ? rsi.toFixed(2) : null,
      }
    } else {
      // Simple mode — just show the option label
      const wallCat = categories.find(c => c.id === 'aboveGroundWalls')
      const option = wallCat.options[wallSelection.simpleIndex]
      if (option) {
        wallLabel = `≥ RSI ${option.value}`
      }
    }
  }

  const targetPoints = selectedTier.points
  const isMet = totalPoints >= targetPoints

  return (
    <div className="print-summary">
      <div className="print-header">
        <span>NBC 2020 {selectedTier.label} Compliance — ECP Summary</span>
        <span>{today}</span>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Selection</th>
            <th className="print-pts">Points</th>
          </tr>
        </thead>
        <tbody>
          {hasWall && (
            <>
              <tr className="print-row">
                <td>Above Ground Walls</td>
                <td>{wallLabel}</td>
                <td className="print-pts">{wallPoints.toFixed(1)}</td>
              </tr>
              {wallDetails && (
                <>
                  {wallDetails.wallType && (
                    <tr className="print-wall-detail">
                      <td colSpan="3">Wall Type: {wallDetails.wallType}</td>
                    </tr>
                  )}
                  {wallDetails.framing && (
                    <tr className="print-wall-detail">
                      <td colSpan="3">{wallDetails.framing}</td>
                    </tr>
                  )}
                  {wallDetails.serviceWall && (
                    <tr className="print-wall-detail">
                      <td colSpan="3">{wallDetails.serviceWall}</td>
                    </tr>
                  )}
                  {wallDetails.contIns && (
                    <tr className="print-wall-detail">
                      <td colSpan="3">Continuous Ins: {wallDetails.contIns}</td>
                    </tr>
                  )}
                  {wallDetails.totalRsi && (
                    <tr className="print-wall-detail">
                      <td colSpan="3">Total Assembly RSI: {wallDetails.totalRsi}</td>
                    </tr>
                  )}
                </>
              )}
            </>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="print-row">
              <td>{row.name}</td>
              <td>{row.label}</td>
              <td className="print-pts">{row.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="print-total">
            <td>Total</td>
            <td></td>
            <td className="print-pts">{totalPoints.toFixed(1)} / {targetPoints}</td>
          </tr>
          <tr className="print-status">
            <td colSpan="3">
              {isMet
                ? `✓ ${selectedTier.label} Met`
                : `${(targetPoints - totalPoints).toFixed(1)} more points needed for ${selectedTier.label}`
              }
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="print-footer">
        Generated by ECP Calculator v1.0 — for reference only
      </div>
    </div>
  )
}
