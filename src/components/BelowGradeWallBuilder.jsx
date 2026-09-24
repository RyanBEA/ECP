import React, { useState, useRef } from 'react'
import {
  categories,
  foundationTypes,
  concreteThicknessOptions,
  blockOptions,
  icfFormOptions,
  extInsTypes,
  intInsTypes,
  insThicknesses,
  pwfStudOptions,
  pwfSpacingOptions,
  basementStudOptions,
  studSpacingOptions,
  cavityMaterials,
  finishOptions,
  EMPTY_CAVITY,
  getBasementCavityTypes,
  getPwfCavityTypes,
  isBlownInMaterial,
  calculateBelowGradeAssembly,
  getBelowGradePoints,
  MIN_BELOW_GRADE_RSI,
} from '../data/ecpData'
import OptionButton from './OptionButton'
import FieldGroup from './FieldGroup'
import WallSection from './WallSection'

const belowGradeCategory = categories.find(c => c.id === 'belowGradeWalls')

// Defaults filled in when a foundation type is chosen. Changing the type replaces the whole
// selection with the new type's defaults, so no field from another type can survive.
export const FOUNDATION_DEFAULTS = {
  concrete: {
    foundationType: 'concrete', concreteThickness: '200', extInsThickness: 'None', intInsThickness: 'None',
    hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22', finish: 'gypsum',
  },
  block: {
    foundationType: 'block', blockType: 'normal_empty', extInsThickness: 'None', intInsThickness: 'None',
    hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22', finish: 'gypsum',
  },
  icf: { foundationType: 'icf', finish: 'gypsum' },
  pwf: {
    foundationType: 'pwf', pwfStud: '2x8', pwfSpacing: '16"', pwfCavityMaterial: 'Fiberglass Batt', pwfCavityType: '2x8 R28',
    finish: 'gypsum',
  },
}

