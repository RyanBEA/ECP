import React from 'react'
import OptionButton from './OptionButton'

export default function CategoryCard({ category, selectedOption, onSelect, disabled }) {
  return (
    <div className={`category-card ${disabled ? 'disabled' : ''}`}>
      <div className="category-header">
        <h2 className="category-name">{category.name}</h2>
        <span className="category-metric">{category.metric} ({category.imperial ? category.imperial.unit : category.unit})</span>
      </div>
      <p className="category-description">{category.description}</p>
      <div className="options-grid">
        {category.options.map((option, index) => (
          <OptionButton
            key={index}
            option={option}
            direction={category.direction}
            metric={category.metric}
            imperial={category.imperial}
            isSelected={selectedOption === index}
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
