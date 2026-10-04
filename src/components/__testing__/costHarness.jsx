// Test support (not a test): CostTab with live state, as App drives it.
import React, { useState } from 'react'
import CostTab from '../CostTab'
import { useHouseCost, resolveHouseFields } from '../../costing/useHouseCost'

export function Harness({ selections = {}, wallSelection = {}, initialType = 'singleDetached', usualHouse = {}, initialChoice = 'typicalTier2', overrides: initialOverrides = {}, spies = {}, narrow }) {
  const [houseType, setHouseType] = useState(initialType)
  const [fieldOverrides, setFieldOverrides] = useState({})
  const [baselineChoice, setBaselineChoice] = useState(initialChoice)
  const [overrides, setOverrides] = useState(initialOverrides)
  const [openLine, setOpenLine] = useState(null)
  const [frozenOrder, setFrozenOrder] = useState(null)
  const houseFields = resolveHouseFields(houseType, fieldOverrides)
  const cost = useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, frozenOrder })
  const setField = (k, v) => setFieldOverrides(p => {
    const forType = { ...(p[houseType] || {}) }
    if (v === undefined) delete forType[k]; else forType[k] = v
    return { ...p, [houseType]: forType }
  })
  const setOverride = (side, cat, comp, opt, field, v) => setOverrides(p => {
    const k = `${side}/${cat}/${comp}/${opt}`
    return { ...p, [k]: { ...(p[k] || {}), [field]: v } }
  })
  return (
    <CostTab cost={cost} houseType={houseType} houseFields={houseFields} overriddenKeys={Object.keys(fieldOverrides[houseType] || {})}
      baselineChoice={baselineChoice} usualHouse={usualHouse} overrideCount={cost.overrideCount}
      onTypeChange={t => { setHouseType(t); setFieldOverrides({}) }} onFieldChange={setField}
      onBaselineChoice={v => { setBaselineChoice(v); spies.onBaselineChoice?.(v) }} onEditUsual={spies.onEditUsual || (() => {})} onResetUsual={() => {}}
      onViewBaselineCard={spies.onViewBaselineCard || (() => {})} onGoToPoints={spies.onGoToPoints || (() => {})}
      onOverride={spies.onOverride || setOverride} onLineOverride={spies.onLineOverride || (() => {})}
      onResetAllOverrides={() => setOverrides({})} onResetCategoryOverrides={spies.onResetCategoryOverrides}
      chipHidden={false} onToggleChip={() => {}} openLine={openLine} onOpenLine={setOpenLine} onFreezeOrder={setFrozenOrder} notice="" narrow={narrow} />
  )
}
