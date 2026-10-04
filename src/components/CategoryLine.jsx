import React, { useMemo } from 'react'
import Disclosure from './Disclosure'
import LineSummary from './LineSummary'
import SpecificsTable from './SpecificsTable'
import { ChevronIcon, PencilIcon } from './icons'
import { buildSpecifics } from '../costing/specifics'
export { houseNoun } from '../costing/houseText'

// One category on the Cost tab (spec rev 3 section 4): the line, its Basic view, and its specifics behind one
// chevron. Only a priced line opens. The small print's " . " separator is drawn as a dot.
function SmallPrint({ text, baselineName }) {
  const cut = text.indexOf(` . ${baselineName}:`)
  if (cut < 0) return <small className="line-small">{text}</small>
  return <small className="line-small">{text.slice(0, cut)}<span className="dot" aria-hidden="true" /> {text.slice(cut + 3)}</small>
}

export default function CategoryLine({ line, ctx, sentences, narrow, open, onToggle, specOpen, onToggleSpec, editing, onToggleEdit, onChangeHouse, onGoToPoints, tableProps }) {
  const openable = line.state === 'priced'
  const model = useMemo(() => (open && openable ? buildSpecifics(line, ctx) : null), [open, openable, line, ctx])
  const deltaCls = `line-delta ${line.delta < 0 ? 'neg' : ''} ${line.delta > 0 ? 'pos' : ''} ${line.delta === 0 ? 'z' : ''}`
  const deltaText = line.deltaText || (line.state === 'notCosted' ? 'not costed' : line.state === 'notApplicable' ? 'n/a' : 'not priced')
  const text = (
    <span className="line-text"><span className="line-name">{line.name}</span><SmallPrint text={line.smallPrint || ''} baselineName={ctx.baselineName} /></span>
  )
  return (
    <div className={`category-line ${open ? 'open' : ''} state-${line.state}`}>
      {openable
        ? <button type="button" className="line-row" aria-expanded={open} onClick={onToggle}><ChevronIcon />{text}<span className={deltaCls}>{deltaText}</span></button>
        : <div className="line-row static"><span className="chevron-space" aria-hidden="true" />{text}<span className={deltaCls}>{deltaText}</span></div>}
      {open && model && (
        <div className="line-detail">
          <LineSummary line={line} ctx={ctx} sentences={sentences} onChangeHouse={onChangeHouse} onGoToPoints={onGoToPoints} />
          <Disclosure className="specifics-disclosure" label={model.label} summary={model.summary} open={specOpen} onToggle={onToggleSpec}>
            <div className="specifics-head">
              <small>{model.caption}</small>
              <button type="button" className={`btn edit-prices ${editing ? 'primary' : ''}`} onClick={onToggleEdit}>{editing ? 'Done' : <><PencilIcon /> Use my own prices</>}</button>
            </div>
            <SpecificsTable model={model} line={line} baselineName={ctx.baselineName} narrow={narrow} editing={editing} {...tableProps} />
            <ul className="specifics-notes">{model.notes.map(n => <li key={n}>{n}</li>)}</ul>
          </Disclosure>
        </div>
      )}
    </div>
  )
}
