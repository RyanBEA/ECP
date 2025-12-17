import React, { useState } from 'react'
import WallSection from './components/WallSection'

/**
 * Demo page for testing the WallSection component
 */
export default function WallSectionDemo() {
  const [studDepth, setStudDepth] = useState('2x6')
  const [studSpacing, setStudSpacing] = useState(16)
  const [continuousIns, setContinuousIns] = useState(1)

  return (
    <div style={{
      padding: '24px',
      maxWidth: '900px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ marginBottom: '24px', color: '#1f2937' }}>
        Wall Section Proof of Concept
      </h1>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '24px',
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px',
        flexWrap: 'wrap'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>
            Stud Depth
          </label>
          <select
            value={studDepth}
            onChange={e => setStudDepth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value="2x4">2x4 (3.5")</option>
            <option value="2x6">2x6 (5.5")</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>
            Stud Spacing
          </label>
          <select
            value={studSpacing}
            onChange={e => setStudSpacing(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value={16}>16" o.c.</option>
            <option value={24}>24" o.c.</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>
            Continuous Insulation
          </label>
          <select
            value={continuousIns}
            onChange={e => setContinuousIns(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value={0}>None</option>
            <option value={1}>1"</option>
            <option value={1.5}>1.5"</option>
            <option value={2}>2"</option>
            <option value={3}>3"</option>
            <option value={4}>4"</option>
          </select>
        </div>
      </div>

      {/* Wall Section Visualization */}
      <WallSection
        studDepth={studDepth}
        studSpacing={studSpacing}
        continuousIns={continuousIns}
        width={850}
      />
    </div>
  )
}
