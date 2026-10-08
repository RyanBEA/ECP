// src/components/ResultScreen.jsx
import React, { useState, useEffect } from 'react'
import { ArrowIcon } from './icons'
import { considerSummary } from '../optimize/considerText'
import { SECOND_LINE } from '../costing/delta'

// Screen 2 of the Optimize tab (Capability 2 spec 5.2 to 5.4, 6).
export default function ResultScreen({ result, consider, stale, onRun, onChange, onApply, canRestore, onRestore, blocked }) {
  const [view, setView] = useState(result)
  useEffect(() => { setView(result) }, [result])
  if (!view) return null
  const { winner, runnersUp, before, headline, reaches, tierLabel, tierPoints } = view
  const pkg = winner
  return (
    <section className="cost-statement optimize-result">
      <div className="cost-card summary-line">
        <span className="considering">Considering: {considerSummary(consider)}.</span>
        <button type="button" className="link-btn" onClick={onChange}>Change <ArrowIcon /></button>
      </div>
      <div className="cost-card headline-card">
        {stale && (
          <div className="stale-notice" role="status">
            <span>Your inputs changed.</span>
            <button type="button" className="btn" disabled={!!blocked} onClick={onRun}>Find again</button>
            {blocked && <p className="costing-note blocked">{blocked}</p>}
          </div>
        )}
        <h2 className="headline">{headline}</h2>
        {!reaches && pkg && <p>The closest package reaches {pkg.points.toFixed(1)} points; {tierLabel} needs {tierPoints}. <button type="button" className="btn" onClick={onChange}>Change what to consider</button></p>}
        {reaches && pkg && <p>{before.text} The package below reaches {pkg.points.toFixed(1)} points; {tierLabel} needs {tierPoints}.</p>}
        <p className="costing-note">{SECOND_LINE} Rounded to $500, before HST.</p>
        {view.coveredText && <p className="costing-note">{view.coveredText}</p>}
      </div>
      {pkg && (
        <div className="cost-card">
          <p className="card-title">{view.shownAlternative ? 'An alternative' : 'The package'}</p>
          <table className="package-table" aria-label="The package">
            <thead><tr><th>Card</th><th>Pick</th><th>Points</th><th className="r">vs {view.baselineName}</th></tr></thead>
            <tbody>
              {pkg.lines.map(l => (
                <tr key={l.cardId} className={`state-${l.state}`}>
                  <td>{l.name}</td>
                  <td>
                    {l.label}
                    {l.state === 'searched' && <span className="chg">{l.changed ? 'change' : 'same as yours'}</span>}
                    {l.changed && l.startingLabel && <span className="you">you have: {l.startingLabel}{l.startingDeltaText ? `, ${l.startingDeltaText}` : ''}</span>}
                    {l.note && <span className="you">{l.note}</span>}
                  </td>
                  <td>{l.points.toFixed(1)}</td>
                  <td className="r">{l.deltaText}</td>
                </tr>
              ))}
              <tr className="total"><td colSpan={2}>Total</td><td>{pkg.points.toFixed(1)}</td><td className="r">{pkg.deltaText}</td></tr>
            </tbody>
          </table>
          {reaches && (
            <div className="optimize-actions row">
              {canRestore
                ? <button type="button" className="btn" onClick={onRestore}>Restore my design</button>
                : <button type="button" className="btn primary" onClick={() => onApply(pkg)}>Put this on the Points tab</button>}
              <span className="costing-note">{canRestore ? 'Your previous picks come back.' : 'Replaces your current picks. "Restore my design" brings them back.'}</span>
            </div>
          )}
        </div>
      )}
      {reaches && runnersUp.length > 0 && (
        <div className="cost-card">
          <p className="card-title">Other ways to get there</p>
          <p className="card-sub">The next cheapest packages that use a different wall. Click one to see it in full above.</p>
          {runnersUp.map((r, i) => {
            const wallLabel = r.lines.find(l => l.cardId === 'aboveGroundWalls')?.label
            const differs = r.lines.filter(l => l.state === 'searched' && l.cardId !== 'aboveGroundWalls'
              && l.label !== pkg.lines.find(w => w.cardId === l.cardId)?.label).map(l => l.label)
            const picks = differs.length > 0 ? differs.join('; ') : 'same picks, different wall'
            return (
              <div key={r.pkg.index} className="alt-row">
                <div>
                  <div>{wallLabel}</div>
                  <div className="alt-detail">{picks}; {r.points.toFixed(1)} points</div>
                </div>
                <div className="alt-cost"><b>{r.deltaText}</b> <button type="button" className="btn" aria-label={`Show the ${wallLabel} package`} onClick={() => setView(view.show(i))}>Show</button></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
