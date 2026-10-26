import React from 'react'
import { ArrowIcon, InfoIcon } from './icons'
import { basicViewText, signedDollars, diffClass, dollars } from '../costing/specifics'

// The quantity sentence of an open line, with its "change house" link.
export function QuantityLine({ quantity, onChangeHouse }) {
  if (!quantity) return null
  return (
    <p className="line-quantity">{quantity.text}
      {quantity.field && <> <button type="button" className="link-button" onClick={() => onChangeHouse(quantity.field)}>change house</button></>}
    </p>
  )
}

// The Basic view of an open line (spec rev 3 section 4, depth 2). Round 1 variants drop the tiles and the quantity line.
export default function LineSummary({ line, ctx, sentences, onChangeHouse, onGoToPoints, tiles = true, quantity = true }) {
  const t = basicViewText(line, ctx, sentences)
  const diff = line.design.cost - line.baseline.cost
  return (
    <div className="line-summary">
      {tiles && <div className="cost-tiles">
        <div className="tile tile-design"><span>This design</span><b>{dollars(line.design.cost)}</b></div>
        <div className="tile tile-baseline"><span>{ctx.baselineName}</span><b>{dollars(line.baseline.cost)}</b></div>
        <div className="tile tile-diff"><span>Difference</span><b className={`diff ${diffClass(diff)}`}>{signedDollars(diff)}</b></div>
      </div>}
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
      {quantity && <QuantityLine quantity={t.quantity} onChangeHouse={onChangeHouse} />}
    </div>
  )
}
