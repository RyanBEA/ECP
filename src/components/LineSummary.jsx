import React from 'react'
import { ArrowIcon, InfoIcon } from './icons'
import { basicViewText, signedDollars, diffClass, dollars } from '../costing/specifics'

// The Basic view of an open line (spec rev 3 section 4, depth 2).
export default function LineSummary({ line, ctx, sentences, onChangeHouse, onGoToPoints }) {
  const t = basicViewText(line, ctx, sentences)
  const diff = line.design.cost - line.baseline.cost
  return (
    <div className="line-summary">
      <div className="cost-tiles">
        <div className="tile tile-design"><span>This design</span><b>{dollars(line.design.cost)}</b></div>
        <div className="tile tile-baseline"><span>{ctx.baselineName}</span><b>{dollars(line.baseline.cost)}</b></div>
        <div className="tile tile-diff"><span>Difference</span><b className={`diff ${diffClass(diff)}`}>{signedDollars(diff)}</b></div>
      </div>
      <p className="line-desc">
        <b className="who-design">This design:</b> {t.designText}.<br />
        <b className="who-baseline">{ctx.baselineName}:</b> {t.baselineText}.
      </p>
      {t.notice && (
        <div className="line-notice" role="note">
          <InfoIcon />
          <span>{t.notice.text}{t.notice.goToPoints && <> <button type="button" className="go-link" onClick={onGoToPoints}>Go to Points <ArrowIcon /></button></>}</span>
        </div>
      )}
      {t.quantity && (
        <p className="line-quantity">{t.quantity.text}
          {t.quantity.field && <> <button type="button" className="link-button" onClick={() => onChangeHouse(t.quantity.field)}>change house</button></>}
        </p>
      )}
    </div>
  )
}
