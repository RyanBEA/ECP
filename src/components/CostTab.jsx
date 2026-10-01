import React, { useEffect, useState } from 'react'
import HouseFields from './HouseFields'
import BaselinePicker, { picksSmallPrint } from './BaselinePicker'
import CategoryLine, { unitLabelFor, qtyText } from './CategoryLine'
import LayerTable from './LayerTable'
import { PRICE_SOURCE_LABEL } from '../costSystem/client'
import { formatDelta, SQFT_PER_M2 } from '../costing/units'
import { getArchetype } from '../costing/archetypes'
import { appliedOverrideKeys } from '../costing/priceHouse'

// LayerTable emits typed values in display units (R3 amended): $/sq ft for components and lines priced in m2.
// Stored overrides are $/m2, so those are converted here; 'each' and 'house' values and a reset (undefined) pass
// through unchanged.
const toStored = (v, unit) => (v === undefined || unit !== 'm2' ? v : v * SQFT_PER_M2)
function componentUnit(line, side, component) {
  const primary = side === 'both' ? line.design : line[side]
  const other = primary === line.design ? line.baseline : line.design
  const find = r => r?.components?.find(c => c.component === component)?.unit
  return find(primary) ?? find(other)
}
const lineUnit = (line, side) => line[side]?.unit ?? line.design.unit

const UNCOSTED = ['notApplicable', 'notCosted']

// "change house" (R40): a field inside "More about this house" opens that group and takes focus; any other
// field scrolls the sidebar into view.
function changeHouse(fieldKey) {
  const el = fieldKey ? document.getElementById(`hf-${fieldKey}`) : null
  const group = el?.closest('details')
  if (group) {
    group.open = true
    el.focus()
    return
  }
  document.querySelector('.cost-sidebar')?.scrollIntoView?.({ behavior: 'smooth' })
}

// Applied override keys on this card, both houses, counted once (R36).
function changedCountFor(line) {
  const id = line.categoryId
  const keys = new Set([...appliedOverrideKeys({ [id]: line.design }), ...appliedOverrideKeys({ [id]: line.baseline })])
  return [...keys].filter(k => k.split('/')[1] === id).length
}

export default function CostTab(props) {
  const { cost, houseType, houseFields, overriddenKeys, baselineChoice, usualHouse, overrideCount, onTypeChange, onFieldChange, onBaselineChoice, onEditUsual, onResetUsual,
    onOverride, onLineOverride, onResetAllOverrides, onResetCategoryOverrides = () => {}, chipHidden, onToggleChip, openLine, onOpenLine, onFreezeOrder, notice } = props
  const [level3, setLevel3] = useState(null)
  const { delta, sentences, baselineName } = cost
  const hasUsual = Boolean(usualHouse?.[houseType])
  const typeName = getArchetype(houseType)?.name ?? houseType
  // An open line that stops applying (e.g. Type -> Mini-home with Below-grade open) closes and releases the order (R40).
  const openState = openLine ? delta.lines.find(l => l.categoryId === openLine)?.state : null
  // Also when every pick is cleared: the empty state shows no lines.
  const openGone = openLine !== null && openLine !== undefined && (!delta.hasPicks || openState === undefined || UNCOSTED.includes(openState))
  useEffect(() => {
    if (!openGone) return
    onOpenLine(null); setLevel3(null)
    onFreezeOrder(null)
  }, [openGone])   // runs once per closing; the callbacks are not dependencies
  const toggle = id => {
    const next = openLine === id ? null : id
    onOpenLine(next); setLevel3(null)
    onFreezeOrder(next ? delta.order : null)
  }
  const sidebar = (
    <aside className="cost-sidebar">
      <HouseFields houseType={houseType} fields={houseFields} overriddenKeys={overriddenKeys} onTypeChange={onTypeChange} onFieldChange={onFieldChange} notice={notice} />
      <BaselinePicker choice={baselineChoice} onChoice={onBaselineChoice} onEdit={onEditUsual} onResetUsual={onResetUsual} hasUsual={hasUsual} baselinePicks={cost.baselinePicks} />
      <div className="price-source"><h3>Prices</h3>
        <p className="costing-note">Prices: {PRICE_SOURCE_LABEL}, saved on this device{overrideCount > 0 && <> . you've changed {overrideCount} price{overrideCount === 1 ? '' : 's'} . <button type="button" className="link-button" onClick={onResetAllOverrides}>reset all</button></>}</p>
        <label className="costing-note"><input type="checkbox" checked={!chipHidden} onChange={onToggleChip} /> Show cost on Points</label></div>
    </aside>
  )
  if (!delta.hasPicks) {
    return (
      <div className="cost-tab">{sidebar}
        <section className="cost-statement">
          <h2 className="headline">$0</h2>
          <p>Pick options on the Points tab to see what they add.</p>
          <p className="costing-note">{baselineName} means: {picksSmallPrint(cost.baselinePicks)}.</p>
        </section></div>
    )
  }
  return (
    <div className="cost-tab">{sidebar}
      <section className="cost-statement">
        <h2 className="headline">{delta.headline.text}</h2>
        <p className="costing-note">{delta.headline.secondLine}</p>
        {delta.headline.coveredText && <p className="costing-note">{delta.headline.coveredText}</p>}
        <div className="category-lines">
          {delta.lines.map(line => (
            <CategoryLine key={line.categoryId} line={line} baselineName={baselineName} sentences={sentences}
              typeName={typeName} lengthFt={houseFields.lengthFt} widthFt={houseFields.widthFt} open={!openGone && openLine === line.categoryId}
              onToggle={() => toggle(line.categoryId)} level3={level3 === line.categoryId} onOpenLayers={() => setLevel3(line.categoryId)}
              onChangeHouse={changeHouse}>
              <LayerTable categoryId={line.categoryId} line={line} baselineName={baselineName} unitLabel={unitLabelFor(line.design)} quantityDisplay={qtyText(line.design)}
                onOverride={(side, comp, opt, field, v) => onOverride(side, line.categoryId, comp, opt, field, toStored(v, componentUnit(line, side, comp)))}
                onLineOverride={(side, v) => onLineOverride(side, line.categoryId, toStored(v, lineUnit(line, side)))}
                changedCount={changedCountFor(line)} onResetCard={() => onResetCategoryOverrides(line.categoryId)}
                onBack={() => setLevel3(null)} />
            </CategoryLine>
          ))}
          <div className="total-line"><span>Total vs {baselineName}</span><span>{formatDelta(delta.headline.exact)}</span></div>
        </div>
        <p className="costing-note">Costs are not printed.</p>
      </section>
    </div>
  )
}
