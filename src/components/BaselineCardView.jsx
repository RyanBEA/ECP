import React from 'react'
import { categories } from '../data/ecpData'
import CategoryCard from './CategoryCard'
import Dialog from './Dialog'
import { baselinePickRows } from './BaselinePicker'
import { picksToSelections } from '../costing/usePicks'
import { presetText } from '../costing/baselines'

// "view" on one card of Code minimum or Typical Tier 2 (iteration 3): that card alone, read-only, in a small
// dialog. The pick is also stated in words, so the wall and any value that is not one of the card's options
// (Code minimum's RSI 2.97 wall) read correctly without a card (Review Focus 5).
export default function BaselineCardView({ picks, baselineName, cardId, onClose }) {
  const row = baselinePickRows(picks).find(r => r.cardId === cardId)
  const c = categories.find(o => o.id === cardId)
  const name = row?.name ?? c?.name ?? cardId
  const showCard = Boolean(c) && c.type !== 'wallBuilder'
  const { selections } = picksToSelections(picks)
  const pv = picks.cards?.[cardId]
  return (
    <Dialog title={`${name} in ${baselineName}`} onClose={onClose} className="card-view">
      {row && <p className="card-view-value">{`${baselineName}: ${row.value}.`}</p>}
      {showCard && (
        <fieldset className="editor-cards" disabled>
          <CategoryCard category={c} selectedOption={selections[cardId] ?? null} onSelect={() => {}} disabled={false}
            variant="baseline" presetValue={pv} presetName={baselineName} presetText={pv !== undefined ? presetText(cardId, pv) : undefined} />
        </fieldset>
      )}
      <p className="costing-note">{`${baselineName} cannot be changed. To describe your own, choose My usual house.`}</p>
    </Dialog>
  )
}
