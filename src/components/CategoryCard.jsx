import React from 'react'
import OptionButton from './OptionButton'

export default function CategoryCard({ category, selectedOption, onSelect, disabled, variant = 'design', presetValue, presetName }) {
  const isBaseline = variant === 'baseline'
  // Baseline editor only (spec 5.1): a preset value that is not one of the options gets a
  // read-only 0-pt row, pressed while no option is picked and the card is not disabled (R33).
  const showPresetRow = isBaseline && presetValue !== undefined && !category.options.some(o => o.value === presetValue)
  const presetPressed = selectedOption === null && !disabled
  return (
    <div className={`category-card ${disabled ? 'disabled' : ''}${isBaseline ? ' baseline' : ''}`}>
      <div className="category-header">
        <h2 className="category-name">{category.name}</h2>
        <span className="category-metric">{category.metric}{category.metric ? ' ' : ''}{category.imperial?.replaceUnit ? `(${category.imperial.unit})` : `${category.unit}${category.imperial ? ` (${category.imperial.unit})` : ''}`}</span>
      </div>
      <p className="category-description">{category.description}</p>
      <div className="options-grid">
        {showPresetRow && (
          <button
            className={`option-button preset-row${presetPressed ? ' selected' : ''}`}
            aria-pressed={presetPressed}
            onClick={() => !disabled && onSelect(category.id, null)}
            type="button"
          >
            {`${presetName}: ${category.metric ? `${category.metric} ` : ''}${presetValue} (0 pts)`}
          </button>
        )}
        {category.options.map((option, index) => (
          <OptionButton
            key={index}
            option={option}
            direction={category.direction}
            metric={category.metric}
            imperial={category.imperial}
            isSelected={selectedOption === index}
            variant={variant}
            onClick={() => !disabled && onSelect(category.id, index)}
          />
        ))}
        {selectedOption !== null && (
          <button
            className="option-button clear-button"
            onClick={() => !disabled && onSelect(category.id, null)}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
