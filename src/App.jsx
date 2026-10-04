import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { categories, tiers } from './data/ecpData'
import CategoryCard from './components/CategoryCard'
import WallBuilder from './components/WallBuilder'
import PointsCounter from './components/PointsCounter'
import PrintSummary from './components/PrintSummary'
import TabBar from './components/TabBar'
import HeaderCostChip from './components/HeaderCostChip'
import CostTab from './components/CostTab'
import BaselineEditor from './components/BaselineEditor'
import { DISCLAIMER, USAGE_NOTICE } from './data/disclaimer'
import { buildPrintEvent, sendPrintEvent } from './utils/printEvent'
import { useHouseCost, resolveHouseFields } from './costing/useHouseCost'
import { loadPersisted, savePersisted } from './costing/persist'
import { chipText, chipSecondLine } from './costing/delta'
import { getPresetPicks } from './costing/baselines'
import { overrideKey, lineOverrideKey } from './costing/priceHouse'
import { applySelect, isCategoryDisabled, totalCardPoints, wallPointsFor } from './costing/usePicks'

const APP_VERSION = '1.5.0-cost-ui-2'
const APP_UPDATED = '2026-10-02'

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

  // Points selection logic is shared with the baseline editor through usePicks (spec 5): the same functions as
  // main's handleSelect, wallPoints, totalPoints and isDisabled, so Points behaves exactly as on main.
  const handleSelect = (categoryId, optionIndex) => setSelections(prev => applySelect(prev, categoryId, optionIndex))
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
  const [editing, setEditing] = useState(null)   // null | { initialPicks } while the baseline editor is open
  const [editorDirty, setEditorDirty] = useState(false)
  const [openLine, setOpenLine] = useState(null)
  const [level3, setLevel3] = useState(null)   // the line whose level 3 is open; kept here so it survives the editor (R45)
  const [frozenOrder, setFrozenOrder] = useState(null)
  const [notice, setNotice] = useState('')

  // The footer button, the chip, Done and Cancel are far down the page: after a switch of tab or editor, bring
  // the tab bar back into view when it has scrolled off the top, so the new view starts at its beginning.
  const isEditing = Boolean(editing)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const bar = document.querySelector('.tab-bar')
    if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView?.({ block: 'start' })
  }, [activeTab, isEditing])

  const { houseType, baselineChoice, usualHouse, overrides, fieldOverrides } = persisted
  const houseFields = useMemo(() => resolveHouseFields(houseType, fieldOverrides), [houseType, fieldOverrides])
  const cost = useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, frozenOrder })

  // The footer button is enabled whenever any card has a pick (spec 2.2).
  const anyPick = Object.keys(selections).length > 0 || Boolean(wallSelection.wallType)
    || (wallSelection.simpleIndex !== undefined && wallSelection.simpleIndex !== null)
  const showChip = persisted.hasOpenedCost && !persisted.chipHidden

  const openCost = () => {
    setActiveTab('cost')
    if (!persisted.hasOpenedCost) patch({ hasOpenedCost: true })
  }
  // The tab bar is inert while the baseline editor is open (spec 2.1, M5).
  const changeTab = id => {
    if (editing) return
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

  const onEditUsual = () => setEditing({ initialPicks: usualHouse[houseType] || getPresetPicks('typicalTier2', houseType) })
  const closeEditor = () => { setEditing(null); setEditorDirty(false) }
  const onEditorDone = picks => {
    patch(prev => ({ usualHouse: { ...prev.usualHouse, [houseType]: picks }, baselineChoice: 'usualHouse' }))
    closeEditor()
  }
  const onEditorCancel = () => {
    if (editorDirty && !window.confirm('Discard changes to your usual house?')) return
    closeEditor()
  }
  const onResetUsual = () => patch(prev => {
    const next = { ...prev.usualHouse }
    delete next[houseType]
    return { usualHouse: next, baselineChoice: 'typicalTier2' }
  })
  // "view" on a baseline pick (spec rev 3 3.2): a preset opens read-only; Your usual house opens for editing.
  const onViewBaselineCard = cardId => {
    if (cost.baselineId === 'usualHouse' && usualHouse[houseType]) setEditing({ initialPicks: usualHouse[houseType], focusCard: cardId })
    else setEditing({ initialPicks: cost.baselinePicks, readOnly: true, baselineName: cost.baselineName, focusCard: cardId })
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
          className="dark-toggle"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? 'Light' : 'Dark'}
        </button>
        {showChip && activeTab === 'points' && (
          <HeaderCostChip
            text={chipText(cost.delta.headline.exact)}
            secondLine={chipSecondLine(cost.delta.headline.exact, cost.baselineName, cost.overrideCount > 0)}
            onOpen={openCost}
            onHide={() => patch({ chipHidden: true })}
          />
        )}
        <PointsCounter total={totalPoints} target={targetPoints} />
      </header>

      <TabBar active={activeTab} onChange={changeTab} disabled={isEditing} />

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
                onSelect={setWallSelection}
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
        {activeTab === 'cost' && (editing
          ? (
            <BaselineEditor
              initialPicks={editing.initialPicks}
              houseType={houseType}
              fillMissing={!editing.readOnly}
              readOnly={Boolean(editing.readOnly)}
              baselineName={editing.baselineName}
              focusCard={editing.focusCard}
              onDone={onEditorDone}
              onCancel={onEditorCancel}
              onDirtyChange={setEditorDirty}
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
              chipHidden={persisted.chipHidden}
              onToggleChip={() => patch(prev => ({ chipHidden: !prev.chipHidden }))}
              openLine={openLine}
              onOpenLine={setOpenLine}
              level3={level3}
              onLevel3={setLevel3}
              onFreezeOrder={setFrozenOrder}
              notice={notice}
            />
          ))}
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
