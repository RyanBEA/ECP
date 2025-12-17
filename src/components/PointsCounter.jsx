import React from 'react'

export default function PointsCounter({ total, target }) {
  const isComplete = total >= target

  return (
    <div className={`points-counter ${isComplete ? 'complete' : ''}`}>
      <span className="points-value">{total.toFixed(1)}</span>
      <span className="points-separator">/</span>
      <span className="points-target">{target}</span>
      <span className="points-label">ECP</span>
    </div>
  )
}
