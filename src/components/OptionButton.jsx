import React from 'react'

export default function OptionButton({ option, direction, metric, imperial, isSelected, onClick }) {
  const directionSymbol = direction === 'higher' ? '≥' : '≤'

  const imperialText = imperial
    ? ` (${imperial.prefix || ''}${imperial.decimals === 0
        ? (Math.round(option.value * imperial.factor / (imperial.round || 1)) * (imperial.round || 1)).toLocaleString()
        : (option.value * imperial.factor).toFixed(imperial.decimals)})`
    : ''

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
        {directionSymbol} {option.value}{imperialText}
      </span>
      <span className="option-points">
        +{option.points} pts
      </span>
    </button>
  )
}
