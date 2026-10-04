// The baseline editor, "Your usual house" (spec 5, 5.1, 7.4). Reuses the Points cards in the baseline variant
// and holds its own draft: Done commits it by value, Cancel discards it.
import React, { useState, useEffect, useMemo } from 'react'
import { categories } from '../data/ecpData'
import CategoryCard from './CategoryCard'
import WallBuilder from './WallBuilder'
import PointsCounter from './PointsCounter'
import { picksToSelections, selectionsToPicks, applySelect, isCategoryDisabled, totalCardPoints, wallPointsFor } from '../costing/usePicks'
import { getPresetPicks, BASELINE_NAMES, presetText } from '../costing/baselines'
import { wallText } from '../costing/assumedAssemblies'
import { fillFromTypical } from '../costing/useHouseCost'
import { baselinePickRows } from './BaselinePicker'

const TIER2 = 10   // fixed, whatever the header tier shows (spec 5)
const PRESET_NAME = BASELINE_NAMES.typicalTier2
const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')

// Values compared by their set fields, so key order and unset fields do not count as a change.
const stableKey = v => {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).filter(k => v[k] !== undefined && v[k] !== null).sort().map(k => `${JSON.stringify(k)}:${stableKey(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}
const wallKey = ws => stableKey(ws || {})

// Ruling R42: an empty wall selection (no wall type, no RSI level: after Clear or a switch between Select RSI and
// Build Assembly) counts as the preset wall. A missing baseline pick means the preset value (spec 5.1).
const isEmptyWall = ws => !ws?.wallType && (ws?.simpleIndex === undefined || ws?.simpleIndex === null)

// The preset side of a change note. A card with no preset of its own but an exclusive-group sibling that has
// one (the gas DHW card) reads the sibling's preset: the two DHW cards are one costed line (spec 5.1).
function presetSide(c, preset) {
  const own = preset.cards[c.id]
  if (own !== undefined) return presetText(c.id, own)
  const sib = c.exclusiveGroup && categories.find(o => o.exclusiveGroup === c.exclusiveGroup && o.id !== c.id && preset.cards[o.id] !== undefined)
  return sib ? presetText(sib.id, preset.cards[sib.id]) : 'no pick on this card'
}

// The picked side of a change note: '<metric> <value>' (or '<value> <unit>' on a card without a metric),
// with the option label in brackets where there is one.
function optionText(c, option) {
  const v = c.metric ? `${c.metric} ${option.value}` : c.unit ? `${option.value} ${c.unit}` : `${option.value}`
  return option.label ? `${v} (${option.label})` : v
}

export default function BaselineEditor({ initialPicks, houseType, onDone, onCancel, onDirtyChange, fillMissing = false, readOnly = false, baselineName, focusCard }) {
  // Read-only (spec rev 3 3.2): the cards show the baseline's own picks and the notes name that baseline.
  const preset = useMemo(() => (readOnly && initialPicks ? initialPicks : getPresetPicks('typicalTier2', houseType)), [readOnly, initialPicks, houseType])
  const presetName = readOnly ? baselineName : PRESET_NAME
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
  const effWall = ws => isEmptyWall(ws) ? presetView.wallSelection : ws
  const wall = effWall(wallSelection)
  // Ruling R43: dirty means the draft differs from where it started (an empty wall counting as the preset),
  // so a no-op Clear or a Reset back to the start leaves it clean.
  const draftKey = (sel, ws, po) => stableKey({ sel, wall: effWall(ws), po })
  const dirty = draftKey(selections, wallSelection, presetOnly) !== draftKey(start.selections, start.wallSelection, start.presetOnly)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  // A pick that is not one of the card's options (Code minimum's RSI 2.97 wall) is stated in words (Review Focus 5).
  const roRows = useMemo(() => (readOnly ? baselinePickRows(initialPicks) : []), [readOnly, initialPicks])
  const roNote = c => { const r = roRows.find(x => x.cardId === c.id); return r ? `${presetName}: ${r.value}.` : null }
  useEffect(() => {
    if (!focusCard) return undefined
    const el = document.querySelector(`.baseline-editor [data-card="${focusCard}"]`)
    if (!el) return undefined
    el.classList.add('focused')
    el.scrollIntoView?.({ block: 'center' })
    const t = setTimeout(() => el.classList.remove('focused'), 2000)
    return () => clearTimeout(t)
  }, [focusCard])

  const total = totalCardPoints(selections) + wallPointsFor(wall)
  const isChanged = c => c.id === wallCategory.id
    ? wallKey(wall) !== wallKey(presetView.wallSelection)
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
  }
  const selectWall = ws => setWallSelection(ws)
  const reset = () => {
    setSelections(presetView.selections)
    setWallSelection(presetView.wallSelection)
    setPresetOnly(presetView.presetOnly)
    setWallKeyN(n => n + 1)
  }

  const note = c => {
    if (!isChanged(c)) return null
    if (c.id === wallCategory.id) return `${presetName}: ${wallText(presetView.wallSelection)}. You picked ${wallText(wall)}.`
    const idx = selections[c.id]
    const mine = idx !== undefined ? optionText(c, c.options[idx]) : presetOnly[c.id] !== undefined ? presetText(c.id, presetOnly[c.id]) : null
    return `${presetName}: ${presetSide(c, preset)}. ${mine === null ? 'You have no pick on this card.' : `You picked ${mine}.`}`
  }

  const label = readOnly ? baselineName : 'your usual house'
  return (
    <div className="baseline-editor">
      <div className="crumb">Cost &gt; {readOnly ? baselineName : 'Your usual house'}</div>
      <div className="editor-header">
        <PointsCounter total={total} target={TIER2} variant="baseline" label={`${label} . ${total >= TIER2 ? 'meets Tier 2' : 'short of Tier 2'}`} />
      </div>
      <div className="banner">
        {readOnly
          ? <><b>This is {baselineName}.</b><p>It cannot be changed; to describe your own, choose My usual house.</p></>
          : <><b>Describe the house you usually build.</b><p>We've filled in what a typical Nova Scotia Tier 2 house looks like. Change only what you do differently. This is what your costs are compared with; it is not printed and not your design. Saved on this device only.</p></>}
      </div>
      <fieldset className="editor-cards" disabled={readOnly}>
        <main className="categories-container">
          {categories.map(c => {
            const n = readOnly ? roNote(c) : note(c)
            const pv = preset.cards[c.id]
            return (
              <div key={c.id} className="editor-card" data-card={c.id}>
                {c.type === 'wallBuilder'
                  ? <WallBuilder key={wallKeyN} selection={wallSelection} onSelect={selectWall} variant="baseline" hideExtras />
                  : <CategoryCard category={c} selectedOption={selections[c.id] ?? null} onSelect={select} disabled={isCategoryDisabled(selections, c)}
                      variant="baseline" presetValue={pv} presetName={presetName} presetText={pv !== undefined ? presetText(c.id, pv) : undefined} />}
                {n && <p className="costing-note">{n}</p>}
              </div>
            )
          })}
        </main>
      </fieldset>
      <div className="editor-footer">
        {readOnly
          ? <span><button type="button" className="btn primary baseline" onClick={onCancel}>Back to Cost</button></span>
          : <>
              <span className="costing-note">{changed.length ? `Changed from ${PRESET_NAME}: ${changed.join(', ')}. ` : `Same as ${PRESET_NAME}. `}<button type="button" className="link-button" onClick={reset}>Reset to Typical Tier 2</button></span>
              <span><button type="button" className="btn" onClick={onCancel}>Cancel</button> <button type="button" className="btn primary baseline" onClick={() => onDone(selectionsToPicks(selections, wallSelection, presetOnly))}>Done</button></span>
            </>}
      </div>
    </div>
  )
}
