import React, { useState, useRef } from 'react'
import {
  categories,
  wallTypes,
  studSpacingOptions,
  cavityMaterials,
  cavityTypesByMaterial,
  continuousInsTypes,
  continuousInsThicknesses,
  icfFormOptions,
  framedWallRsi,
  calculateWallRsi,
  getWallPoints,
  getBoundaryOptions,
  MIN_WALL_RSI
} from '../data/ecpData'

const boundaryOpts = getBoundaryOptions()
import OptionButton from './OptionButton'
import FieldGroup from './FieldGroup'
import WallSection from './WallSection'
import { exportWallAssembly } from '../utils/exportWallAssembly'

const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')

// Extract stud depth from cavity type label (e.g., "2x6 R20" -> "2x6", "2x3-5/8 R12" -> "2x4")
const getStudDepth = (cavityType) => {
  if (!cavityType) return '2x6'
  if (cavityType.startsWith('2x4') || cavityType.startsWith('2x3-5/8')) return '2x4'
  if (cavityType.startsWith('2x8')) return '2x8'
  if (cavityType.startsWith('2x10')) return '2x10'
  if (cavityType.startsWith('2x12')) return '2x12'
  return '2x6'
}

// Extract stud spacing as number (e.g., '16"' -> 16)
const getStudSpacingNum = (studSpacing) => {
  if (!studSpacing) return 16
  return parseInt(studSpacing.replace('"', ''), 10)
}

// Get continuous insulation thickness in inches from thickness label
const getContInsThicknessNum = (thickness) => {
  if (!thickness || thickness === 'None') return 0
  // Handle fractions: '1-1/2"' -> 1.5, '2-1/2"' -> 2.5
  const cleaned = thickness.replace('"', '')
  if (cleaned.includes('-')) {
    const [whole, frac] = cleaned.split('-')
    const [num, den] = frac.split('/')
    return parseInt(whole) + parseInt(num) / parseInt(den)
  }
  return parseFloat(cleaned)
}

// Get available cavity types for current material (filtered by lookup table)
const getAvailableCavityTypes = (wallType, studSpacing, cavityMaterial) => {
  const materialTypes = cavityTypesByMaterial[cavityMaterial] || []
  if (!wallType || wallType === 'icf' || !studSpacing || !cavityMaterial) return materialTypes
  const lookup = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]
  if (!lookup) return []
  return materialTypes.filter(ct => lookup[ct] != null)
}

const studDepthMm = { '2x4': 89, '2x6': 140, '2x8': 184, '2x10': 235, '2x12': 286 }
const plateOptions = ['2x8', '2x10', '2x12']
const doubleStudSizes = ['2x4', '2x6']
const blownInMaterials = ['Dense Pack Cellulose', 'Loose Fill Cellulose', 'Loose Fill Fiberglass']

// Auto-defaults: populate when wall type / assembly / toggles change
// ICF has no auto-defaults beyond wallType; EPS form thickness is selected manually
const DEFAULTS = {
  singleStud: {
    studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
  },
  doubleStud: {
    studSpacing: '16"', outerStud: '2x4', innerStud: '2x4',
    plate: '2x10', doubleStudMaterial: 'Loose Fill Cellulose',
  },
  serviceWall: {
    serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt', serviceCavityType: '2x4 R12',
  },
  interiorLayer: {
    interiorLayerMaterial: 'osb_11',
  },
  // Exterior defaults are wall-type-aware (from boundary-options.json)
  exterior: (wallType) => ({
    claddingId: boundaryOpts.cladding.defaults[wallType],
    ...(boundaryOpts.sheathing.applies_to.includes(wallType)
      ? { sheathingId: boundaryOpts.sheathing.default }
      : {}),
  }),
}

