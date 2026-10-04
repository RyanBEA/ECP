import React, { useEffect, useMemo, useState } from 'react'
import HouseFields, { HIDDEN_FIELD_KEYS, houseSummary } from './HouseFields'
import BaselinePicker, { picksSmallPrint } from './BaselinePicker'
import CategoryLine from './CategoryLine'
import Disclosure from './Disclosure'
import useNarrow from './useNarrow'
import { PRICE_SOURCE_LABEL } from '../costSystem/client'
import { formatDelta, SQFT_PER_M2 } from '../costing/units'
import { getArchetype } from '../costing/archetypes'
import { appliedOverrideKeys } from '../costing/priceHouse'

// The Cost tab (spec rev 3 section 3). The table emits typed values in display units ($/sq ft for m2); stored
// overrides are $/m2, so those are converted here; 'each' and 'house' values and a reset pass through (R3 amended).
const toStored = (v, unit) => (v === undefined || unit !== 'm2' ? v : v * SQFT_PER_M2)
function componentUnit(line, side, component) {
  const primary = side === 'both' ? line.design : line[side]
  const other = primary === line.design ? line.baseline : line.design
  const find = r => r?.components?.find(c => c.component === component)?.unit
  return find(primary) ?? find(other)
}
const lineUnit = (line, side) => line[side]?.unit ?? line.design.unit
// Applied override keys on this card, both houses, counted once (R36).
function changedCountFor(line) {
  const id = line.categoryId
  const keys = new Set([...appliedOverrideKeys({ [id]: line.design }), ...appliedOverrideKeys({ [id]: line.baseline })])
  return [...keys].filter(k => k.split('/')[1] === id).length
}

