import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { categories, tiers } from './data/ecpData'
import CategoryCard from './components/CategoryCard'
import WallBuilder from './components/WallBuilder'
import PointsCounter from './components/PointsCounter'
import PrintSummary from './components/PrintSummary'
import TabBar from './components/TabBar'
import CostTab from './components/CostTab'
import BaselineEditor from './components/BaselineEditor'
import Dialog from './components/Dialog'
import BaselineCardView from './components/BaselineCardView'
import useNarrow from './components/useNarrow'
import { SunIcon, MoonIcon } from './components/icons'
import { DISCLAIMER, USAGE_NOTICE } from './data/disclaimer'
import { buildPrintEvent, sendPrintEvent } from './utils/printEvent'
import { useHouseCost, resolveHouseFields } from './costing/useHouseCost'
import { loadPersisted, savePersisted } from './costing/persist'
import { getPresetPicks } from './costing/baselines'
import { overrideKey, lineOverrideKey } from './costing/priceHouse'
import { applySelect, isCategoryDisabled, totalCardPoints, wallPointsFor, picksToSelections } from './costing/usePicks'
import OptimizeTab from './components/OptimizeTab'
import { useOptimize } from './optimize/useOptimize'
import { defaultConsider, toggleConsider } from './optimize/candidates'
import { MORE_THAN_5 } from './costing/quantities'

const APP_VERSION = '1.7.0-cost-optimize'
const APP_UPDATED = '2026-10-08'