export default function WallBuilder({ selection, onSelect }) {
  const [mode, setMode] = useState('builder')
  const wallSectionRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const svgEl = wallSectionRef.current?.querySelector('svg')
      await exportWallAssembly(selection, svgEl)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const {
    wallType, studSpacing, cavityMaterial, cavityType,
    contInsType, contInsThickness, icfFormThickness, simpleIndex,
    assemblyType = 'single',
    outerStud, innerStud, plate, doubleStudMaterial,
    hasServiceWall = false,
    serviceSpacing, serviceCavityMaterial, serviceCavityType,
    interiorLayerMaterial, interiorLayerThickness,
  } = selection || {}

  const rsi = calculateWallRsi(selection || {})
  const builderPoints = getWallPoints(rsi)
  const belowCode = rsi !== null && rsi < MIN_WALL_RSI

  const simplePoints = simpleIndex !== undefined && simpleIndex !== null
    ? wallCategory.options[simpleIndex].points
    : 0

  const handleModeChange = (newMode) => {
    setMode(newMode)
    onSelect({})
  }

  const handleFieldChange = (field, value) => {
    if (field === 'wallType') {
      if (!value) {
        onSelect({})
        return
      }
      // Wood defaults to single stud with full framing + exterior defaults
      if (value === 'wood') {
        onSelect({
          wallType: value,
          assemblyType: 'single',
          ...DEFAULTS.singleStud,
          ...DEFAULTS.exterior(value),
        })
        return
      }
      // Steel defaults to single stud framing + exterior defaults
      if (value === 'steel') {
        onSelect({
          wallType: value,
          ...DEFAULTS.singleStud,
          ...DEFAULTS.exterior(value),
        })
        return
      }
      // ICF — no auto-defaults; EPS form thickness selected manually
      onSelect({ wallType: value })
      return
    }
    if (field === 'cavityMaterial') {
      // Material change clears cavity type (available options differ per material)
      onSelect({
        ...selection,
        simpleIndex: undefined,
        cavityMaterial: value || undefined,
        cavityType: undefined
      })
      return
    }
    if (field === 'interiorLayerMaterial') {
      onSelect({
        ...selection,
        simpleIndex: undefined,
        interiorLayerMaterial: value || undefined,
        interiorLayerThickness: undefined,
      })
      return
    }
    if (field === 'serviceCavityMaterial') {
      onSelect({
        ...selection,
        simpleIndex: undefined,
        serviceCavityMaterial: value || undefined,
        serviceCavityType: undefined,
      })
      return
    }
    onSelect({
      ...selection,
      simpleIndex: undefined,
      [field]: value || undefined
    })
  }

  const handleSimpleSelect = (index) => {
    onSelect({ simpleIndex: index })
  }

  const isFramedWall = wallType === 'wood' || wallType === 'steel'
  const isIcf = wallType === 'icf'
  const isSingleWall = assemblyType === 'single'
  const isDoubleStud = assemblyType === 'doubleStud'
  const availableCavityTypes = getAvailableCavityTypes(wallType, studSpacing, cavityMaterial)
  const serviceAvailableCavityTypes = getAvailableCavityTypes('wood', serviceSpacing, serviceCavityMaterial)

  // For double stud: filter plate options to those wider than outer + inner studs
  const availablePlates = plateOptions.filter(p => {
    const outerMm = studDepthMm[outerStud] || 89
    const innerMm = studDepthMm[innerStud] || 89
    return studDepthMm[p] > outerMm + innerMm
  })

  // Dynamic group numbering — no gaps
  let groupNum = 0
  const nextGroup = () => ++groupNum

  return (
    <div className="category-card wall-builder">
      <div className="category-header">
        <h2 className="category-name">Above Ground Walls</h2>
        <span className="category-metric">RSI (m²·K/W)</span>
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
            Select target RSI value for above-grade walls
          </p>
          <div className="options-grid">
            {wallCategory.options.map((option, index) => (
              <OptionButton
                key={index}
                option={option}
                direction="higher"
                metric="RSI"
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
            Build your wall assembly to calculate effective RSI and points
          </p>

          {/* Group 1: Wall Configuration — always visible */}
          <FieldGroup number={nextGroup()} title="Wall Configuration">
            <div className="wall-selectors">
              <div className="wall-selector">
                <label htmlFor="wallType">Wall Type</label>
                <select
                  id="wallType"
                  value={wallType || ''}
                  onChange={e => handleFieldChange('wallType', e.target.value)}
                >
                  <option value="">Select...</option>
                  {wallTypes.map(wt => (
                    <option key={wt.id} value={wt.id}>{wt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {wallType === 'wood' && (
              <>
                <div className="option-group" style={{ marginBottom: '0.5rem' }}>
                  {[
                    { id: 'single', label: 'Single Stud' },
                    { id: 'doubleStud', label: 'Double Stud' },
                  ].map(at => (
                    <button
                      key={at.id}
                      type="button"
                      className={`option-button ${assemblyType === at.id ? 'selected' : ''}`}
                      onClick={() => {
                        const base = { wallType, assemblyType: at.id }
                        if (at.id === 'single') {
                          onSelect({ ...base, ...DEFAULTS.singleStud, ...DEFAULTS.exterior('wood') })
                        } else {
                          onSelect({ ...base, ...DEFAULTS.doubleStud, ...DEFAULTS.exterior('wood') })
                        }
                      }}
                    >
                      {at.label}
                    </button>
                  ))}
                </div>
                <label className="service-wall-toggle">
                  <input
                    type="checkbox"
                    checked={hasServiceWall}
                    onChange={e => {
                      if (e.target.checked) {
                        onSelect({
                          ...selection,
                          hasServiceWall: true,
                          ...DEFAULTS.serviceWall,
                          ...DEFAULTS.interiorLayer,
                          contInsType: undefined,
                          contInsThickness: undefined,
                        })
                      } else {
                        onSelect({
                          ...selection,
                          hasServiceWall: false,
                          serviceSpacing: undefined,
                          serviceCavityMaterial: undefined,
                          serviceCavityType: undefined,
                          interiorLayerMaterial: undefined,
                          interiorLayerThickness: undefined,
                        })
                      }
                    }}
                  />
                  {' '}Interior Service Wall
                </label>
              </>
            )}
          </FieldGroup>

          {/* Group 2: Service Wall — conditional */}
          {hasServiceWall && (
            <FieldGroup number={nextGroup()} title="Service Wall">
              <div className="wall-selectors">
                <div className="wall-selector">
                  <label htmlFor="serviceSpacing">Stud Spacing</label>
                  <select
                    id="serviceSpacing"
                    value={serviceSpacing || ''}
                    onChange={e => handleFieldChange('serviceSpacing', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {studSpacingOptions.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                    ))}
                  </select>
                </div>
                <div className="wall-selector">
                  <label htmlFor="serviceCavityMaterial">Cavity Insulation</label>
                  <select
                    id="serviceCavityMaterial"
                    value={serviceCavityMaterial || ''}
                    onChange={e => handleFieldChange('serviceCavityMaterial', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {cavityMaterials.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>
                <div className="wall-selector">
                  <label htmlFor="serviceCavityType">Cavity Size</label>
                  <select
                    id="serviceCavityType"
                    value={serviceCavityType || ''}
                    onChange={e => handleFieldChange('serviceCavityType', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {serviceAvailableCavityTypes.map(ct => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FieldGroup>
          )}

          {/* Group 3: Main Wall — conditional on wallType */}
          {wallType && (
            <FieldGroup number={nextGroup()} title={isDoubleStud && wallType === 'wood' ? 'Main Wall — Double Stud' : 'Main Wall'}>
              {/* Framed walls (wood or steel) */}
              {isFramedWall && (
                <>
                  <div className="sub-label">Framing</div>
                  <div className="wall-selectors">
                    {isSingleWall ? (
                      <>
                        <div className="wall-selector">
                          <label htmlFor="studSpacing">Stud Spacing</label>
                          <select
                            id="studSpacing"
                            value={studSpacing || ''}
                            onChange={e => handleFieldChange('studSpacing', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {studSpacingOptions.map(opt => (
                              <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="cavityMaterial">Cavity Insulation</label>
                          <select
                            id="cavityMaterial"
                            value={cavityMaterial || ''}
                            onChange={e => handleFieldChange('cavityMaterial', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {cavityMaterials.map(mat => (
                              <option key={mat} value={mat}>{mat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="cavityType">Cavity Size</label>
                          <select
                            id="cavityType"
                            value={cavityType || ''}
                            onChange={e => handleFieldChange('cavityType', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {availableCavityTypes.map(ct => (
                              <option key={ct} value={ct}>{ct}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (isDoubleStud && wallType === 'wood') ? (
                      <>
                        <div className="wall-selector">
                          <label htmlFor="studSpacing">Stud Spacing</label>
                          <select
                            id="studSpacing"
                            value={studSpacing || ''}
                            onChange={e => handleFieldChange('studSpacing', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {studSpacingOptions.map(opt => (
                              <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="outerStud">Outer Studs</label>
                          <select
                            id="outerStud"
                            value={outerStud || ''}
                            onChange={e => handleFieldChange('outerStud', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {doubleStudSizes.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="innerStud">Inner Studs</label>
                          <select
                            id="innerStud"
                            value={innerStud || ''}
                            onChange={e => handleFieldChange('innerStud', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {doubleStudSizes.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="plate">Plate Width</label>
                          <select
                            id="plate"
                            value={plate || ''}
                            onChange={e => handleFieldChange('plate', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {availablePlates.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="wall-selector">
                          <label htmlFor="doubleStudMaterial">Insulation</label>
                          <select
                            id="doubleStudMaterial"
                            value={doubleStudMaterial || ''}
                            onChange={e => handleFieldChange('doubleStudMaterial', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {blownInMaterials.map(mat => (
                              <option key={mat} value={mat}>{mat}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              )}

              {/* Continuous insulation — single stud, no service wall only */}
              {isFramedWall && isSingleWall && !hasServiceWall && (
                <>
                  <div className="sub-label">Continuous Insulation</div>
                  <div className="wall-selectors">
                    <div className="wall-selector">
                      <label htmlFor="contInsType">Type</label>
                      <select
                        id="contInsType"
                        value={contInsType || ''}
                        onChange={e => handleFieldChange('contInsType', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {continuousInsTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="wall-selector">
                      <label htmlFor="contInsThickness">Thickness</label>
                      <select
                        id="contInsThickness"
                        value={contInsThickness || ''}
                        onChange={e => handleFieldChange('contInsThickness', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {continuousInsThicknesses.map(th => (
                          <option key={th} value={th}>{th}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Exterior — framed walls only */}
              {isFramedWall && (
                <>
                  <div className="sub-label">Exterior</div>
                  <div className="wall-selectors">
                    {boundaryOpts.sheathing.applies_to.includes(wallType) && (
                      <div className="wall-selector">
                        <label htmlFor="sheathingId">Exterior Sheathing</label>
                        <select
                          id="sheathingId"
                          value={selection?.sheathingId || boundaryOpts.sheathing.default}
                          onChange={e => handleFieldChange('sheathingId', e.target.value)}
                        >
                          {boundaryOpts.sheathing.options.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="wall-selector">
                      <label htmlFor="claddingId">Cladding</label>
                      <select
                        id="claddingId"
                        value={selection?.claddingId || boundaryOpts.cladding.defaults[wallType || 'wood']}
                        onChange={e => handleFieldChange('claddingId', e.target.value)}
                      >
                        {boundaryOpts.cladding.options.map(o => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ICF — just form thickness */}
              {isIcf && (
                <div className="wall-selectors">
                  <div className="wall-selector">
                    <label htmlFor="icfFormThickness">EPS Form Thickness (per side)</label>
                    <select
                      id="icfFormThickness"
                      value={icfFormThickness || ''}
                      onChange={e => handleFieldChange('icfFormThickness', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {icfFormOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </FieldGroup>
          )}

          {/* Group 4: Interior Layer — conditional on hasServiceWall */}
          {hasServiceWall && (
            <FieldGroup number={nextGroup()} title="Interior Layer">
              <div className="wall-selectors">
                <div className="wall-selector">
                  <label htmlFor="interiorLayerMaterial">Material</label>
                  <select
                    id="interiorLayerMaterial"
                    value={interiorLayerMaterial || ''}
                    onChange={e => handleFieldChange('interiorLayerMaterial', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <optgroup label="Sheathing">
                      {boundaryOpts.sheathing.options.map(o => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Rigid Insulation">
                      {continuousInsTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {interiorLayerMaterial && !boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial) && (
                  <div className="wall-selector">
                    <label htmlFor="interiorLayerThickness">Thickness</label>
                    <select
                      id="interiorLayerThickness"
                      value={interiorLayerThickness || ''}
                      onChange={e => handleFieldChange('interiorLayerThickness', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {continuousInsThicknesses.filter(t => t !== 'None').map(th => (
                        <option key={th} value={th}>{th}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </FieldGroup>
          )}

          {/* Group 5: Assumptions — when wallType is set */}
          {wallType && (
            <FieldGroup number={nextGroup()} title="Assumptions" variant="footnote">
              <div className="assumptions-list">
                <div className="assumption-item">
                  <span className="assumption-label">Drywall: </span>1/2" gypsum
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">Interior air film: </span>
                  {boundaryOpts.air_films.inside} RSI
                </div>
                <div className="assumption-item">
                  <span className="assumption-label">Exterior air film: </span>
                  {boundaryOpts.air_films.outside} RSI
                </div>
              </div>
            </FieldGroup>
          )}

          {/* Results */}
          <div className="wall-result">
            {rsi ? (
              <>
                <div className={`wall-rsi ${belowCode ? 'below-code' : ''}`}>
                  <span className="label">Effective RSI:</span>
                  <span className="value">{rsi.toFixed(2)}</span>
                </div>
                {belowCode ? (
                  <>
                    <div className="wall-rsi">
                      <span className="label">Min. RSI:</span>
                      <span className="value">{MIN_WALL_RSI}</span>
                    </div>
                    <div className="wall-warning">
                      ⚠ Does not meet code — {(MIN_WALL_RSI - rsi).toFixed(2)} below minimum
                    </div>
                  </>
                ) : (
                  <div className={`wall-points ${builderPoints > 0 ? 'has-points' : ''}`}>
                    <span className="label">Points:</span>
                    <span className="value">+{builderPoints}</span>
                  </div>
                )}
              </>
            ) : wallType ? (
              <div className="wall-prompt">
                {rsi === null && wallType && (isFramedWall
                  ? (studSpacing && cavityMaterial && cavityType
                    ? 'No data for this combination'
                    : 'Select framing options to calculate RSI')
                  : 'Select form thickness to calculate RSI'
                )}
              </div>
            ) : (
              <div className="wall-prompt">
                Select a wall type to begin
              </div>
            )}
          </div>

          {/* Wall Section Diagram */}
          {isFramedWall && wallType === 'wood' && (() => {
            // Determine if we have enough info to show diagram
            const hasPrimaryInfo = isSingleWall
              ? (studSpacing && cavityType)
              : (isDoubleStud && studSpacing && outerStud && innerStud && plate && doubleStudMaterial)
            const hasServiceInfo = !hasServiceWall || (serviceSpacing && serviceCavityType)
            if (!hasPrimaryInfo) return null

            // Compute gap for double stud (plate depth - outer - inner)
            const dsGapInches = isDoubleStud
              ? ((studDepthMm[plate] || 0) - (studDepthMm[outerStud] || 89) - (studDepthMm[innerStud] || 89)) / 25.4
              : 0

            // Interior layer thickness in inches (0 for sheathing, actual for foam)
            const isFoam = interiorLayerMaterial && !boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial)
            const intLayerThickInches = isFoam ? getContInsThicknessNum(interiorLayerThickness) : 0
            // Sheathing interior layer: use fixed ~0.44" (11mm) visual thickness
            const intLayerVisualThick = interiorLayerMaterial
              ? (isFoam ? intLayerThickInches : 0.44)
              : 0

            const intLayerLabelText = interiorLayerMaterial
              ? (isFoam
                ? `${interiorLayerThickness || ''} ${interiorLayerMaterial}`
                : boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial)?.label)
              : null

            return (
              <div className="wall-section-container" ref={wallSectionRef}>
                <WallSection
                  wallType={wallType}
                  studDepth={isSingleWall ? getStudDepth(cavityType) : '2x6'}
                  studSpacing={getStudSpacingNum(studSpacing)}
                  continuousIns={!hasServiceWall && isSingleWall ? getContInsThicknessNum(contInsThickness) : 0}
                  cavityInsLabel={isSingleWall ? cavityType : doubleStudMaterial}
                  continuousInsLabel={!hasServiceWall && isSingleWall && contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
                  claddingLabel={boundaryOpts.cladding.options.find(o => o.id === (selection?.claddingId || boundaryOpts.cladding.defaults[wallType]))?.label}
                  sheathingLabel={boundaryOpts.sheathing.options.find(o => o.id === (selection?.sheathingId || boundaryOpts.sheathing.default))?.label}
                  assemblyType={assemblyType}
                  hasServiceWall={hasServiceWall && hasServiceInfo}
                  outerStudDepth={outerStud || '2x4'}
                  innerStudDepth={innerStud || '2x4'}
                  gapInches={dsGapInches}
                  serviceStudDepth={getStudDepth(serviceCavityType)}
                  serviceSpacingInches={getStudSpacingNum(serviceSpacing)}
                  serviceCavityLabel={serviceCavityType}
                  interiorLayerLabel={intLayerLabelText}
                  interiorLayerThicknessInches={intLayerVisualThick}
                />
              </div>
            )
          })()}

          {/* Steel single wall diagram (unchanged) */}
          {wallType === 'steel' && studSpacing && cavityType && (
            <div className="wall-section-container" ref={wallSectionRef}>
              <WallSection
                wallType="steel"
                studDepth={getStudDepth(cavityType)}
                studSpacing={getStudSpacingNum(studSpacing)}
                continuousIns={getContInsThicknessNum(contInsThickness)}
                cavityInsLabel={cavityType}
                continuousInsLabel={contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
                claddingLabel={boundaryOpts.cladding.options.find(o => o.id === (selection?.claddingId || boundaryOpts.cladding.defaults.steel))?.label}
              />
            </div>
          )}

          {isIcf && icfFormThickness && (
            <div className="wall-section-container" ref={wallSectionRef}>
              <WallSection
                wallType="icf"
                icfFormThickness={getContInsThicknessNum(icfFormThickness)}
              />
            </div>
          )}

          {/* Export to Excel button */}
          {rsi !== null && (
            <button
              className="option-button export-button"
              onClick={handleExport}
              disabled={exporting}
              type="button"
            >
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          )}

          {/* Clear button */}
          {wallType && (
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
