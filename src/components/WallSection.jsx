import React from 'react'

/**
 * WallSection - Top-down cross-section of a wall assembly (rotated 90°)
 *
 * Three rendering modes:
 * - Wood frame: studs with X pattern, cavity insulation, sheathing, optional continuous insulation
 * - Steel frame: C-channel studs, cavity insulation, sheathing, optional continuous insulation
 * - ICF: drywall -> EPS foam -> concrete -> EPS foam -> cladding
 */
export default function WallSection({
  wallType = 'wood',           // 'wood', 'steel', or 'icf'
  studDepth = '2x6',           // '2x4' or '2x6'
  studSpacing = 16,            // 16, 19, or 24 inches
  continuousIns = 0,           // inches of continuous insulation
  cavityInsLabel = null,       // Full label like "2x6 R20"
  continuousInsLabel = null,   // Full label like "2\" XPS" or "None"
  icfFormThickness = 0,        // ICF only: inches per side
  width = 600,
}) {
  // Use consistent scale for proper proportions
  const scale = 10 // pixels per inch

  // Fixed dimensions (inches)
  const drywallThickness = 0.5
  const sheathingThickness = 7 / 16  // 7/16" is common wall sheathing
  const claddingThickness = 0.5

  // Colors
  const colors = {
    drywall: '#e5e7eb',
    stud: '#d4a574',       // Light brown for wood
    steelStud: '#94a3b8',  // Slate gray for steel
    cavity: '#fce7f3',     // Pink to match continuous insulation
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
    const topY = cavityTop + r
    const bottomY = cavityBottom - r

    // Period is 3r (one semicircle width 2r + one diagonal r)
    const period = 3 * r

    // Unique clip path ID for this cavity
    const clipId = `cavity-clip-${startX}-${startYPos}`

    // Generate one instance of the pattern
    const generatePath = (offsetX) => {
      const numSegments = Math.ceil((cavityWidth + period * 2) / (period / 2)) + 4
      let x = startX + offsetX - period
      let d = `M ${x} ${topY}`

      for (let i = 0; i < numSegments; i++) {
        if (x > startX + cavityWidth + period) break

        if (i % 2 === 0) {
          d += ` A ${r} ${r} 0 1 1 ${x + 2 * r} ${topY}`
          x += 2 * r
          d += ` L ${x + r} ${bottomY}`
          x += r
        } else {
          d += ` A ${r} ${r} 0 1 0 ${x + 2 * r} ${bottomY}`
          x += 2 * r
          d += ` L ${x + r} ${topY}`
          x += r
        }
      }
      return d
    }

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
  const generateContInsPattern = (startX, patternWidth, startY, height) => {
    const midY = startY + height / 2
    const spacing = 8
    const numLines = Math.ceil(patternWidth / spacing) + 1

    const paths = []

    for (let i = 0; i < numLines; i++) {
      const x = startX + i * spacing

      if (i % 2 === 0) {
        paths.push(
          <line
            key={`cont-ins-${i}`}
            x1={x} y1={startY} x2={x} y2={midY}
            stroke="#db2777" strokeWidth="1"
          />
        )
      } else {
        paths.push(
          <line
            key={`cont-ins-${i}`}
            x1={x} y1={startY + height} x2={x} y2={midY}
            stroke="#db2777" strokeWidth="1"
          />
        )
      }
    }

    return <g>{paths}</g>
  }

  // --- ICF Rendering ---
  if (wallType === 'icf') {
    const epsThickness = icfFormThickness  // inches per side
    const concreteThickness = 8  // inches, fixed
    const icfTotalThickness = drywallThickness + epsThickness + concreteThickness + epsThickness + claddingThickness
    const icfWallLength = 24  // fixed display width in inches
    const icfWallWidthPx = icfWallLength * scale
    const icfSvgWidth = icfWallWidthPx + 180
    const icfSvgHeight = icfTotalThickness * scale + 80

    const icfStartY = 30
    const icfDrywallY = icfStartY
    const icfEpsIntY = icfStartY + drywallThickness * scale
    const icfConcreteY = icfEpsIntY + epsThickness * scale
    const icfEpsExtY = icfConcreteY + concreteThickness * scale
    const icfCladdingY = icfEpsExtY + epsThickness * scale

    const icfLayers = [
      { name: '1/2" drywall', midY: icfDrywallY + drywallThickness * scale / 2 },
      { name: `${icfFormThickness}" EPS (interior)`, midY: icfEpsIntY + epsThickness * scale / 2 },
      { name: '8" concrete', midY: icfConcreteY + concreteThickness * scale / 2 },
      { name: `${icfFormThickness}" EPS (exterior)`, midY: icfEpsExtY + epsThickness * scale / 2 },
      { name: '1/2" cladding', midY: icfCladdingY + claddingThickness * scale / 2 },
    ]

    // Deterministic speckle positions for concrete
    const concreteSpeckles = Array.from({ length: 40 }).map((_, i) => ({
      x: ((i * 17 + 7) % 100) / 100,
      y: ((i * 31 + 13) % 100) / 100
    }))

    return (
      <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${icfSvgWidth} ${icfSvgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '250px' }}
        >
          <text x={icfSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            INTERIOR
          </text>

          <g transform="translate(20, 0)">
            {/* Drywall */}
            <rect x={0} y={icfDrywallY} width={icfWallWidthPx}
              height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />

            {/* EPS interior */}
            <rect x={0} y={icfEpsIntY} width={icfWallWidthPx}
              height={epsThickness * scale} fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
            {generateContInsPattern(0, icfWallWidthPx, icfEpsIntY, epsThickness * scale)}

            {/* Concrete core */}
            <rect x={0} y={icfConcreteY} width={icfWallWidthPx}
              height={concreteThickness * scale} fill="#6b7280" stroke="#374151" strokeWidth="1" />
            {/* Aggregate speckle pattern — deterministic */}
            {concreteSpeckles.map((sp, i) => (
              <circle
                key={`speckle-${i}`}
                cx={sp.x * icfWallWidthPx}
                cy={icfConcreteY + sp.y * concreteThickness * scale}
                r={1.5}
                fill="#9ca3af"
                opacity={0.5}
              />
            ))}

            {/* EPS exterior */}
            <rect x={0} y={icfEpsExtY} width={icfWallWidthPx}
              height={epsThickness * scale} fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
            {generateContInsPattern(0, icfWallWidthPx, icfEpsExtY, epsThickness * scale)}

            {/* Cladding */}
            <rect x={0} y={icfCladdingY} width={icfWallWidthPx}
              height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />

            {/* Labels */}
            {(() => {
              const labelSpacing = 14
              const labelStartY = icfStartY + 5
              const labelX = icfWallWidthPx + 80

              return (
                <g>
                  {icfLayers.map((layer, i) => {
                    const labelY = labelStartY + i * labelSpacing
                    return (
                      <g key={layer.name}>
                        <path
                          d={`M ${icfWallWidthPx + 20} ${layer.midY}
                              L ${icfWallWidthPx + 40} ${layer.midY}
                              L ${labelX - 5} ${labelY}`}
                          fill="none" stroke="#9ca3af" strokeWidth="1" />
                        <circle cx={icfWallWidthPx + 20} cy={layer.midY} r="2" fill="#9ca3af" />
                        <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
                      </g>
                    )
                  })}
                </g>
              )
            })()}
          </g>

          <text x={icfSvgWidth / 2} y={icfCladdingY + claddingThickness * scale + 25}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            EXTERIOR
          </text>
        </svg>
      </div>
    )
  }

  // --- Wood/Steel Framed Wall Rendering ---

  // Dynamic dimensions
  const studDepthInches = studDepth === '2x4' ? 3.5 : 5.5
  const studWidthInches = 1.5

  // Wall length to show (inches) - 1.5 stud bays (2.5 studs visible)
  const wallLengthInches = studSpacing * 1.5

  // Calculate total wall thickness
  const totalThickness =
    drywallThickness +
    studDepthInches +
    sheathingThickness +
    continuousIns +
    claddingThickness

  // SVG dimensions
  const wallWidthPx = wallLengthInches * scale
  const svgWidth = wallWidthPx + 180
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
          <pattern
            id={contInsPatternId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="10"
          >
            <line x1="2" y1="0" x2="2" y2="5" stroke="#db2777" strokeWidth="1" />
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
            x={0} y={drywallY} width={wallWidthPx}
            height={drywallThickness * scale}
            fill={colors.drywall} stroke="#9ca3af" strokeWidth="1"
          />

          {/* 2. Stud cavity background */}
          <rect
            x={0} y={studCavityY} width={wallWidthPx}
            height={studDepthInches * scale}
            fill={colors.cavity} stroke="#9ca3af" strokeWidth="1"
          />

          {/* Cavity insulation pattern */}
          {wallType === 'steel'
            ? /* Steel: continuous pattern across full width (studs render on top) */
              generateCavityPattern(0, wallWidthPx, studCavityY, studDepthInches * scale)
            : /* Wood: pattern only between studs (solid wood covers stud areas) */
              Array.from({ length: numStuds - 1 }).map((_, i) => {
                const cavityStartX = (i * studSpacing + studWidthInches) * scale
                const cavityWidth = (studSpacing - studWidthInches) * scale
                if (cavityStartX >= wallWidthPx) return null
                const actualWidth = Math.min(cavityWidth, wallWidthPx - cavityStartX)
                return (
                  <g key={`cavity-${i}`}>
                    {generateCavityPattern(cavityStartX, actualWidth, studCavityY, studDepthInches * scale)}
                  </g>
                )
              })
          }

          {/* Studs — wood or steel */}
          {Array.from({ length: numStuds }).map((_, i) => {
            const studX = i * studSpacing * scale
            const studW = studWidthInches * scale
            const studH = studDepthInches * scale
            if (studX >= wallWidthPx) return null
            const actualW = Math.min(studW, wallWidthPx - studX)
            return (
              <g key={`stud-${i}`}>
                {/* Wood stud: solid rectangle + X pattern */}
                {wallType === 'wood' && (
                  <>
                    <rect
                      x={studX} y={studCavityY} width={actualW} height={studH}
                      fill={colors.stud} stroke="#333" strokeWidth="1"
                    />
                    {actualW >= studW - 1 && (
                      <>
                        <line
                          x1={studX + 1} y1={studCavityY + 1}
                          x2={studX + studW - 1} y2={studCavityY + studH - 1}
                          stroke="#333" strokeWidth="1"
                        />
                        <line
                          x1={studX + studW - 1} y1={studCavityY + 1}
                          x2={studX + 1} y2={studCavityY + studH - 1}
                          stroke="#333" strokeWidth="1"
                        />
                      </>
                    )}
                  </>
                )}

                {/* Steel stud: C-channel (top flange, bottom flange, web) */}
                {wallType === 'steel' && actualW >= studW - 1 && (() => {
                  const flangeW = studW
                  const webThickness = 1.5
                  const flangeThickness = 1.5
                  return (
                    <>
                      {/* Top flange */}
                      <rect x={studX} y={studCavityY} width={flangeW} height={flangeThickness}
                        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
                      {/* Bottom flange */}
                      <rect x={studX} y={studCavityY + studH - flangeThickness} width={flangeW} height={flangeThickness}
                        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
                      {/* Web (left edge) */}
                      <rect x={studX} y={studCavityY} width={webThickness} height={studH}
                        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
                    </>
                  )
                })()}
              </g>
            )
          })}

          {/* 3. Sheathing layer */}
          <rect
            x={0} y={sheathingY} width={wallWidthPx}
            height={sheathingThickness * scale}
            fill={colors.sheathing} stroke="#6b7280" strokeWidth="1"
          />

          {/* 4. Continuous insulation (if any) */}
          {continuousIns > 0 && (
            <g>
              <rect
                x={0} y={contInsY} width={wallWidthPx}
                height={continuousIns * scale}
                fill="#fce7f3" stroke="#db2777" strokeWidth="1"
              />
              {generateContInsPattern(0, wallWidthPx, contInsY, continuousIns * scale)}
            </g>
          )}

          {/* 5. Cladding layer */}
          <rect
            x={0} y={claddingY} width={wallWidthPx}
            height={claddingThickness * scale}
            fill={colors.cladding} stroke="#4b5563" strokeWidth="1"
          />

          {/* Dimension labels on the right side */}
          {(() => {
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

            const labelSpacing = 14
            const labelStartY = startY + 5
            const labelX = wallWidthPx + 80

            return (
              <g>
                {layers.map((layer, i) => {
                  const labelY = labelStartY + i * labelSpacing
                  const layerMidY = layer.midY

                  return (
                    <g key={layer.name}>
                      <path
                        d={`M ${wallWidthPx + 20} ${layerMidY}
                            L ${wallWidthPx + 40} ${layerMidY}
                            L ${labelX - 5} ${labelY}`}
                        fill="none" stroke="#9ca3af" strokeWidth="1"
                      />
                      <circle cx={wallWidthPx + 20} cy={layerMidY} r="2" fill="#9ca3af" />
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