export default function CostTab(props) {
  const { cost, houseType, houseFields, overriddenKeys, baselineChoice, usualHouse, overrideCount, onTypeChange, onFieldChange, onBaselineChoice, onEditUsual, onResetUsual,
    onViewBaselineCard = () => {}, onGoToPoints = () => {}, onOverride, onLineOverride, onResetAllOverrides, onResetCategoryOverrides = () => {},
    chipHidden, onToggleChip, openLine, onOpenLine, onFreezeOrder, notice } = props
  const narrowNow = useNarrow()
  const narrow = props.narrow ?? narrowNow
  // The line whose specifics are open is App state beside openLine (R45); without the props, CostTab keeps it.
  const [ownSpec, setOwnSpec] = useState(null)
  const controlled = props.onLevel3 !== undefined
  const specLine = controlled ? props.level3 ?? null : ownSpec
  const setSpecLine = controlled ? props.onLevel3 : setOwnSpec
  const [editLine, setEditLine] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  // The baseline disclosures are App state too (survive the editor, like level3); without the props CostTab keeps them.
  const [ownIncludes, setOwnIncludes] = useState(false)
  const [ownBaseStrip, setOwnBaseStrip] = useState(false)
  const includesOpen = props.includesOpen ?? ownIncludes
  const setIncludesOpen = props.onIncludesOpen ?? setOwnIncludes
  const baseStrip = props.baseStrip ?? ownBaseStrip
  const setBaseStrip = props.onBaseStrip ?? setOwnBaseStrip
  const [houseStrip, setHouseStrip] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const { delta, sentences, baselineName } = cost
  const hasUsual = Boolean(usualHouse?.[houseType])
  const typeName = getArchetype(houseType)?.name ?? houseType
  const ctx = useMemo(() => ({ baselineName, quantities: cost.quantities, houseFields, designPicks: cost.designPicks, baselinePicks: cost.baselinePicks, typeName }),
    [baselineName, cost.quantities, houseFields, cost.designPicks, cost.baselinePicks, typeName])

  // An open line that stops being priced (e.g. Type -> Mini-home with Below-grade open) closes and releases the order (R40).
  const openState = openLine ? delta.lines.find(l => l.categoryId === openLine)?.state : null
  const openGone = openLine !== null && openLine !== undefined && (!delta.hasPicks || openState !== 'priced')
  useEffect(() => {
    if (!openGone) return
    onOpenLine(null); setSpecLine(null); setEditLine(null)
    onFreezeOrder(null)
  }, [openGone])   // runs once per closing; the callbacks are not dependencies
  useEffect(() => {
    if (!focusField) return
    const el = document.getElementById(`hf-${focusField}`)
    el?.focus?.()
    el?.scrollIntoView?.({ block: 'center' })
    setFocusField(null)
  }, [focusField])

  const toggle = id => {
    const next = openLine === id ? null : id
    onOpenLine(next); setSpecLine(null); setEditLine(null)
    onFreezeOrder(next ? delta.order : null)
  }
  const toggleSpec = id => { setSpecLine(specLine === id ? null : id); setEditLine(null) }
  const toggleEdit = id => setEditLine(editLine === id ? null : id)
  // "change house" (R40, rev 3 3.4): open the strip on a phone, open "More about this house" for a field kept
  // there, then focus the field.
  const changeHouse = fieldKey => {
    if (narrow) setHouseStrip(true)
    if (HIDDEN_FIELD_KEYS.includes(fieldKey)) setMoreOpen(true)
    setFocusField(fieldKey || 'type')
  }

  const houseEl = (
    <HouseFields houseType={houseType} typeName={typeName} fields={houseFields} overriddenKeys={overriddenKeys} onTypeChange={onTypeChange} onFieldChange={onFieldChange}
      notice={notice} moreOpen={moreOpen} onToggleMore={() => setMoreOpen(o => !o)} showTitle={!narrow} />
  )
  const pickerEl = (
    <BaselinePicker choice={baselineChoice} onChoice={onBaselineChoice} onEdit={onEditUsual} onResetUsual={onResetUsual} hasUsual={hasUsual}
      baselineName={baselineName} baselinePicks={cost.baselinePicks} belowGradeApplicable={cost.quantities.belowGradeApplicable}
      includesOpen={includesOpen} onToggleIncludes={() => setIncludesOpen(o => !o)} onView={onViewBaselineCard} showTitle={!narrow} />
  )
  const prices = (
    <div className="price-source">
      <p className="costing-note">Prices: {PRICE_SOURCE_LABEL}, saved on this device{overrideCount > 0 && <> . you've changed {overrideCount} price{overrideCount === 1 ? '' : 's'} . <button type="button" className="link-button" onClick={onResetAllOverrides}>reset all</button></>}</p>
      <label className="costing-note"><input type="checkbox" checked={!chipHidden} onChange={onToggleChip} /> Show cost on Points</label>
    </div>
  )
  const side = narrow
    ? (
      <div className="cost-strips">
        <section className="cost-card strip"><Disclosure label="House" summary={houseSummary(typeName, houseFields)} open={houseStrip} onToggle={() => setHouseStrip(o => !o)}>{houseEl}</Disclosure></section>
        <section className="cost-card strip"><Disclosure label="Compared with" summary={baselineName} open={baseStrip} onToggle={() => setBaseStrip(o => !o)}>{pickerEl}</Disclosure></section>
      </div>
    ) : (
      <aside className="cost-sidebar">
        <section className="cost-card house-card">{houseEl}</section>
        <section className="cost-card baseline-card">{pickerEl}</section>
        {prices}
      </aside>
    )

  if (!delta.hasPicks) {
    return (
      <div className={`cost-tab ${narrow ? 'narrow' : ''}`}>{side}
        <section className="cost-statement">
          <div className="cost-card headline-card">
            <h2 className="headline">$0</h2>
            <p>Pick options on the Points tab to see what they add.</p>
            <p className="costing-note">{baselineName} means: {picksSmallPrint(cost.baselinePicks, { belowGradeApplicable: cost.quantities.belowGradeApplicable })}.</p>
          </div>
          {narrow && prices}
        </section>
      </div>
    )
  }
  return (
    <div className={`cost-tab ${narrow ? 'narrow' : ''}`}>{side}
      <section className="cost-statement">
        <div className="cost-card headline-card">
          <h2 className="headline">{delta.headline.text}</h2>
          <p className="costing-note">{delta.headline.secondLine}</p>
          {delta.headline.coveredText && <p className="costing-note">{delta.headline.coveredText}</p>}
        </div>
        <div className="category-lines">
          {delta.lines.map(line => (
            <CategoryLine key={line.categoryId} line={line} ctx={ctx} sentences={sentences} narrow={narrow}
              open={!openGone && openLine === line.categoryId} onToggle={() => toggle(line.categoryId)}
              specOpen={specLine === line.categoryId} onToggleSpec={() => toggleSpec(line.categoryId)}
              editing={editLine === line.categoryId} onToggleEdit={() => toggleEdit(line.categoryId)}
              onChangeHouse={changeHouse} onGoToPoints={onGoToPoints}
              tableProps={{
                onOverride: (s, comp, opt, field, v) => onOverride(s, line.categoryId, comp, opt, field, toStored(v, componentUnit(line, s, comp))),
                onLineOverride: (s, v) => onLineOverride(s, line.categoryId, toStored(v, lineUnit(line, s))),
                changedCount: changedCountFor(line),
                onResetCard: () => onResetCategoryOverrides(line.categoryId),
              }} />
          ))}
          <div className="category-line total-line"><span className="line-total-label">Total vs {baselineName}</span><span className="line-delta">{formatDelta(delta.headline.exact)}</span></div>
        </div>
        <p className="costing-note">Costs are not printed.</p>
        {narrow && prices}
      </section>
    </div>
  )
}
