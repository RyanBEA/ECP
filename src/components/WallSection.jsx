import React from 'react'

/**
 * WallSection - Top-down cross-section of a wall assembly (rotated 90°)
 *
 * Rendering modes:
 * - Wood frame: studs with X pattern, cavity insulation, sheathing, optional continuous insulation
 * - Steel frame: C-channel studs, cavity insulation, sheathing, optional continuous insulation
 * - ICF: drywall -> EPS foam -> concrete -> EPS foam -> cladding
 * - Double stud: two wood stud walls with optional gap and service wall
 * - Single + service wall: primary stud wall with interior service cavity
 */
export default function WallSection({
  wallType = 'wood',           // 'wood', 'steel', or 'icf'
  studDepth = '2x6',           // '2x4' or '2x6'
  studSpacing = 16,            // 16, 19, or 24 inches
  continuousIns = 0,           // inches of continuous insulation
  cavityInsLabel = null,       // Full label like "2x6 R20"
  continuousInsLabel = null,   // Full label like "2\" XPS" or "None"
  icfFormThickness = 0,        // ICF only: inches per side
  claddingLabel = null,        // Override label for cladding layer
  sheathingLabel = null,       // Override label for sheathing layer
  assemblyType = 'single',    // 'single' or 'doubleStud'
  hasServiceWall = false,      // Whether to render a service wall
  outerStudDepth = '2x4',     // Double stud: outer wall stud size
  innerStudDepth = '2x4',     // Double stud: inner wall stud size
  gapInches = 0,              // Double stud: gap between walls
  serviceStudDepth = '2x4',   // Service wall stud size
  serviceSpacingInches = 16,  // Service wall stud spacing
  serviceCavityLabel = null,  // Label for service wall cavity
  interiorLayerLabel = null,  // Label for interior layer (between service and primary)
  interiorLayerThicknessInches = 0, // Thickness of interior layer
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

  // Deep stud dimension map
  const studDepthMap = {
    '2x4': 3.5, '2x6': 5.5, '2x8': 7.25, '2x10': 9.25, '2x12': 11.25,
  }
  const toStudDepthInches = (size) => studDepthMap[size] || 5.5
  const studDepthInches = toStudDepthInches(studDepth)

  // Compute wall length from the widest stud spacing (so all stud rows are visible)
  const maxSpacing = hasServiceWall ? Math.max(studSpacing, serviceSpacingInches) : studSpacing
  const wallLengthInches = maxSpacing * 1.5
  const wallWidthPx = wallLengthInches * scale
  const studWidthInches = 1.5

  // Shared helper: compute non-overlapping label Y positions
  // Starts labels at layer midpoints, then pushes apart any that overlap
  const computeLabelPositions = (layers, minSpacing = 14) => {
    // Start at each layer's midpoint
    const positions = layers.map(l => l.midY)
    // Forward pass: push labels down if they overlap
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] < minSpacing) {
        positions[i] = positions[i - 1] + minSpacing
      }
    }
    return positions
  }

  // Shared helper: render labels with leader lines using relaxed positions
  const renderLabels = (layers, wallWidth, startY) => {
    const labelX = wallWidth + 80
    const positions = computeLabelPositions(layers)
    return (
      <g>
        {layers.map((layer, i) => {
          const labelY = positions[i]
          return (
            <g key={layer.name + i}>
              <path d={`M ${wallWidth + 20} ${layer.midY} L ${wallWidth + 40} ${layer.midY} L ${labelX - 5} ${labelY}`}
                fill="none" stroke="#9ca3af" strokeWidth="1" />
              <circle cx={wallWidth + 20} cy={layer.midY} r="2" fill="#9ca3af" />
              <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
            </g>
          )
        })}
      </g>
    )
  }

  // Shared helper: renders a wood stud+cavity section
  const renderStudCavity = (startY, depth, spacingIn) => {
    const studH = depth * scale
    const numSt = Math.ceil(wallLengthInches / spacingIn) + 1
    return (
      <g>
        <rect x={0} y={startY} width={wallWidthPx} height={studH}
          fill={colors.cavity} stroke="#9ca3af" strokeWidth="1" />
        {Array.from({ length: numSt - 1 }).map((_, i) => {
          const cavStartX = (i * spacingIn + studWidthInches) * scale
          const cavW = (spacingIn - studWidthInches) * scale
          if (cavStartX >= wallWidthPx) return null
          return (
            <g key={`cav-${startY}-${i}`}>
              {generateCavityPattern(cavStartX, Math.min(cavW, wallWidthPx - cavStartX), startY, studH)}
            </g>
          )
        })}
        {Array.from({ length: numSt }).map((_, i) => {
          const sx = i * spacingIn * scale
          const sw = studWidthInches * scale
          if (sx >= wallWidthPx) return null
          const aw = Math.min(sw, wallWidthPx - sx)
          return (
            <g key={`stud-${startY}-${i}`}>
              <rect x={sx} y={startY} width={aw} height={studH}
                fill={colors.stud} stroke="#333" strokeWidth="1" />
              {aw >= sw - 1 && (
                <>
                  <line x1={sx + 1} y1={startY + 1} x2={sx + sw - 1} y2={startY + studH - 1}
                    stroke="#333" strokeWidth="1" />
                  <line x1={sx + sw - 1} y1={startY + 1} x2={sx + 1} y2={startY + studH - 1}
                    stroke="#333" strokeWidth="1" />
                </>
              )}
            </g>
          )
        })}
      </g>
    )
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

            {renderLabels(icfLayers, icfWallWidthPx, icfStartY)}
          </g>

          <text x={icfSvgWidth / 2} y={icfCladdingY + claddingThickness * scale + 25}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            EXTERIOR
          </text>
        </svg>
      </div>
    )
  }

  // --- Double Stud Rendering ---
  // Draws one unified insulation fill across the entire cavity (inner studs + gap + outer studs)
  // with studs drawn on top, matching how blown-in insulation actually fills the assembly.
  if (assemblyType === 'doubleStud' && wallType === 'wood') {
    const outerDepth = toStudDepthInches(outerStudDepth)
    const innerDepth = toStudDepthInches(innerStudDepth)
    const svcDepth = hasServiceWall ? toStudDepthInches(serviceStudDepth) : 0
    const intLayerThick = hasServiceWall ? interiorLayerThicknessInches : 0
    const dsCavityDepth = innerDepth + gapInches + outerDepth

    const totalThickness =
      drywallThickness +
      (hasServiceWall ? svcDepth + intLayerThick : 0) +
      dsCavityDepth +
      sheathingThickness + claddingThickness

    const dsSvgWidth = wallWidthPx + 220
    const dsSvgHeight = totalThickness * scale + 80
    const dsStartY = 30

    let yPos = dsStartY
    const drywallYDs = yPos; yPos += drywallThickness * scale
    const svcCavityYDs = hasServiceWall ? yPos : null
    if (hasServiceWall) yPos += svcDepth * scale
    const intLayerYDs = hasServiceWall ? yPos : null
    if (hasServiceWall) yPos += intLayerThick * scale
    const dsCavityYDs = yPos; yPos += dsCavityDepth * scale
    const sheathingYDs = yPos; yPos += sheathingThickness * scale
    const claddingYDs = yPos

    // Inner/outer stud positions within the unified cavity
    const innerStudYDs = dsCavityYDs
    const outerStudYDs = dsCavityYDs + (innerDepth + gapInches) * scale

    // Detect foam vs sheathing for interior layer rendering
    const isFoamLayer = interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/)

    const dsLayers = [
      { name: '½" drywall', midY: drywallYDs + drywallThickness * scale / 2 },
    ]
    if (hasServiceWall) {
      dsLayers.push({ name: serviceCavityLabel || 'service cavity', midY: svcCavityYDs + svcDepth * scale / 2 })
      if (intLayerThick > 0) {
        dsLayers.push({ name: interiorLayerLabel || 'interior layer', midY: intLayerYDs + intLayerThick * scale / 2 })
      }
    }
    dsLayers.push({ name: cavityInsLabel || 'blown-in insulation', midY: dsCavityYDs + dsCavityDepth * scale / 2 })
    dsLayers.push({ name: sheathingLabel || '7/16" sheathing', midY: sheathingYDs + sheathingThickness * scale / 2 })
    dsLayers.push({ name: claddingLabel || '½" cladding', midY: claddingYDs + claddingThickness * scale / 2 })

    // Render studs only (no cavity background — drawn on top of unified fill)
    const renderStudsOnly = (startY, depth, spacingIn) => {
      const studH = depth * scale
      const numSt = Math.ceil(wallLengthInches / spacingIn) + 1
      return Array.from({ length: numSt }).map((_, i) => {
        const sx = i * spacingIn * scale
        const sw = studWidthInches * scale
        if (sx >= wallWidthPx) return null
        const aw = Math.min(sw, wallWidthPx - sx)
        return (
          <g key={`stud-${startY}-${i}`}>
            <rect x={sx} y={startY} width={aw} height={studH}
              fill={colors.stud} stroke="#333" strokeWidth="1" />
            {aw >= sw - 1 && (
              <>
                <line x1={sx + 1} y1={startY + 1} x2={sx + sw - 1} y2={startY + studH - 1}
                  stroke="#333" strokeWidth="1" />
                <line x1={sx + sw - 1} y1={startY + 1} x2={sx + 1} y2={startY + studH - 1}
                  stroke="#333" strokeWidth="1" />
              </>
            )}
          </g>
        )
      })
    }

    return (
      <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
        <svg width="100%" viewBox={`0 0 ${dsSvgWidth} ${dsSvgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '300px' }}>
          <text x={dsSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">INTERIOR</text>
          <g transform="translate(20, 0)">
            <rect x={0} y={drywallYDs} width={wallWidthPx} height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />
            {hasServiceWall && renderStudCavity(svcCavityYDs, svcDepth, serviceSpacingInches)}
            {hasServiceWall && intLayerThick > 0 && (
              <g>
                <rect x={0} y={intLayerYDs} width={wallWidthPx} height={intLayerThick * scale}
                  fill={isFoamLayer ? '#fce7f3' : colors.sheathing}
                  stroke={isFoamLayer ? '#db2777' : '#6b7280'} strokeWidth="1" />
                {isFoamLayer && generateContInsPattern(0, wallWidthPx, intLayerYDs, intLayerThick * scale)}
              </g>
            )}
            {/* Unified cavity fill — one insulation layer spanning inner studs + gap + outer studs */}
            <rect x={0} y={dsCavityYDs} width={wallWidthPx} height={dsCavityDepth * scale}
              fill={colors.cavity} stroke="#9ca3af" strokeWidth="1" />
            {generateCavityPattern(0, wallWidthPx, dsCavityYDs, dsCavityDepth * scale)}
            {/* Inner studs drawn on top of insulation */}
            {renderStudsOnly(innerStudYDs, innerDepth, studSpacing)}
            {/* Outer studs drawn on top of insulation */}
            {renderStudsOnly(outerStudYDs, outerDepth, studSpacing)}
            <rect x={0} y={sheathingYDs} width={wallWidthPx} height={sheathingThickness * scale} fill={colors.sheathing} stroke="#6b7280" strokeWidth="1" />
            <rect x={0} y={claddingYDs} width={wallWidthPx} height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />
            {renderLabels(dsLayers, wallWidthPx, dsStartY)}
            <g transform={`translate(0, ${claddingYDs + claddingThickness * scale + 15})`}>
              <line x1={0} y1="0" x2={studSpacing * scale} y2="0" stroke="#9ca3af" strokeWidth="1" />
              <line x1={0} y1="-5" x2={0} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <line x1={studSpacing * scale} y1="-5" x2={studSpacing * scale} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <text x={studSpacing * scale / 2} y="15" textAnchor="middle" fontSize="10" fill="#6b7280">{studSpacing}" o.c.</text>
            </g>
          </g>
          <text x={dsSvgWidth / 2} y={claddingYDs + claddingThickness * scale + 45}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">EXTERIOR</text>
        </svg>
      </div>
    )
  }

  // --- Single Wall + Service Wall Rendering ---
  if (assemblyType === 'single' && hasServiceWall) {
    const primaryDepth = studDepthInches
    const svcDepth = toStudDepthInches(serviceStudDepth)
    const intLayerThick = interiorLayerThicknessInches
    const isFoamLayer = interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/)

    const totalThickness = drywallThickness + svcDepth + intLayerThick + primaryDepth + sheathingThickness + claddingThickness
    const swSvgWidth = wallWidthPx + 220
    const swSvgHeight = totalThickness * scale + 80
    const swStartY = 30

    let yPos = swStartY
    const drywallYSw = yPos; yPos += drywallThickness * scale
    const svcCavityYSw = yPos; yPos += svcDepth * scale
    const intLayerYSw = yPos; yPos += intLayerThick * scale
    const primaryCavityYSw = yPos; yPos += primaryDepth * scale
    const sheathingYSw = yPos; yPos += sheathingThickness * scale
    const claddingYSw = yPos

    const swLayers = [
      { name: '½" drywall', midY: drywallYSw + drywallThickness * scale / 2 },
      { name: serviceCavityLabel || 'service cavity', midY: svcCavityYSw + svcDepth * scale / 2 },
    ]
    if (intLayerThick > 0) {
      swLayers.push({ name: interiorLayerLabel || 'interior layer', midY: intLayerYSw + intLayerThick * scale / 2 })
    }
    swLayers.push(
      { name: cavityInsLabel || `${studDepth} stud`, midY: primaryCavityYSw + primaryDepth * scale / 2 },
      { name: sheathingLabel || '7/16" sheathing', midY: sheathingYSw + sheathingThickness * scale / 2 },
      { name: claddingLabel || '½" cladding', midY: claddingYSw + claddingThickness * scale / 2 },
    )

    return (
      <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
        <svg width="100%" viewBox={`0 0 ${swSvgWidth} ${swSvgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '250px' }}>
          <text x={swSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">INTERIOR</text>
          <g transform="translate(20, 0)">
            <rect x={0} y={drywallYSw} width={wallWidthPx} height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />
            {renderStudCavity(svcCavityYSw, svcDepth, serviceSpacingInches)}
            {intLayerThick > 0 && (
              <g>
                <rect x={0} y={intLayerYSw} width={wallWidthPx} height={intLayerThick * scale}
                  fill={isFoamLayer ? '#fce7f3' : colors.sheathing}
                  stroke={isFoamLayer ? '#db2777' : '#6b7280'} strokeWidth="1" />
                {isFoamLayer && generateContInsPattern(0, wallWidthPx, intLayerYSw, intLayerThick * scale)}
              </g>
            )}
            {wallType === 'wood' && renderStudCavity(primaryCavityYSw, primaryDepth, studSpacing)}
            <rect x={0} y={sheathingYSw} width={wallWidthPx} height={sheathingThickness * scale} fill={colors.sheathing} stroke="#6b7280" strokeWidth="1" />
            <rect x={0} y={claddingYSw} width={wallWidthPx} height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />
            {renderLabels(swLayers, wallWidthPx, swStartY)}
            <g transform={`translate(0, ${claddingYSw + claddingThickness * scale + 15})`}>
              <line x1={0} y1="0" x2={studSpacing * scale} y2="0" stroke="#9ca3af" strokeWidth="1" />
              <line x1={0} y1="-5" x2={0} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <line x1={studSpacing * scale} y1="-5" x2={studSpacing * scale} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <text x={studSpacing * scale / 2} y="15" textAnchor="middle" fontSize="10" fill="#6b7280">{studSpacing}" o.c.</text>
            </g>
          </g>
          <text x={swSvgWidth / 2} y={claddingYSw + claddingThickness * scale + 45}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">EXTERIOR</text>
        </svg>
      </div>
    )
  }

  // --- Wood/Steel Framed Wall Rendering ---

  // Calculate total wall thickness
  const totalThickness =
    drywallThickness +
    studDepthInches +
    sheathingThickness +
    continuousIns +
    claddingThickness

  // SVG dimensions
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
              { name: sheathingLabel || '7/16" sheathing', midY: sheathingY + sheathingThickness * scale / 2 },
              ...(continuousIns > 0 ? [{ name: contInsDisplayLabel, midY: contInsY + continuousIns * scale / 2 }] : []),
              { name: claddingLabel || '½" cladding', midY: claddingY + claddingThickness * scale / 2 },
            ]

            return renderLabels(layers, wallWidthPx, startY)
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
