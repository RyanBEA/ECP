import React from 'react'

// Drawn icons, so user-facing text stays plain ASCII (spec rev 3 section 2).
const Svg = ({ className = '', children }) => (
  <svg className={`icon ${className}`.trim()} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">{children}</svg>
)
export const ChevronIcon = ({ className = '' }) => (
  <Svg className={`chevron ${className}`}><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></Svg>
)
export const ArrowIcon = ({ className = '' }) => (
  <Svg className={className}><path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></Svg>
)
export const PencilIcon = ({ className = '' }) => (
  <Svg className={className}><path d="M10.8 2.7l2.5 2.5-7.9 7.9-3.2.7.7-3.2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></Svg>
)
export const InfoIcon = ({ className = '' }) => (
  <Svg className={className}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7.3v4M8 4.7v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Svg>
)