export default function App() {
  // Track dark mode - default to system preference
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Apply dark mode class to body element
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Track selected tier (default to Tier 2)
  const [selectedTierId, setSelectedTierId] = useState(2)
  const selectedTier = tiers.find(t => t.id === selectedTierId)

  // Track selected option index for each category
  const [selections, setSelections] = useState({})

  // Track wall builder selections separately
  const [wallSelection, setWallSelection] = useState({})

  // Optional project details — blank on screen, printed on the summary
  const [projectInfo, setProjectInfo] = useState({ project: '', permit: '', applicant: '' })
  const handleProjectChange = (field) => (e) =>
    setProjectInfo(prev => ({ ...prev, [field]: e.target.value }))

  // --- Optimize tab state (Capability 2 spec 4, 6, 7). Nothing here is persisted. ---
  const [consider, setConsider] = useState(defaultConsider)
  const [optScreen, setOptScreen] = useState('consider')
  const [optRequest, setOptRequest] = useState(null)      // the snapshot the result was computed from
  const [savedPicks, setSavedPicks] = useState(null)      // Points-tab picks before "Put this on the Points tab"
  const optimizeResult = useOptimize(optRequest)

  // Points selection logic is shared with the baseline editor through usePicks (spec 5): the same functions as
  // main's handleSelect, wallPoints, totalPoints and isDisabled, so Points behaves exactly as on main.
  const handleSelect = (categoryId, optionIndex) => { setSavedPicks(null); setSelections(prev => applySelect(prev, categoryId, optionIndex)) }
  const wallPoints = useMemo(() => wallPointsFor(wallSelection), [wallSelection])
  const totalPoints = useMemo(() => totalCardPoints(selections) + wallPoints, [selections, wallPoints])
  const isDisabled = category => isCategoryDisabled(selections, category)

  const targetPoints = selectedTier.points

  // --- Cost tab state (spec 2, 3, 5, 7.3, 8.4). Design picks stay as above and are never persisted. ---
  const [activeTab, setActiveTab] = useState('points')
  const [persisted, setPersisted] = useState(() => loadPersisted())
  useEffect(() => { savePersisted(persisted) }, [persisted])
  // Merge a partial blob, or a function of the previous blob returning one, into the persisted state.
  const patch = useCallback(p => setPersisted(prev => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) })), [])
  // null, or while the usual-house editor is open: { initialPicks, focusCard, layout: 'dialog' | 'page', snapshot }.
  // The layout is fixed when it opens (a dialog from 900 px up, a page below), so a resize never remounts it.
  const [editing, setEditing] = useState(null)
  const [viewCard, setViewCard] = useState(null)   // "view" on a preset card: { cardId, picks, baselineName }
  const narrow = useNarrow()
  const [openLine, setOpenLine] = useState(null)
  const [includesOpen, setIncludesOpen] = useState(false)   // the baseline disclosures also survive the editor (F2)
  const [baseStrip, setBaseStrip] = useState(false)
  const [level3, setLevel3] = useState(null)   // the line whose level 3 is open; kept here so it survives the editor (R45)
  const [frozenOrder, setFrozenOrder] = useState(null)
  const [notice, setNotice] = useState('')

  // The footer button and the chip are far down the page: after a switch of tab, or into or out of the editor
  // page on a phone, bring the tab bar back into view when it has scrolled off the top, so the new view starts
  // at its beginning. The editor dialog opens over the page and does not move it.
  const editingPage = editing?.layout === 'page'
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (editing?.layout === 'page' && editing.focusCard) return   // the editor scrolls to its card; keep it there
    const bar = document.querySelector('.tab-bar')
    if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView?.({ block: 'start' })
  }, [activeTab, editingPage])

  // Leaving the editor page while Cost stays the active tab would drop focus to <body> (the page unmounts):
  // hand it to the Cost tab. Leaving by another tab leaves focus where that click put it.
  const wasEditingPage = useRef(false)
  useEffect(() => {
    if (wasEditingPage.current && !editingPage && activeTab === 'cost') document.getElementById('tab-cost')?.focus()
    wasEditingPage.current = editingPage
  }, [editingPage, activeTab])

  const { houseType, baselineChoice, usualHouse, overrides, fieldOverrides } = persisted
  const houseFields = useMemo(() => resolveHouseFields(houseType, fieldOverrides), [houseType, fieldOverrides])
  const cost = useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, frozenOrder })

  const optStale = optRequest !== null && (
    optRequest.selections !== selections || optRequest.wallSelection !== wallSelection || optRequest.houseType !== houseType
    || optRequest.houseFields !== houseFields || optRequest.baselineChoice !== baselineChoice || optRequest.usualHouse !== usualHouse
    || optRequest.overrides !== overrides || optRequest.tierPoints !== selectedTier.points || optRequest.consider !== consider)
  const optBlocked = houseFields.bedrooms === MORE_THAN_5 && !cost.quantities.airflow && consider.hrv.size > 0
    ? 'Enter the designed airflow on the Cost tab to include ventilation' : null
  const runOptimize = () => {
    setOptRequest({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, tierPoints: selectedTier.points, tierLabel: selectedTier.label, consider })
    setOptScreen('result')
  }
  // Spec 7: replace the Points-tab picks with the package's; cards the search left out keep their current pick.
  const applyPackage = shown => {
    setSavedPicks({ selections, wallSelection })
    const { selections: ps, wallSelection: pw } = picksToSelections(shown.picks)
    const next = { ...selections }
    for (const line of shown.lines) {
      if (line.state !== 'searched') continue
      if (line.cardId === 'aboveGroundWalls') continue
      const pickCards = line.cardId === 'dhw' ? ['dhwElectric', 'dhwGas'] : [line.cardId]
      for (const pc of pickCards) { if (ps[pc] !== undefined) next[pc] = ps[pc]; else delete next[pc] }
    }
    setSelections(next)
    if (shown.picks.wall) setWallSelection(pw)
    // Applying is the tool's own action, not a change to the builder's inputs: refresh the snapshot so the result is not stale.
    setOptRequest(prev => (prev ? { ...prev, selections: next, wallSelection: shown.picks.wall ? pw : prev.wallSelection } : prev))
  }
  const restorePicks = () => {
    if (!savedPicks) return
    setSelections(savedPicks.selections); setWallSelection(savedPicks.wallSelection); setSavedPicks(null)
    setOptRequest(prev => (prev ? { ...prev, selections: savedPicks.selections, wallSelection: savedPicks.wallSelection } : prev))
  }

  // The footer button is enabled whenever any card has a pick (spec 2.2).
  const anyPick = Object.keys(selections).length > 0 || Boolean(wallSelection.wallType)
    || (wallSelection.simpleIndex !== undefined && wallSelection.simpleIndex !== null)

  const openCost = () => {
    setActiveTab('cost')
    if (!persisted.hasOpenedCost) patch({ hasOpenedCost: true })
  }
  // A tab is a way out of the editor page (iteration 3): the editor closes, its picks already saved.
  const changeTab = id => {
    if (editing) setEditing(null)
    if (id === 'cost') openCost()
    else setActiveTab(id)
  }

  // Changing Type clears that type's field overrides, with a one-line notice (spec 3.1, M6). baselineChoice is
  // left as it is: with no usual house for the new type, resolveBaselinePicks and BaselinePicker fall back to
  // Typical Tier 2, and switching back to a type with one shows it again (ruling R45).
  const onTypeChange = type => {
    const hadOverrides = Object.keys(fieldOverrides[houseType] || {}).length > 0
    patch(prev => ({ houseType: type, fieldOverrides: { ...prev.fieldOverrides, [type]: {} } }))
    setNotice(hadOverrides ? 'House type changed; your changed fields were reset to the new type.' : '')
  }
  // undefined is a reset: the key is deleted so the field reads "assumed" again. Any field change clears the
  // Type-change notice (R45).
  const onFieldChange = (key, value) => {
    setNotice('')
    patch(prev => {
      const forType = { ...(prev.fieldOverrides[houseType] || {}) }
      if (value === undefined) delete forType[key]
      else forType[key] = value
      return { fieldOverrides: { ...prev.fieldOverrides, [houseType]: forType } }
    })
  }

  // Iteration 3: the editor saves as you pick. The snapshot is the usual house and the baseline choice as they
  // were when it opened; a draft back at its start (Undo changes, or no change at all) restores them.
  const openEditor = focusCard => setEditing({
    initialPicks: usualHouse[houseType] || getPresetPicks('typicalTier2', houseType),
    focusCard,
    layout: narrow ? 'page' : 'dialog',
    snapshot: { usual: usualHouse[houseType] ?? null, choice: baselineChoice },
  })
  const onEditUsual = () => openEditor()
  const closeEditor = () => setEditing(null)
  const onEditorChange = picks => {
    if (!editing) return
    const { usual, choice } = editing.snapshot
    patch(prev => {
      const next = { ...prev.usualHouse }
      if (picks) next[houseType] = picks
      else if (usual) next[houseType] = usual
      else delete next[houseType]
      return { usualHouse: next, baselineChoice: picks ? 'usualHouse' : choice }
    })
  }
  // Esc leaves the editor page on a phone; the dialog handles its own Esc.
  useEffect(() => {
    if (!editingPage) return undefined
    const onKey = e => { if (e.key === 'Escape') setEditing(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editingPage])
  const liveHeadline = cost.delta.hasPicks ? cost.delta.headline.text : 'Pick options on the Points tab to see the cost difference.'
  const onResetUsual = () => patch(prev => {
    const next = { ...prev.usualHouse }
    delete next[houseType]
    return { usualHouse: next, baselineChoice: 'typicalTier2' }
  })
  // "view" on a baseline pick (spec rev 3 3.2, iteration 3): a preset card opens alone, read-only, in a small
  // dialog; Your usual house opens the editor at that card.
  const onViewBaselineCard = cardId => {
    if (cost.baselineId === 'usualHouse' && usualHouse[houseType]) openEditor(cardId)
    else setViewCard({ cardId, picks: cost.baselinePicks, baselineName: cost.baselineName })
  }
  // "Go to Points" (rev 3 4.1): switch tabs, then bring the wall card into view.
  const [toWall, setToWall] = useState(false)
  const onGoToPoints = () => { setActiveTab('points'); setToWall(true) }
  useEffect(() => {
    if (!toWall || activeTab !== 'points') return
    document.querySelector('#panel-points .wall-builder')?.scrollIntoView?.({ block: 'start' })
    setToWall(false)
  }, [toWall, activeTab])

  // Price overrides (spec 7.2). CostTab hands over values already in stored units ($/m2 where priced in m2).
  const onOverride = (side, categoryId, component, priceId, field, value) => patch(prev => {
    const key = overrideKey(side, categoryId, component, priceId)
    const next = { ...prev.overrides, [key]: { ...(prev.overrides[key] || {}) } }
    if (value === undefined) {
      delete next[key][field]
      if (!Object.keys(next[key]).length) delete next[key]
    } else next[key][field] = value
    return { overrides: next }
  })
  const onLineOverride = (side, categoryId, value) => patch(prev => {
    const key = lineOverrideKey(side, categoryId)
    const next = { ...prev.overrides }
    if (value === undefined) delete next[key]
    else next[key] = { line: value }
    return { overrides: next }
  })
  // A card's "reset all" (R36): every override whose category segment is this card's.
  const onResetCategoryOverrides = categoryId => patch(prev => ({
    overrides: Object.fromEntries(Object.entries(prev.overrides).filter(([k]) => k.split('/')[1] !== categoryId)),
  }))

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <header className="app-header">
        <div className="header-logos">
          <a href="https://baselineenergy.ca/" target="_blank" rel="noopener noreferrer">
            <img
              src={darkMode ? '/logodarkmode.png' : '/logolightmode.png'}
              alt="BEA Logo"
              className="header-logo"
            />
          </a>
          <span className="logo-separator">×</span>
          <a href="https://buildingtozero.ca/" target="_blank" rel="noopener noreferrer">
            <img
              src={darkMode ? '/btzx-logo.svg' : '/btzx-logo-dark.svg'}
              alt="Building to Zero Exchange Logo"
              className="header-logo header-logo-btzx"
            />
          </a>
        </div>
        <div className="tier-selector">
          <span>NBC 2020</span>
          <select
            value={selectedTierId}
            onChange={e => setSelectedTierId(Number(e.target.value))}
          >
            {tiers.map(tier => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
          <span>Compliance</span>
        </div>
        <button
          type="button"
          className="dark-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>
        <PointsCounter total={totalPoints} target={targetPoints} />
      </header>

      <TabBar active={activeTab} onChange={changeTab} />

      {/* Points stays mounted while Cost is shown, so WallBuilder keeps its state (spec 2.1). */}
      <div className="tab-panel" id="panel-points" role="tabpanel" aria-labelledby="tab-points" hidden={activeTab !== 'points'}>
      <section className="app-intro">
        <strong>Prescriptive Tier 2 Compliance Calculator</strong>
        <p>
          Estimate how many energy conservation points your building design earns under NBC 2020
          Subsection 9.36.8 (Prescriptive Path) for Climate Zone 6. Tier 2 requires a minimum of
          10 points from Tables 9.36.8.4 through 9.36.8.10. This tool makes several simplifying
          assumptions—discuss your Tier 2 compliance strategy with your building official when
          applying for your building permit.
        </p>
      </section>

      <main className="categories-container">
        {categories.map(category => {
          // Render WallBuilder for wall category
          if (category.type === 'wallBuilder') {
            return (
              <WallBuilder
                key={category.id}
                selection={wallSelection}
                onSelect={ws => { setSavedPicks(null); setWallSelection(ws) }}
              />
            )
          }

          // Render standard CategoryCard for other categories
          return (
            <CategoryCard
              key={category.id}
              category={category}
              selectedOption={selections[category.id] ?? null}
              onSelect={handleSelect}
              disabled={isDisabled(category)}
            />
          )
        })}
      </main>

      <footer className="app-footer">
        <div className="project-fields">
          <div className="category-header">
            <h2 className="category-name">Project Details</h2>
            <span className="category-metric">optional — printed on the summary</span>
          </div>
          <p className="category-description">{DISCLAIMER}</p>
          <div className="project-fields-row">
            <label>
              <span>Project / Address</span>
              <input
                type="text"
                value={projectInfo.project}
                onChange={handleProjectChange('project')}
              />
            </label>
            <label>
              <span>Permit Number</span>
              <input
                type="text"
                value={projectInfo.permit}
                onChange={handleProjectChange('permit')}
              />
            </label>
            <label>
              <span>Applicant</span>
              <input
                type="text"
                value={projectInfo.applicant}
                onChange={handleProjectChange('applicant')}
              />
            </label>
          </div>
        </div>
        <p>
          {totalPoints >= targetPoints
            ? `Target met! You have ${totalPoints.toFixed(1)} ECP.`
            : `Need ${(targetPoints - totalPoints).toFixed(1)} more points to reach ${selectedTier.label}.`
          }
        </p>
        <div className="footer-meta">
          <button
            className="print-button"
            onClick={() => {
              sendPrintEvent(buildPrintEvent({
                selections,
                wallSelection,
                wallPoints,
                totalPoints,
                selectedTier,
                appVersion: APP_VERSION,
              }))
              window.print()
            }}
            disabled={totalPoints === 0}
          >
            Save / Print
          </button>
          <button
            className="print-button cost-button"
            onClick={openCost}
            disabled={!anyPick}
          >
            {persisted.hasOpenedCost ? 'Cost details ->' : 'What does this cost? ->'}
          </button>
        </div>
        <p className="usage-notice">{USAGE_NOTICE}</p>
      </footer>
      </div>

      <div className="tab-panel" id="panel-cost" role="tabpanel" aria-labelledby="tab-cost" hidden={activeTab !== 'cost'}>
        {activeTab === 'cost' && (editingPage
          ? (
            <BaselineEditor
              initialPicks={editing.initialPicks}
              houseType={houseType}
              fillMissing
              focusCard={editing.focusCard}
              headline={liveHeadline}
              onChange={onEditorChange}
              onClose={closeEditor}
            />
          ) : (
            <CostTab
              cost={cost}
              houseType={houseType}
              houseFields={houseFields}
              overriddenKeys={Object.keys(fieldOverrides[houseType] || {})}
              baselineChoice={baselineChoice}
              usualHouse={usualHouse}
              overrideCount={cost.overrideCount}
              onTypeChange={onTypeChange}
              onFieldChange={onFieldChange}
              onBaselineChoice={v => patch({ baselineChoice: v })}
              onEditUsual={onEditUsual}
              onResetUsual={onResetUsual}
              onViewBaselineCard={onViewBaselineCard}
              onGoToPoints={onGoToPoints}
              onOverride={onOverride}
              onLineOverride={onLineOverride}
              onResetAllOverrides={() => patch({ overrides: {} })}
              onResetCategoryOverrides={onResetCategoryOverrides}
              openLine={openLine}
              onOpenLine={setOpenLine}
              level3={level3}
              onLevel3={setLevel3}
              includesOpen={includesOpen}
              onIncludesOpen={setIncludesOpen}
              baseStrip={baseStrip}
              onBaseStrip={setBaseStrip}
              onFreezeOrder={setFrozenOrder}
              notice={notice}
            />
          ))}
        {activeTab === 'cost' && editing && !editingPage && (
          <Dialog title="Your usual house" sub={liveHeadline} onClose={closeEditor} className="editor-dialog">
            <BaselineEditor
              initialPicks={editing.initialPicks}
              houseType={houseType}
              fillMissing
              focusCard={editing.focusCard}
              onChange={onEditorChange}
              onClose={closeEditor}
              asDialog
            />
          </Dialog>
        )}
        {activeTab === 'cost' && viewCard && (
          <BaselineCardView picks={viewCard.picks} baselineName={viewCard.baselineName} cardId={viewCard.cardId} onClose={() => setViewCard(null)} />
        )}
      </div>

      <div className="tab-panel" id="panel-optimize" role="tabpanel" aria-labelledby="tab-optimize" hidden={activeTab !== 'optimize'}>
        {activeTab === 'optimize' && (
          <OptimizeTab
            cost={cost}
            houseType={houseType}
            houseFields={houseFields}
            overriddenKeys={Object.keys(fieldOverrides[houseType] || {})}
            baselineChoice={baselineChoice}
            usualHouse={usualHouse}
            overrideCount={cost.overrideCount}
            onTypeChange={onTypeChange}
            onFieldChange={onFieldChange}
            onBaselineChoice={v => patch({ baselineChoice: v })}
            onEditUsual={cardId => { changeTab('cost'); onEditUsual(cardId) }}
            onResetUsual={onResetUsual}
            onViewBaselineCard={cardId => { changeTab('cost'); onViewBaselineCard(cardId) }}
            wallSelection={wallSelection}
            tierLabel={selectedTier.label}
            consider={consider}
            onToggleConsider={(c, v) => setConsider(prev => toggleConsider(prev, c, v))}
            result={optimizeResult}
            stale={optStale}
            blocked={optBlocked}
            onRun={runOptimize}
            onApply={applyPackage}
            applied={savedPicks !== null}
            canRestore={savedPicks !== null}
            onRestore={restorePicks}
            screen={optScreen}
            onScreen={setOptScreen}
          />
        )}
      </div>

      <p className="app-version">v{APP_VERSION} — Updated {APP_UPDATED}</p>

      <PrintSummary
        selections={selections}
        wallSelection={wallSelection}
        wallPoints={wallPoints}
        totalPoints={totalPoints}
        selectedTier={selectedTier}
        projectInfo={projectInfo}
      />
    </div>
  )
}
