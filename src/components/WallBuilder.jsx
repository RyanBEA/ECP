import React, { useState } from 'react'
import {
  categories,
  studSpacingOptions,
  cavityInsulationOptions,
  continuousInsulationOptions,
  calculateWallRsi,
  getWallPoints
} from '../data/ecpData'
import OptionButton from './OptionButton'
import WallSection from './WallSection'

const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')

// Helper to extract stud depth from cavity insulation label (e.g., "2x6 R20" -> "2x6")
const getStudDepth = (cavityIns) => {
  if (!cavityIns) return '2x6'
  return cavityIns.startsWith('2x4') ? '2x4' : '2x6'
}

// Helper to extract stud spacing as number (e.g., '16"' -> 16)
const getStudSpacingNum = (studSpacing) => {
  if (!studSpacing) return 16
  return parseInt(studSpacing.replace('"', ''), 10)
}

// Helper to extract continuous insulation thickness (e.g., '1" XPS' -> 1, 'None' -> 0)
const getContinuousInsThickness = (continuousIns) => {
  if (!continuousIns || continuousIns === 'None') return 0
  const match = continuousIns.match(/^(\d+)"/)
  return match ? parseInt(match[1], 10) : 0
}

export default function WallBuilder({ selection, onSelect }) {
  const [mode, setMode] = useState('builder') // 'simple' or 'builder'

  const { studSpacing, cavityIns, continuousIns, simpleIndex } = selection || {}

  const rsi = calculateWallRsi(studSpacing, cavityIns, continuousIns)
  const builderPoints = getWallPoints(rsi)

  // Points from simple selection
  const simplePoints = simpleIndex !== undefined && simpleIndex !== null
    ? wallCategory.options[simpleIndex].points
    : 0

  const handleModeChange = (newMode) => {
    setMode(newMode)
    onSelect({}) // Clear selection when switching modes
  }

  const handleBuilderChange = (field, value) => {
    onSelect({
      ...selection,
      simpleIndex: undefined, // Clear simple selection
      [field]: value || undefined
    })
  }

  const handleSimpleSelect = (index) => {
    onSelect({
      simpleIndex: index
    })
  }

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
            Build your wall assembly by selecting stud spacing, cavity insulation, and continuous insulation
          </p>
          <p className="wall-builder-disclaimer">
            Assumes 1/2" drywall, 7/16" OSB sheathing, and vinyl cladding.
          </p>

          <div className="wall-selectors">
            <div className="wall-selector">
              <label htmlFor="studSpacing">Stud Spacing</label>
              <select
                id="studSpacing"
                value={studSpacing || ''}
                onChange={e => handleBuilderChange('studSpacing', e.target.value)}
              >
                <option value="">Select...</option>
                {studSpacingOptions.map(opt => (
                  <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                ))}
              </select>
            </div>

            <div className="wall-selector">
              <label htmlFor="cavityIns">Cavity Insulation</label>
              <select
                id="cavityIns"
                value={cavityIns || ''}
                onChange={e => handleBuilderChange('cavityIns', e.target.value)}
              >
                <option value="">Select...</option>
                {cavityInsulationOptions.map(opt => (
                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="wall-selector">
              <label htmlFor="continuousIns">Continuous Insulation</label>
              <select
                id="continuousIns"
                value={continuousIns || ''}
                onChange={e => handleBuilderChange('continuousIns', e.target.value)}
              >
                <option value="">Select...</option>
                {continuousInsulationOptions.map(opt => (
                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="wall-result">
            {rsi ? (
              <>
                <div className="wall-rsi">
                  <span className="label">Effective RSI:</span>
                  <span className="value">{rsi.toFixed(2)}</span>
                </div>
                <div className={`wall-points ${builderPoints > 0 ? 'has-points' : ''}`}>
                  <span className="label">Points:</span>
                  <span className="value">+{builderPoints}</span>
                </div>
              </>
            ) : (
              <div className="wall-prompt">
                Select all three options to calculate RSI and points
              </div>
            )}
          </div>

          {/* Wall Section Diagram */}
          <div className="wall-section-container">
            <WallSection
              studDepth={getStudDepth(cavityIns)}
              studSpacing={getStudSpacingNum(studSpacing)}
              continuousIns={getContinuousInsThickness(continuousIns)}
            />
          </div>

          {(studSpacing || cavityIns || continuousIns) && (
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
