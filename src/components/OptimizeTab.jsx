// src/components/OptimizeTab.jsx
import React, { useState } from 'react'
import HouseFields, { houseSummary } from './HouseFields'
import BaselinePicker from './BaselinePicker'
import Disclosure from './Disclosure'
import ConsiderScreen from './ConsiderScreen'
import ResultScreen from './ResultScreen'
import useNarrow from './useNarrow'
import { PRICE_SOURCE_LABEL } from '../costSystem/client'
import { getArchetype } from '../costing/archetypes'

// The Optimize tab (Capability 2 spec 5): the Cost tab's sidebar, then screen 1 or screen 2.
export default function OptimizeTab(props) {
  const { cost, houseType, houseFields, overriddenKeys, baselineChoice, usualHouse, overrideCount, onTypeChange, onFieldChange, onBaselineChoice, onEditUsual, onResetUsual, onViewBaselineCard,
    tierLabel, consider, onToggleConsider, result, stale, blocked, onRun, onApply, applied, canRestore, onRestore, screen, onScreen, wallSelection } = props
  const narrowNow = useNarrow()
  const narrow = props.narrow ?? narrowNow
  const [moreOpen, setMoreOpen] = useState(false)
  const [includesOpen, setIncludesOpen] = useState(false)
  const [houseStrip, setHouseStrip] = useState(false)
  const [baseStrip, setBaseStrip] = useState(false)
  const typeName = getArchetype(houseType)?.name ?? houseType
  const hasUsual = Boolean(usualHouse?.[houseType])

  const houseEl = (
    <HouseFields houseType={houseType} typeName={typeName} fields={houseFields} overriddenKeys={overriddenKeys} onTypeChange={onTypeChange} onFieldChange={onFieldChange}
      notice="" moreOpen={moreOpen} onToggleMore={() => setMoreOpen(o => !o)} showTitle={!narrow} />
  )
  const pickerEl = (
    <BaselinePicker choice={baselineChoice} onChoice={onBaselineChoice} onEdit={onEditUsual} onResetUsual={onResetUsual} hasUsual={hasUsual}
      baselineName={cost.baselineName} baselinePicks={cost.baselinePicks} belowGradeApplicable={cost.quantities.belowGradeApplicable}
      includesOpen={includesOpen} onToggleIncludes={() => setIncludesOpen(o => !o)} onView={onViewBaselineCard} showTitle={!narrow} />
  )
  const prices = <div className="price-source"><p className="costing-note">Prices: {PRICE_SOURCE_LABEL}, saved on this device{overrideCount > 0 && <>. You've changed {overrideCount} price{overrideCount === 1 ? '' : 's'} on the Cost tab.</>}</p></div>
  const side = narrow
    ? (
      <div className="cost-strips">
        <section className="cost-card strip"><Disclosure label="House" summary={houseSummary(typeName, houseFields)} open={houseStrip} onToggle={() => setHouseStrip(o => !o)}>{houseEl}</Disclosure></section>
        <section className="cost-card strip"><Disclosure label="Compared with" summary={cost.baselineName} open={baseStrip} onToggle={() => setBaseStrip(o => !o)}>{pickerEl}</Disclosure></section>
      </div>
    ) : (
      <aside className="cost-sidebar">
        <section className="cost-card house-card">{houseEl}</section>
        <section className="cost-card baseline-card">{pickerEl}</section>
        {prices}
      </aside>
    )
  const showResult = screen === 'result' && result
  return (
    <div className={`cost-tab optimize-tab ${narrow ? 'narrow' : ''}`}>
      {side}
      {showResult
        ? <ResultScreen result={result} consider={consider} stale={stale} onRun={onRun} onChange={() => onScreen('consider')} onApply={onApply} applied={applied} canRestore={canRestore} onRestore={onRestore} />
        : <ConsiderScreen consider={consider} onToggle={onToggleConsider} tierLabel={tierLabel} wallSelection={wallSelection ?? cost.designPicks?.wall?.selection} blocked={blocked} onRun={onRun} />}
      {narrow && prices}
    </div>
  )
}
