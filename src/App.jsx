import React, { useState, useMemo, useEffect } from 'react'
import { categories, tiers, calculateWallRsi, getWallPoints } from './data/ecpData'
import CategoryCard from './components/CategoryCard'
import WallBuilder from './components/WallBuilder'
import PointsCounter from './components/PointsCounter'

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

  // Handle option selection for standard categories
  const handleSelect = (categoryId, optionIndex) => {
    const category = categories.find(c => c.id === categoryId)

    setSelections(prev => {
      const next = { ...prev }

      // If this category is in an exclusive group, clear other members
      if (category.exclusiveGroup) {
        categories
          .filter(c => c.exclusiveGroup === category.exclusiveGroup && c.id !== categoryId)
          .forEach(c => delete next[c.id])
      }

      // Set or clear the selection
      if (optionIndex === null) {
        delete next[categoryId]
      } else {
        next[categoryId] = optionIndex
      }

      return next
    })
  }

  // Calculate wall points from wall selection (either simple or builder mode)
  const wallPoints = useMemo(() => {
    const { simpleIndex } = wallSelection

    // Simple mode - direct option selection
    if (simpleIndex !== undefined && simpleIndex !== null) {
      const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')
      return wallCategory.options[simpleIndex].points
    }

    // Builder mode - lookup from assembly
    const rsi = calculateWallRsi(wallSelection)
    return getWallPoints(rsi)
  }, [wallSelection])

  // Calculate total points
  const totalPoints = useMemo(() => {
    const categoryPoints = Object.entries(selections).reduce((sum, [categoryId, optionIndex]) => {
      const category = categories.find(c => c.id === categoryId)
      if (category && category.options && optionIndex !== null) {
        return sum + category.options[optionIndex].points
      }
      return sum
    }, 0)

    return categoryPoints + wallPoints
  }, [selections, wallPoints])

  // Check if a category is disabled (due to exclusive group)
  const isDisabled = (category) => {
    if (!category.exclusiveGroup) return false

    // Check if another category in the same group is selected
    return categories
      .filter(c => c.exclusiveGroup === category.exclusiveGroup && c.id !== category.id)
      .some(c => selections[c.id] !== undefined)
  }

  const targetPoints = selectedTier.points

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <header className="app-header">
        <img
          src={darkMode ? '/logodarkmode.png' : '/logolightmode.png'}
          alt="BEA Logo"
          className="header-logo"
        />
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
        <PointsCounter total={totalPoints} target={targetPoints} />
      </header>

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
        <p>
          {totalPoints >= targetPoints
            ? `Target met! You have ${totalPoints.toFixed(1)} ECP.`
            : `Need ${(targetPoints - totalPoints).toFixed(1)} more points to reach ${selectedTier.label}.`
          }
        </p>
        <div className="footer-meta">
          <span className="footer-version">v0.5.0 — Updated 2026-03-10</span>
          <a
            className="source-link"
            href="https://beafiles.blob.core.windows.net/public/RSI-calc.xlsx"
            target="_blank"
            rel="noopener noreferrer"
          >
            Excel source
          </a>
        </div>
      </footer>
    </div>
  )
}
