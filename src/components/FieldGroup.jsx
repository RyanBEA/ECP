import React from 'react'

export default function FieldGroup({ number, title, variant = 'default', children }) {
  const className = `field-group${variant === 'footnote' ? ' footnote' : ''}`
  return (
    <div className={className}>
      <div className="field-group-head">
        <div className="field-group-num">{number}</div>
        <div className="field-group-title">{title}</div>
      </div>
      {children}
    </div>
  )
}
