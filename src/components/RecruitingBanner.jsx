import React, { useState } from 'react'

// Temporary recruiting banner. Hidden on and after this local calendar date.
// To remove the banner entirely, delete this component, its test, its CSS
// block in App.css, and the <RecruitingBanner /> line in App.jsx.
export const RECRUITING_END_DATE = '2026-10-24'

const STORAGE_KEY = 'ecp-recruiting-banner-dismissed'
const STORAGE_VALUE = '2026-10'

const MAILTO_HREF =
  'mailto:ryan@baselineenergy.ca?subject=ECP%20cost%20feature%20usability%20session&body=Hi%20Ryan%2C%0A%0AI%27d%20be%20interested%20in%20a%20session.%0A%0AName%3A%0ACompany%3A%0APhone%3A%0AWhat%20I%20build%3A%20'

// Local (not UTC) calendar date as YYYY-MM-DD, so Atlantic users see the
// banner end at local midnight.
function localDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function wasDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export default function RecruitingBanner({ now }) {
  const [dismissed, setDismissed] = useState(wasDismissed)

  const today = localDateString(now ?? new Date())
  if (dismissed || today >= RECRUITING_END_DATE) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VALUE)
    } catch {
      // Storage unavailable: banner stays dismissed for this session only.
    }
  }

  return (
    <section
      className="recruiting-banner"
      role="region"
      aria-label="Usability testing invitation"
    >
      <p className="recruiting-banner-text">
        <strong>Help us build the cost feature.</strong> We are adding construction costs
        to this tool and want to watch a few builders use an early version. One 45-minute
        session over Teams, in October, with a $100 gift card as thanks. Space is limited.
      </p>
      <div className="recruiting-banner-actions">
        <a className="recruiting-banner-primary" href={MAILTO_HREF}>I'm interested</a>
        <button
          type="button"
          className="recruiting-banner-secondary"
          onClick={handleDismiss}
        >
          No thanks
        </button>
      </div>
    </section>
  )
}
