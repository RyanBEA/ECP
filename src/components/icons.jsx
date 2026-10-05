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
export const SunIcon = ({ className = '' }) => (
  <Svg className={`sun ${className}`}><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Svg>
)
export const MoonIcon = ({ className = '' }) => (
  <Svg className={`moon ${className}`}><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></Svg>
)
