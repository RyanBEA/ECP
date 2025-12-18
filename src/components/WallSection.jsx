import React from 'react'

/**
 * WallSection - Top-down cross-section of a wall assembly (rotated 90°)
 *
 * Layers (inside to outside, top to bottom):
 * 1. Drywall (1/2" fixed)
 * 2. Studs + cavity insulation (dynamic: 2x4=3.5", 2x6=5.5")
 * 3. Sheathing (1/2" fixed)
 * 4. Continuous insulation (dynamic: 0-4")
 * 5. Cladding (1/2" fixed)
 */
export default function WallSection({
  studDepth = '2x6',      // '2x4' or '2x6'
  studSpacing = 16,       // 16 or 24 inches
  continuousIns = 0,      // inches of continuous insulation
  cavityInsLabel = null,  // Full label like "2x6 R20"
  continuousInsLabel = null, // Full label like "2\" XPS" or "None"
  width = 600,
}) {
  // Use consistent scale for proper proportions
  const scale = 10 // pixels per inch

  // Fixed dimensions (inches)
  const drywallThickness = 0.5
  const sheathingThickness = 7 / 16  // 7/16" is common wall sheathing
  const claddingThickness = 0.5

  // Dynamic dimensions
  const studDepthInches = studDepth === '2x4' ? 3.5 : 5.5
  const studWidthInches = 1.5 // actual width of a 2x stud

  // Wall length to show (inches) - 1.5 stud bays (2.5 studs visible)
  const wallLengthInches = studSpacing * 1.5

  // Calculate total wall thickness
  const totalThickness =
    drywallThickness +
    studDepthInches +
    sheathingThickness +
    continuousIns +
    claddingThickness

  // SVG dimensions - use same scale for both directions
  const wallWidthPx = wallLengthInches * scale
  const svgWidth = wallWidthPx + 180 // room for offset labels with leader lines
  const svgHeight = totalThickness * scale + 80

  // Calculate layer positions (y coordinates, top to bottom)
  const startY = 30
  const drywallY = startY
  const studCavityY = startY + drywallThickness * scale
  const sheathingY = startY + (drywallThickness + studDepthInches) * scale
  const contInsY = startY + (drywallThickness + studDepthInches + sheathingThickness) * scale
  const claddingY = startY + (drywallThickness + studDepthInches + sheathingThickness + continuousIns) * scale

  // Calculate stud positions
  const numStuds = Math.ceil(wallLengthInches / studSpacing) + 1

  // Colors
  const colors = {
    drywall: '#e5e7eb',
    stud: '#d4a574',    // Light brown for wood
    cavity: '#fce7f3',  // Pink to match continuous insulation
    sheathing: '#d1d5db',
    contIns: '#fce7f3',
    cladding: '#9ca3af',
  }

  // Generate batt insulation pattern - semicircles at edges + diagonal lines
  // Three overlapping instances offset by period/3 each
  const generateCavityPattern = (startX, cavityWidth, startYPos, cavityHeight) => {
    // Cavity bounds (drywall surface to sheathing surface)
    const cavityTop = startYPos
    const cavityBottom = startYPos + cavityHeight
    const h = cavityHeight

    // Radius of semicircles
    const r = h * 0.20

    // Offset inward so semicircles stay within cavity
    // Top semicircles drawn at topY, bulge UP by r -> topY must be at cavityTop + r
    // Bottom semicircles drawn at bottomY, bulge DOWN by r -> bottomY must be at cavityBottom - r
    const topY = cavityTop + r
    const bottomY = cavityBottom - r

    // Period is 3r (one semicircle width 2r + one diagonal r)
    const period = 3 * r

    // Unique clip path ID for this cavity
    const clipId = `cavity-clip-${startX}-${startYPos}`

    // Generate one instance of the pattern
    const generatePath = (offsetX) => {
      const numSegments = Math.ceil((cavityWidth + period * 2) / (period / 2)) + 4
      // Start from negative offset to fill from left edge
      let x = startX + offsetX - period
      let d = `M ${x} ${topY}`

      for (let i = 0; i < numSegments; i++) {
        if (x > startX + cavityWidth + period) break

        if (i % 2 === 0) {
          // Top semicircle - curves DOWN into cavity
          d += ` A ${r} ${r} 0 1 1 ${x + 2 * r} ${topY}`
          x += 2 * r
          // Diagonal line down-right to bottom
          d += ` L ${x + r} ${bottomY}`
          x += r
        } else {
          // Bottom semicircle - curves UP into cavity
          d += ` A ${r} ${r} 0 1 0 ${x + 2 * r} ${bottomY}`
          x += 2 * r
          // Diagonal line up-right to top
          d += ` L ${x + r} ${topY}`
          x += r
        }
      }
      return d
    }

    // Three overlapping paths, clipped to cavity bounds
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={startX} y={startYPos} width={cavityWidth} height={cavityHeight} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path d={generatePath(0)} fill="none" stroke="#db2777" strokeWidth="1" />
          <path d={generatePath(2 * r)} fill="none" stroke="#db2777" strokeWidth="1" />
          <path d={generatePath(4 * r)} fill="none" stroke="#db2777" strokeWidth="1" />
        </g>
      </g>
    )
  }

  // Generate continuous insulation pattern - staggered vertical lines
  // Lines from inside surface to mid-depth, offset lines from outside surface to mid-depth
  const generateContInsPattern = (startX, width, startY, height) => {
    const midY = startY + height / 2
    const spacing = 8 // horizontal spacing between lines
    const numLines = Math.ceil(width / spacing) + 1

    const paths = []

    for (let i = 0; i < numLines; i++) {
      const x = startX + i * spacing

      if (i % 2 === 0) {
        // Even lines: from top (inside surface) to mid-depth
        paths.push(
          <line
            key={`cont-ins-${i}`}
            x1={x}
            y1={startY}
            x2={x}
            y2={midY}
            stroke="#db2777"
            strokeWidth="1"
          />
        )
      } else {
        // Odd lines: from bottom (outside surface) to mid-depth
        paths.push(
          <line
            key={`cont-ins-${i}`}
            x1={x}
            y1={startY + height}
            x2={x}
            y2={midY}
            stroke="#db2777"
            strokeWidth="1"
          />
        )
      }
    }

    return <g>{paths}</g>
  }

  // Pattern IDs (kept for reference but not used for continuous insulation)
  const contInsPatternId = 'continuous-insulation-pattern'

  return (
    <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '200px' }}
      >
        {/* Pattern definitions */}
        <defs>
          {/* Continuous insulation - staggered vertical dashes */}
          <pattern
            id={contInsPatternId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="10"
          >
            {/* Row 1 - line at 1/4 position */}
            <line x1="2" y1="0" x2="2" y2="5" stroke="#db2777" strokeWidth="1" />
            {/* Row 2 - line at 3/4 position (offset by half width) */}
            <line x1="6" y1="5" x2="6" y2="10" stroke="#db2777" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Interior label */}
        <text x={svgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
          INTERIOR
        </text>

        <g transform="translate(20, 0)">
          {/* 1. Drywall layer */}
          <rect
            x={0}
            y={drywallY}
            width={wallWidthPx}
            height={drywallThickness * scale}
            fill={colors.drywall}
            stroke="#9ca3af"
            strokeWidth="1"
          />

          {/* 2. Stud cavity background */}
          <rect
            x={0}
            y={studCavityY}
            width={wallWidthPx}
            height={studDepthInches * scale}
            fill={colors.cavity}
            stroke="#9ca3af"
            strokeWidth="1"
          />

          {/* Cavity insulation pattern between studs */}
          {Array.from({ length: numStuds - 1 }).map((_, i) => {
            const cavityStartX = (i * studSpacing + studWidthInches) * scale
            const cavityWidth = (studSpacing - studWidthInches) * scale
            if (cavityStartX >= wallWidthPx) return null
            const actualWidth = Math.min(cavityWidth, wallWidthPx - cavityStartX)
            return (
              <g key={`cavity-${i}`}>
                {generateCavityPattern(cavityStartX, actualWidth, studCavityY, studDepthInches * scale)}
              </g>
            )
          })}

          {/* Studs with X pattern */}
          {Array.from({ length: numStuds }).map((_, i) => {
            const studX = i * studSpacing * scale
            const studW = studWidthInches * scale
            const studH = studDepthInches * scale
            if (studX >= wallWidthPx) return null
            const actualW = Math.min(studW, wallWidthPx - studX)
            return (
              <g key={`stud-${i}`}>
                {/* Stud rectangle */}
                <rect
                  x={studX}
                  y={studCavityY}
                  width={actualW}
                  height={studH}
                  fill={colors.stud}
                  stroke="#333"
                  strokeWidth="1"
                />
                {/* X pattern for wood - only if full stud visible */}
                {actualW >= studW - 1 && (
                  <>
                    <line
                      x1={studX + 1}
                      y1={studCavityY + 1}
                      x2={studX + studW - 1}
                      y2={studCavityY + studH - 1}
                      stroke="#333"
                      strokeWidth="1"
                    />
                    <line
                      x1={studX + studW - 1}
                      y1={studCavityY + 1}
                      x2={studX + 1}
                      y2={studCavityY + studH - 1}
                      stroke="#333"
                      strokeWidth="1"
                    />
                  </>
                )}
              </g>
            )
          })}

          {/* 3. Sheathing layer */}
          <rect
            x={0}
            y={sheathingY}
            width={wallWidthPx}
            height={sheathingThickness * scale}
            fill={colors.sheathing}
            stroke="#6b7280"
            strokeWidth="1"
          />

          {/* 4. Continuous insulation (if any) */}
          {continuousIns > 0 && (
            <g>
              {/* Background */}
              <rect
                x={0}
                y={contInsY}
                width={wallWidthPx}
                height={continuousIns * scale}
                fill="#fce7f3"
                stroke="#db2777"
                strokeWidth="1"
              />
              {/* Staggered line pattern */}
              {generateContInsPattern(0, wallWidthPx, contInsY, continuousIns * scale)}
            </g>
          )}

          {/* 5. Cladding layer */}
          <rect
            x={0}
            y={claddingY}
            width={wallWidthPx}
            height={claddingThickness * scale}
            fill={colors.cladding}
            stroke="#4b5563"
            strokeWidth="1"
          />

          {/* Dimension labels on the right side - offset with leader lines */}
          {(() => {
            // Calculate layer midpoints for leader line targets
            // Use user's selections for labels when available
            const cavityLabel = cavityInsLabel || `${studDepth} stud`
            const contInsDisplayLabel = continuousInsLabel && continuousInsLabel !== 'None'
              ? continuousInsLabel
              : `${continuousIns}" cont. ins.`

            const layers = [
              { name: '½" drywall', midY: drywallY + drywallThickness * scale / 2 },
              { name: cavityLabel, midY: studCavityY + studDepthInches * scale / 2 },
              { name: '7/16" sheathing', midY: sheathingY + sheathingThickness * scale / 2 },
              ...(continuousIns > 0 ? [{ name: contInsDisplayLabel, midY: contInsY + continuousIns * scale / 2 }] : []),
              { name: '½" cladding', midY: claddingY + claddingThickness * scale / 2 },
            ]

            // Fixed label spacing to prevent overlap
            const labelSpacing = 14
            const labelStartY = startY + 5
            const labelX = wallWidthPx + 80 // offset labels further right

            return (
              <g>
                {layers.map((layer, i) => {
                  const labelY = labelStartY + i * labelSpacing
                  const layerMidY = layer.midY

                  return (
                    <g key={layer.name}>
                      {/* Leader line: horizontal from wall edge, then angled to label */}
                      <path
                        d={`M ${wallWidthPx + 20} ${layerMidY}
                            L ${wallWidthPx + 40} ${layerMidY}
                            L ${labelX - 5} ${labelY}`}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1"
                      />
                      {/* Small dot at layer */}
                      <circle cx={wallWidthPx + 20} cy={layerMidY} r="2" fill="#9ca3af" />
                      {/* Label text */}
                      <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
                    </g>
                  )
                })}
              </g>
            )
          })()}

          {/* Stud spacing dimension at bottom */}
          <g transform={`translate(0, ${claddingY + claddingThickness * scale + 15})`}>
            <line x1={0} y1="0" x2={studSpacing * scale} y2="0" stroke="#9ca3af" strokeWidth="1" />
            <line x1={0} y1="-5" x2={0} y2="5" stroke="#9ca3af" strokeWidth="1" />
            <line x1={studSpacing * scale} y1="-5" x2={studSpacing * scale} y2="5" stroke="#9ca3af" strokeWidth="1" />
            <text x={studSpacing * scale / 2} y="15" textAnchor="middle" fontSize="10" fill="#6b7280">
              {studSpacing}" o.c.
            </text>
          </g>
        </g>

        {/* Exterior label */}
        <text x={svgWidth / 2} y={claddingY + claddingThickness * scale + 45} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
          EXTERIOR
        </text>
      </svg>
    </div>
  )
}
