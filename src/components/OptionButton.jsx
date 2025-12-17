import React from 'react'

export default function OptionButton({ option, direction, metric, isSelected, onClick }) {
  const directionSymbol = direction === 'higher' ? '≥' : '≤'

  return (
    <button
      className={`option-button ${isSelected ? 'selected' : ''} ${option.label ? 'has-label' : ''}`}
      onClick={onClick}
      type="button"
    >
      {option.label && (
        <span className="option-label">{option.label}</span>
      )}
      <span className="option-value">
        {directionSymbol} {option.value}
      </span>
      <span className="option-points">
        +{option.points} pts
      </span>
    </button>
  )
}
