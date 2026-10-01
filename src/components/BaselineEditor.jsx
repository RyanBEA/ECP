// The baseline editor, "Your usual house" (spec 5, 5.1, 7.4). Reuses the Points cards in the baseline variant
// and holds its own draft: Done commits it by value, Cancel discards it.
import React, { useState, useEffect, useMemo } from 'react'
import { categories, calculateWallRsi } from '../data/ecpData'
import CategoryCard from './CategoryCard'
import WallBuilder from './WallBuilder'
import PointsCounter from './PointsCounter'
import { picksToSelections, selectionsToPicks, applySelect, isCategoryDisabled, totalCardPoints, wallPointsFor } from '../costing/usePicks'
import { getPresetPicks, BASELINE_NAMES, presetText } from '../costing/baselines'
import { describeWall } from '../costing/assumedAssemblies'
import { fillFromTypical } from '../costing/useHouseCost'

const TIER2 = 10   // fixed, whatever the header tier shows (spec 5)
const PRESET_NAME = BASELINE_NAMES.typicalTier2
const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')

// Wall selections compared by their set fields, so key order and unset fields do not count as a change.
const wallKey = ws => JSON.stringify(Object.keys(ws || {}).filter(k => ws[k] !== undefined && ws[k] !== null).sort().map(k => [k, ws[k]]))

// The preset side of a change note. A card with no preset of its own but an exclusive-group sibling that has
// one (the gas DHW card) reads the sibling's preset: the two DHW cards are one costed line (spec 5.1).
function presetSide(c, preset) {
  const own = preset.cards[c.id]
  if (own !== undefined) return presetText(c.id, own)
  const sib = c.exclusiveGroup && categories.find(o => o.exclusiveGroup === c.exclusiveGroup && o.id !== c.id && preset.cards[o.id] !== undefined)
  return sib ? presetText(sib.id, preset.cards[sib.id]) : 'nothing'
}

// The picked side of a change note: '<metric> <value>' (or '<value> <unit>' on a card without a metric),
// with the option label in brackets where there is one.
function optionText(c, option) {
  const v = c.metric ? `${c.metric} ${option.value}` : c.unit ? `${option.value} ${c.unit}` : `${option.value}`
  return option.label ? `${v} (${option.label})` : v
}

function wallText(ws) {
  if (ws?.simpleIndex !== undefined && ws?.simpleIndex !== null) return `RSI ${wallCategory.options[ws.simpleIndex].value}`
  if (!ws?.wallType) return 'nothing'
  const d = describeWall(ws)
  if (d !== 'wall') return d
  const rsi = calculateWallRsi(ws)
  return rsi !== null ? `an assembly at RSI ${rsi}` : 'an incomplete wall'
}

export default function BaselineEditor({ initialPicks, houseType, onDone, onCancel, onDirtyChange, fillMissing = false }) {
  const preset = useMemo(() => getPresetPicks('typicalTier2', houseType), [houseType])
  const presetView = useMemo(() => picksToSelections(preset), [preset])
  // Ruling R41: with fillMissing, start from the usual house with its missing cards and wall filled from
  // Typical Tier 2, so a card missing from an older saved usual house shows its preset.
  const start = useMemo(() => {
    const base = initialPicks || preset
    return picksToSelections(fillMissing ? fillFromTypical(base, houseType) : base)
  }, [initialPicks, preset, fillMissing, houseType])
  const [selections, setSelections] = useState(start.selections)
  const [wallSelection, setWallSelection] = useState(start.wallSelection)
  const [presetOnly, setPresetOnly] = useState(start.presetOnly)   // preset-only values (no option on the card) ride along
  const [wallKeyN, setWallKeyN] = useState(0)                      // bumped on reset so WallBuilder recomputes its mode
  const [dirty, setDirty] = useState(false)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const total = totalCardPoints(selections) + wallPointsFor(wallSelection)
  const isChanged = c => c.id === wallCategory.id
    ? wallKey(wallSelection) !== wallKey(presetView.wallSelection)
    : selections[c.id] !== presetView.selections[c.id]
  const changed = categories.filter(isChanged).map(c => c.name)

  // Ruling R32: Clear returns a card to its preset. Where the preset value is one of the card's options, that
  // option is picked; otherwise the card is left unselected and its preset row is pressed.
  const select = (id, idx) => {
    let next = idx
    if (idx === null) {
      const c = categories.find(o => o.id === id)
      const p = c?.options.findIndex(o => o.value === preset.cards[id]) ?? -1
      if (p >= 0) next = p
    }
    setSelections(s => applySelect(s, id, next))
    setDirty(true)
  }
  const selectWall = ws => { setWallSelection(ws); setDirty(true) }
  const reset = () => {
    setSelections(presetView.selections)
    setWallSelection(presetView.wallSelection)
    setPresetOnly(presetView.presetOnly)
    setWallKeyN(n => n + 1)
    setDirty(true)
  }

  const note = c => {
    if (!isChanged(c)) return null
    if (c.id === wallCategory.id) return `${PRESET_NAME}: ${preset.wall ? wallText(preset.wall.kind === 'assembly' ? preset.wall.selection : presetView.wallSelection) : 'nothing'}. You picked ${wallText(wallSelection)}.`
    const idx = selections[c.id]
    const mine = idx !== undefined ? optionText(c, c.options[idx]) : presetOnly[c.id] !== undefined ? presetText(c.id, presetOnly[c.id]) : 'nothing'
    return `${PRESET_NAME}: ${presetSide(c, preset)}. You picked ${mine}.`
  }

  return (
    <div className="baseline-editor">
      <div className="crumb">Cost &gt; Your usual house</div>
      <div className="editor-header">
        <PointsCounter total={total} target={TIER2} variant="baseline" label={`your usual house . ${total >= TIER2 ? 'meets Tier 2' : 'short of Tier 2'}`} />
      </div>
      <div className="banner">
        <b>Describe the house you usually build.</b>
        <p>We've filled in what a typical Nova Scotia Tier 2 house looks like. Change only what you do differently. This is what your costs are compared with; it is not printed and not your design. Saved on this device only.</p>
      </div>
      <main className="categories-container">
        {categories.map(c => {
          const n = note(c)
          const pv = preset.cards[c.id]
          return (
            <div key={c.id} className="editor-card">
              {c.type === 'wallBuilder'
                ? <WallBuilder key={wallKeyN} selection={wallSelection} onSelect={selectWall} variant="baseline" hideExtras />
                : <CategoryCard category={c} selectedOption={selections[c.id] ?? null} onSelect={select} disabled={isCategoryDisabled(selections, c)}
                    variant="baseline" presetValue={pv} presetName={PRESET_NAME} presetText={pv !== undefined ? presetText(c.id, pv) : undefined} />}
              {n && <p className="costing-note">{n}</p>}
            </div>
          )
        })}
      </main>
      <div className="editor-footer">
        <span className="costing-note">{changed.length ? `Changed from ${PRESET_NAME}: ${changed.join(', ')}. ` : `Same as ${PRESET_NAME}. `}<button type="button" className="link-button" onClick={reset}>Reset to typical</button></span>
        <span><button type="button" className="btn" onClick={onCancel}>Cancel</button> <button type="button" className="btn primary baseline" onClick={() => onDone(selectionsToPicks(selections, wallSelection, presetOnly))}>Done</button></span>
      </div>
    </div>
  )
}