const STUD_WALL_DEFAULTS = { studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22' }
const STUD_WALL_FIELDS = ['studSpacing', 'cavityMaterial', 'cavityType', 'studDepth', 'studOffset']

// Materials keyed by stud size ('2x6') instead of cavity type ('2x6 R22'): the UI asks for a
// stud size and the data layer reads `studDepth`.
const isBlownIn = material => Boolean(material) && material !== EMPTY_CAVITY && isBlownInMaterial(material)
const usesStudDepth = material => material === EMPTY_CAVITY || isBlownIn(material)

const hasThickness = t => Boolean(t) && t !== 'None'

// '1-1/2"' -> 1.5, '2"' -> 2, 'None' -> 0
const inchesFromLabel = (thickness) => {
  if (!thickness || thickness === 'None') return 0
  const cleaned = thickness.replace('"', '')
  if (cleaned.includes('-')) {
    const [whole, frac] = cleaned.split('-')
    const [num, den] = frac.split('/')
    return parseInt(whole, 10) + parseInt(num, 10) / parseInt(den, 10)
  }
  return parseFloat(cleaned)
}

const STUD_INCHES = { '2x4': 3.5, '2x6': 5.5, '2x8': 7.25, '2x10': 9.25 }
const spacingNum = spacing => (spacing ? parseInt(spacing.replace('"', ''), 10) : 16)
// Which stud the frame layer uses, from the fields the data layer used to find it
const frameStud = ({ cavityMaterial, cavityType, studDepth }) => {
  if (usesStudDepth(cavityMaterial)) return studDepth
  return cavityType ? cavityType.split(' ')[0] : undefined
}

// Layer list for the cross-section drawing (Task 4), outside to inside. Thicknesses are
// drawing inches, not thermal inputs; labels come from the calculated assembly so the
// drawing and the "How it adds up" list always say the same thing. [] when incomplete.
export function buildFoundationLayers(selection = {}, assembly) {
  if (!assembly || !assembly.layers) return []
  const sel = selection || {}
  const labelOf = id => assembly.layers.find(l => l.id === id)?.label
  const layers = [{ id: 'soil', kind: 'soil', label: 'soil (not counted)', thicknessInches: 2 }]

  if (sel.foundationType === 'pwf') {
    layers.push({ id: 'pwf_sheathing', kind: 'sheathing', label: labelOf('pwf_sheathing') || 'PWF plywood', thicknessInches: 0.5 })
    layers.push({
      id: 'frame', kind: 'frame', label: labelOf('frame') || 'PWF studs',
      thicknessInches: STUD_INCHES[sel.pwfStud] || 7.25,
      studDepth: sel.pwfStud, studSpacing: spacingNum(sel.pwfSpacing),
      cavityLabel: sel.pwfCavityType,
    })
  } else if (sel.foundationType === 'icf') {
    const foam = inchesFromLabel(sel.icfFormThickness)
    layers.push({ id: 'icf_foam_ext', kind: 'icf_foam', label: `${sel.icfFormThickness} EPS form`, thicknessInches: foam })
    layers.push({ id: 'icf_core', kind: 'concrete', label: labelOf('icf_core') || '152 mm concrete core', thicknessInches: 6 })
    layers.push({ id: 'icf_foam_int', kind: 'icf_foam', label: `${sel.icfFormThickness} EPS form`, thicknessInches: foam })
  } else if (sel.foundationType === 'concrete' || sel.foundationType === 'block') {
    if (hasThickness(sel.extInsThickness)) {
      layers.push({ id: 'ext_ins', kind: 'ext_ins', label: labelOf('ext_ins'), thicknessInches: inchesFromLabel(sel.extInsThickness) })
    }
    if (sel.foundationType === 'concrete') {
      layers.push({ id: 'concrete', kind: 'concrete', label: labelOf('concrete'), thicknessInches: sel.concreteThickness === '250' ? 10 : 8 })
    } else {
      layers.push({ id: 'block', kind: 'block', label: labelOf('block'), thicknessInches: 7.5 })
    }
    if (hasThickness(sel.intInsThickness)) {
      layers.push({ id: 'int_ins', kind: 'int_ins', label: labelOf('int_ins'), thicknessInches: inchesFromLabel(sel.intInsThickness) })
    }
    if (sel.hasStudWall !== false && labelOf('frame')) {
      const stud = frameStud(sel)
      layers.push({
        id: 'frame', kind: 'frame', label: labelOf('frame'),
        thicknessInches: STUD_INCHES[stud] || 5.5,
        studDepth: stud, studSpacing: spacingNum(sel.studSpacing),
        cavityLabel: sel.cavityMaterial === EMPTY_CAVITY ? 'empty cavity' : (isBlownIn(sel.cavityMaterial) ? sel.cavityMaterial : sel.cavityType),
      })
    }
  } else {
    return []
  }

  if (labelOf('finish')) {
    layers.push({ id: 'finish', kind: 'gypsum', label: labelOf('finish'), thicknessInches: 0.5 })
  }
  return layers
}

export default function BelowGradeWallBuilder({ selection, onSelect }) {
  const [mode, setMode] = useState('builder')
  const svgRef = useRef(null)

  const sel = selection || {}
  const {
    simpleIndex, foundationType, concreteThickness, blockType, icfFormThickness,
    pwfStud, pwfSpacing, pwfCavityMaterial, pwfCavityType,
    extInsType, extInsThickness, intInsType, intInsThickness,
    hasStudWall = true, studSpacing, cavityMaterial, cavityType, studDepth, studOffset = false,
    finish = 'gypsum',
  } = sel

  const isConcreteOrBlock = foundationType === 'concrete' || foundationType === 'block'
  const isIcf = foundationType === 'icf'
  const isPwf = foundationType === 'pwf'
  const hasInteriorFoam = hasThickness(intInsThickness)
  const finishLocked = isIcf || hasInteriorFoam
  const showStudWall = isConcreteOrBlock && hasStudWall
  const showOffset = showStudWall && cavityType === '2x6 R20'

  const assembly = foundationType ? calculateBelowGradeAssembly(sel) : null
  const rsi = assembly ? assembly.total : null
  const builderPoints = getBelowGradePoints(rsi)
  const belowCode = rsi !== null && Math.round(rsi * 100) / 100 < MIN_BELOW_GRADE_RSI
  const showR20Hint = isConcreteOrBlock && hasStudWall && cavityType === '2x6 R20' && studSpacing === '16"'

  const foundationLayers = buildFoundationLayers(sel, assembly)

  const handleModeChange = (newMode) => {
    setMode(newMode)
    onSelect({})
  }

  const handleFieldChange = (field, value) => {
    const v = value || undefined
    if (field === 'foundationType') {
      onSelect(v ? { ...FOUNDATION_DEFAULTS[v] } : {})
      return
    }
    if (field === 'cavityMaterial') {
      onSelect({
        ...sel, simpleIndex: undefined,
        cavityMaterial: v, cavityType: undefined, studOffset: undefined,
        studDepth: usesStudDepth(v) ? '2x6' : undefined,
      })
      return
    }
    if (field === 'cavityType') {
      onSelect({ ...sel, simpleIndex: undefined, cavityType: v, studOffset: v === '2x6 R20' ? sel.studOffset : undefined })
      return
    }
    if (field === 'pwfCavityMaterial') {
      onSelect({ ...sel, simpleIndex: undefined, pwfCavityMaterial: v, pwfCavityType: undefined })
      return
    }
    if (field === 'pwfStud') {
      onSelect({ ...sel, simpleIndex: undefined, pwfStud: v, pwfCavityType: undefined })
      return
    }
    if (field === 'intInsThickness' || field === 'intInsType') {
      const next = { ...sel, simpleIndex: undefined, [field]: v }
      // 9.10.17.10: foam must be covered, so the finish is gypsum whenever interior foam is present
      if (hasThickness(next.intInsThickness)) next.finish = 'gypsum'
      onSelect(next)
      return
    }
    onSelect({ ...sel, simpleIndex: undefined, [field]: v })
  }

  const handleStudWallToggle = (checked) => {
    if (checked) {
      onSelect({ ...sel, hasStudWall: true, ...STUD_WALL_DEFAULTS })
    } else {
      const next = { ...sel, hasStudWall: false }
      STUD_WALL_FIELDS.forEach(f => { next[f] = undefined })
      onSelect(next)
    }
  }

  const handleSimpleSelect = (index) => {
    onSelect({ simpleIndex: index })
  }

  const basementCavityTypes = getBasementCavityTypes(cavityMaterial)
  const pwfCavityTypes = getPwfCavityTypes(pwfCavityMaterial, pwfStud)

  // Dynamic group numbering, no gaps
  let groupNum = 0
  const nextGroup = () => ++groupNum

  const studWallIncomplete = showStudWall && !(studSpacing && cavityMaterial && (usesStudDepth(cavityMaterial) ? studDepth : cavityType))
  const pwfIncomplete = isPwf && !(pwfStud && pwfSpacing && pwfCavityMaterial && pwfCavityType)
  const prompt = !foundationType
    ? 'Select a foundation type to begin'
    : isIcf && !icfFormThickness
      ? 'Select form thickness to calculate RSI'
      : (studWallIncomplete || pwfIncomplete)
        ? 'Select stud wall options to calculate RSI'
        : 'No data for this combination'

  const renderSelect = (id, label, value, options, field, { disabled = false, blank = true } = {}) => (
    <div className="wall-selector">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ''} disabled={disabled} onChange={e => handleFieldChange(field, e.target.value)}>
        {blank && <option value="">Select...</option>}
        {options.map(o => {
          const optValue = typeof o === 'string' ? o : o.id
          const optLabel = typeof o === 'string' ? o : o.label
          return <option key={optValue} value={optValue}>{optLabel}</option>
        })}
      </select>
    </div>
  )

  return (
    <div className="category-card wall-builder">
      <div className="category-header">
        <h2 className="category-name">Below Grade Walls</h2>
        <span className="category-metric">RSI ({belowGradeCategory.imperial ? belowGradeCategory.imperial.unit : 'm²·K/W'})</span>
      </div>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'simple' ? 'active' : ''}`}
          onClick={() => handleModeChange('simple')}
        >
          Select RSI
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'builder' ? 'active' : ''}`}
          onClick={() => handleModeChange('builder')}
        >
          Build Assembly
        </button>
      </div>

      {mode === 'simple' ? (
        <>
          <p className="category-description">
            Select target RSI value for below-grade (foundation) walls
          </p>
          <div className="options-grid">
            {belowGradeCategory.options.map((option, index) => (
              <OptionButton
                key={index}
                option={option}
                direction="higher"
                metric="RSI"
                imperial={belowGradeCategory.imperial}
                isSelected={simpleIndex === index}
                onClick={() => handleSimpleSelect(index)}
              />
            ))}
            {simpleIndex !== undefined && simpleIndex !== null && (
              <button
                className="option-button clear-button"
                onClick={() => onSelect({})}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="category-description">
            Build your foundation wall assembly to calculate effective RSI and points
          </p>

          {/* Group 1: Foundation */}
          <FieldGroup number={nextGroup()} title="Foundation">
            <div className="wall-selectors">
              {renderSelect('bg-foundationType', 'Foundation Type', foundationType, foundationTypes, 'foundationType')}
              {foundationType === 'concrete' && renderSelect('bg-concreteThickness', 'Wall Thickness', concreteThickness, concreteThicknessOptions, 'concreteThickness')}
              {foundationType === 'block' && renderSelect('bg-blockType', 'Block Type', blockType, blockOptions, 'blockType')}
              {isIcf && renderSelect('bg-icfFormThickness', 'EPS Form Thickness (per side)', icfFormThickness, icfFormOptions, 'icfFormThickness')}
            </div>
            {isPwf && (
              <div className="wall-selectors">
                {renderSelect('bg-pwfStud', 'Stud Size', pwfStud, pwfStudOptions, 'pwfStud')}
                {renderSelect('bg-pwfSpacing', 'Stud Spacing', pwfSpacing, pwfSpacingOptions.map(s => ({ id: s, label: `${s} o.c.` })), 'pwfSpacing')}
                {renderSelect('bg-pwfCavityMaterial', 'Cavity Insulation', pwfCavityMaterial, cavityMaterials, 'pwfCavityMaterial')}
                {renderSelect('bg-pwfCavityType', 'Cavity Size', pwfCavityType, pwfCavityTypes, 'pwfCavityType')}
              </div>
            )}
          </FieldGroup>

          {/* Group 2: Exterior Insulation (concrete, block) */}
          {isConcreteOrBlock && (
            <FieldGroup number={nextGroup()} title="Exterior Insulation">
              <div className="wall-selectors">
                {renderSelect('bg-extInsType', 'Type', extInsType, extInsTypes, 'extInsType')}
                {renderSelect('bg-extInsThickness', 'Thickness', extInsThickness, insThicknesses, 'extInsThickness')}
              </div>
            </FieldGroup>
          )}

          {/* Group 3: Interior Insulation (concrete, block) */}
          {isConcreteOrBlock && (
            <FieldGroup number={nextGroup()} title="Interior Insulation">
              <div className="wall-selectors">
                {renderSelect('bg-intInsType', 'Type', intInsType, intInsTypes, 'intInsType')}
                {renderSelect('bg-intInsThickness', 'Thickness', intInsThickness, insThicknesses, 'intInsThickness')}
              </div>
            </FieldGroup>
          )}

          {/* Group 4: Interior Stud Wall (concrete, block) */}
          {isConcreteOrBlock && (
            <FieldGroup number={nextGroup()} title="Interior Stud Wall">
              <label className="service-wall-toggle">
                <input
                  type="checkbox"
                  checked={hasStudWall}
                  onChange={e => handleStudWallToggle(e.target.checked)}
                />
                {' '}Interior stud wall
              </label>
              {showStudWall && (
                <>
                  <div className="wall-selectors" style={{ marginTop: '0.5rem' }}>
                    {renderSelect('bg-studSpacing', 'Stud Spacing', studSpacing, studSpacingOptions.map(o => ({ id: o.label, label: `${o.label} o.c.` })), 'studSpacing')}
                    {renderSelect('bg-cavityMaterial', 'Cavity Insulation', cavityMaterial, [...cavityMaterials, EMPTY_CAVITY], 'cavityMaterial')}
                    {usesStudDepth(cavityMaterial)
                      ? renderSelect('bg-studDepth', 'Stud Size', studDepth, basementStudOptions, 'studDepth')
                      : renderSelect('bg-cavityType', 'Cavity Size', cavityType, basementCavityTypes, 'cavityType')}
                  </div>
                  {showOffset && (
                    <label className="service-wall-toggle" style={{ marginTop: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={studOffset}
                        onChange={e => handleFieldChange('studOffset', e.target.checked)}
                      />
                      {' '}Stud wall held off the concrete
                    </label>
                  )}
                </>
              )}
            </FieldGroup>
          )}

          {/* Group 5: Interior Finish (all types) */}
          {foundationType && (
            <FieldGroup number={nextGroup()} title="Interior Finish">
              <div className="wall-selectors">
                {renderSelect('bg-finish', 'Finish', finishLocked ? 'gypsum' : finish, finishOptions, 'finish', { disabled: finishLocked, blank: false })}
              </div>
              {finishLocked && (
                <div className="assumption-item" style={{ marginTop: '0.35rem' }}>
                  Gypsum board required over foam, 9.10.17.10
                </div>
              )}
            </FieldGroup>
          )}

          {/* Group 6: Assumptions */}
          {foundationType && (
            <FieldGroup number={nextGroup()} title="Assumptions" variant="footnote">
              <div className="assumptions-list">
                <div className="assumption-item">
                  <span className="assumption-label">Interior air film: </span>0.12 RSI
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">Exterior air film / soil: </span>not counted
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">Concrete: </span>0.0004 RSI/mm
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">Basement framing: </span>16% / 14.5% / 13% at 16" / 19.2" / 24"
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">ICF: </span>plastic ties
                </div>
              </div>
            </FieldGroup>
          )}

          {/* Notes: moisture disclaimer plus the three code notes */}
          {foundationType && (
            <div className="wall-disclaimer">
              <strong>Note:</strong> This tool calculates effective RSI for the purpose of
              determining energy conservation points only. Not all material combinations
              are appropriate from a moisture management perspective. Wall assemblies
              that combine exterior insulation with cavity insulation require careful
              consideration of vapour permeance, drying potential, and condensation
              risk. Consult a building science professional or
              the <a href="https://natural-resources.canada.ca/energy-efficiency/home-energy-efficiency/leep-nze-wall-guides" target="_blank" rel="noopener noreferrer">NRCan LEEP Wall Assembly Guides</a> before
              finalizing your wall design.
              {' '}Where foundation walls have more than one assembly, the lowest effective RSI sets the points (9.36.8.7.(4)); build the weakest wall here.
              {' '}Insulation must cover the full height of the foundation wall (9.25.2.3.(4)).
              {' '}Where the top of a foundation wall is 600 mm or more above grade on average, the above-ground portion must meet the above-ground wall RSI (9.36.8.5.(4)).
            </div>
          )}

          {/* Results */}
          <div className="wall-result">
            {rsi ? (
              <>
                <div className={`wall-rsi ${belowCode ? 'below-code' : ''}`}>
                  <span className="label">Effective RSI:</span>
                  <span className="value">{rsi.toFixed(2)} (R-{(rsi * 5.678).toFixed(1)})</span>
                </div>
                {belowCode ? (
                  <>
                    <div className="wall-rsi">
                      <span className="label">Min. RSI:</span>
                      <span className="value">{MIN_BELOW_GRADE_RSI} (R-{(MIN_BELOW_GRADE_RSI * 5.678).toFixed(1)})</span>
                    </div>
                    <div className="wall-warning">
                      Does not meet code - {(MIN_BELOW_GRADE_RSI - rsi).toFixed(2)} RSI below minimum {MIN_BELOW_GRADE_RSI}
                    </div>
                  </>
                ) : (
                  <div className={`wall-points ${builderPoints > 0 ? 'has-points' : ''}`}>
                    <span className="label">Points:</span>
                    <span className="value">+{builderPoints}</span>
                  </div>
                )}
                {showR20Hint && (
                  <div className="wall-prompt" data-testid="bg-hint" style={{ width: '100%' }}>
                    R20 at 16" o.c. does not reach the 2.98 minimum on its own; R22, 24" spacing, or exterior insulation does.
                  </div>
                )}
                <div className="assumptions-list" style={{ width: '100%', flexDirection: 'column', gap: '0.15rem' }}>
                  <div className="assumption-item"><span className="assumption-label">How it adds up</span></div>
                  <ul data-testid="bg-layers" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {assembly.layers.map(layer => (
                      <li key={layer.id} className="assumption-item">
                        {layer.label} ... {layer.rsi.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="wall-prompt">{prompt}</div>
            )}
          </div>

          {/* Cross-section drawing */}
          {assembly && foundationLayers.length > 0 && (
            <div className="wall-section-container" ref={svgRef}>
              <WallSection wallType="foundation" foundationLayers={foundationLayers} />
            </div>
          )}

          {/* Task 5: Export button calls exportFoundationAssembly(selection, svgRef.current) */}

          {/* Clear button */}
          {foundationType && (
            <button
              className="option-button clear-button"
              onClick={() => onSelect({})}
              type="button"
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  )
}
