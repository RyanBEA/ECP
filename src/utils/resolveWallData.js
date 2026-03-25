/**
 * Resolve all intermediate calculation values from a wall builder selection.
 *
 * Mirrors the logic in ecpData.js calculateWallRsi() but returns a structured
 * object exposing every intermediate value for Excel export.
 */

import wallData from '../data/generated/wall-data.json'
import continuousInsData from '../data/generated/continuous-ins.json'
import icfData from '../data/generated/icf-data.json'
import boundaryOptions from '../data/generated/boundary-options.json'
import doubleStudData from '../data/generated/double-stud-data.json'
import { parallelPath, boundarySum, steelKValues, steelCavityPct } from '@scripts/compute.js'
import { getContinuousInsRsi, getInteriorLayerRsi, getWallPoints } from '../data/ecpData'

const WALL_TYPE_LABELS = { wood: 'Wood Frame', steel: 'Steel Frame', icf: 'ICF' }

/**
 * Resolve boundary layers with RSI values and human-readable labels.
 */
function resolveBoundary(wallType, sheathingId, claddingId) {
  const outsideAir = { rsi: boundaryOptions.air_films.outside, label: 'Outside Air Film' }
  const insideAir = { rsi: boundaryOptions.air_films.inside, label: 'Inside Air Film' }
  const drywall = { rsi: boundaryOptions.drywall.default, label: '1/2" Gypsum' }

  // Cladding
  const clId = claddingId || boundaryOptions.cladding.defaults[wallType]
  const clOption = boundaryOptions.cladding.options.find(o => o.id === clId)
  const cladding = clOption
    ? { rsi: clOption.rsi, label: clOption.label, id: clId }
    : { rsi: 0, label: 'None', id: null }

  // Sheathing (wood only)
  let sheathing = null
  if (boundaryOptions.sheathing.applies_to.includes(wallType)) {
    const shId = sheathingId || boundaryOptions.sheathing.default
    const shOption = boundaryOptions.sheathing.options.find(o => o.id === shId)
    sheathing = shOption
      ? { rsi: shOption.rsi, label: shOption.label, id: shId }
      : { rsi: 0, label: 'None', id: null }
  }

  // Air space (steel only)
  let airSpace = null
  if (wallType === 'steel') {
    airSpace = { rsi: boundaryOptions.steel_air_space.rsi, label: 'Air Space' }
  }

  return { outsideAir, cladding, sheathing, airSpace, drywall, insideAir }
}

/**
 * Build the boundary object expected by compute.js functions.
 */
function toBoundaryObj(resolved) {
  return {
    outside_air: resolved.outsideAir.rsi,
    cladding: resolved.cladding.rsi,
    sheathing: resolved.sheathing?.rsi || 0,
    air_space: resolved.airSpace?.rsi || 0,
    drywall: resolved.drywall.rsi,
    inside_air: resolved.insideAir.rsi,
  }
}

export function resolveWallData(selection) {
  const {
    wallType, assemblyType = 'single', studSpacing,
    cavityMaterial, cavityType,
    contInsType, contInsThickness,
    icfFormThickness,
    sheathingId, claddingId,
    outerStud, innerStud, plate, doubleStudMaterial,
    hasServiceWall = false,
    serviceSpacing, serviceCavityMaterial, serviceCavityType,
    interiorLayerMaterial, interiorLayerThickness,
  } = selection || {}

  if (!wallType) return null

  const boundary = resolveBoundary(wallType, sheathingId, claddingId)
  const boundaryObj = toBoundaryObj(boundary)
  const contInsRsi = getContinuousInsRsi(contInsType, contInsThickness)
  const contIns = contInsRsi > 0
    ? { type: contInsType, thickness: contInsThickness, rsi: contInsRsi }
    : null

  const base = {
    wallType,
    wallTypeLabel: WALL_TYPE_LABELS[wallType] || wallType,
    assemblyType: wallType === 'wood' ? assemblyType : null,
    studSpacing: wallType !== 'icf' ? studSpacing : null,
    boundary,
    contIns,
    mainWall: null,
    doubleStud: null,
    steel: null,
    icf: null,
    serviceWall: null,
    interiorLayer: null,
    totalRsi: null,
    points: 0,
  }

  const spacing = studSpacing?.replace('"', '') || ''

  // --- ICF path ---
  if (wallType === 'icf') {
    const form = icfData.forms.find(f => f.label === icfFormThickness)
    if (!form) return base

    const formRsi = form.thickness_mm * 2 * icfData.eps_rsi_per_mm
    const concreteRsi = icfData.concrete_core_mm * icfData.concrete_rsi_per_mm

    base.icf = {
      formThicknessMm: form.thickness_mm,
      formLabel: icfFormThickness,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      formRsi,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
      concreteRsi,
    }

    base.totalRsi = boundaryObj.outside_air + boundaryObj.cladding
      + formRsi + concreteRsi
      + boundaryObj.drywall + boundaryObj.inside_air
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Wood / Steel common: resolve main wall entry ---
  const wt = wallData[wallType]
  if (!wt?.spacings?.[spacing]) return base
  const sp = wt.spacings[spacing]

  // --- Service wall path (wood only) ---
  if (hasServiceWall && wallType === 'wood') {
    // Primary wall
    let primaryPP, mainWallData, resolvedDoubleStud
    if (assemblyType === 'doubleStud') {
      const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
      const dsEntry = doubleStudData[spacing]?.[key]
      if (!dsEntry) return base

      primaryPP = dsEntry.totalPpRsi
      const outerDepthMm = wt.studs[dsEntry.outerStud]?.depth_mm || 89
      const innerDepthMm = wt.studs[dsEntry.innerStud]?.depth_mm || 89
      const plateDepthMm = wt.studs[dsEntry.plate]?.depth_mm || 235

      resolvedDoubleStud = {
        outerStud: dsEntry.outerStud, outerDepthMm,
        outerStudRsi: outerDepthMm * 0.0085,
        outerCavityRsi: outerDepthMm * dsEntry.rsiPerMm,
        outerPpRsi: dsEntry.outerPpRsi,
        innerStud: dsEntry.innerStud, innerDepthMm,
        innerStudRsi: innerDepthMm * 0.0085,
        innerCavityRsi: innerDepthMm * dsEntry.rsiPerMm,
        innerPpRsi: dsEntry.innerPpRsi,
        plate: dsEntry.plate, plateDepthMm,
        gapMm: dsEntry.gapMm, gapRsi: dsEntry.gapRsi,
        material: dsEntry.material, rsiPerMm: dsEntry.rsiPerMm,
        cavityPct: sp.cavity_pct,
      }
      // For double stud, mainWall holds the summary
      mainWallData = {
        studDepthMm: outerDepthMm, studRsi: outerDepthMm * 0.0085,
        cavityPct: sp.cavity_pct, cavityRsi: outerDepthMm * dsEntry.rsiPerMm,
        cavityMaterial: dsEntry.material, cavityType: null,
        ppRsi: dsEntry.outerPpRsi,
      }
    } else {
      const entry = sp.materials[cavityMaterial]?.[cavityType]
      if (!entry) return base
      const studRsi = wt.studs[entry.stud].depth_mm * 0.0085
      primaryPP = parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct)
      mainWallData = {
        studDepthMm: wt.studs[entry.stud].depth_mm,
        studRsi,
        cavityPct: sp.cavity_pct,
        cavityRsi: entry.cavityRsi,
        cavityMaterial,
        cavityType,
        ppRsi: primaryPP,
      }
    }

    // Service wall
    const svcSpacing = serviceSpacing?.replace('"', '') || ''
    if (!wt.spacings?.[svcSpacing]) return base
    const svcSp = wt.spacings[svcSpacing]
    const svcEntry = svcSp.materials[serviceCavityMaterial]?.[serviceCavityType]
    if (!svcEntry) return base
    const svcStudRsi = wt.studs[svcEntry.stud].depth_mm * 0.0085
    const servicePP = parallelPath(svcStudRsi, svcEntry.cavityRsi, svcSp.cavity_pct)

    // Interior layer
    const intLayerRsi = getInteriorLayerRsi(interiorLayerMaterial, interiorLayerThickness)
    let intLayerLabel = null
    if (interiorLayerMaterial) {
      const shOpt = boundaryOptions.sheathing.options.find(o => o.id === interiorLayerMaterial)
      intLayerLabel = shOpt ? shOpt.label : `${interiorLayerThickness || ''} ${interiorLayerMaterial}`.trim()
    }

    base.mainWall = mainWallData
    base.doubleStud = resolvedDoubleStud || null
    base.serviceWall = {
      studSpacing: serviceSpacing,
      studDepthMm: wt.studs[svcEntry.stud].depth_mm,
      studRsi: svcStudRsi,
      cavityPct: svcSp.cavity_pct,
      cavityRsi: svcEntry.cavityRsi,
      cavityMaterial: serviceCavityMaterial,
      cavityType: serviceCavityType,
      ppRsi: servicePP,
    }
    base.interiorLayer = interiorLayerMaterial
      ? { material: intLayerLabel, rsi: intLayerRsi }
      : null
    base.contIns = null  // no cont ins with service wall

    base.totalRsi = boundarySum(boundaryObj) + primaryPP + intLayerRsi + servicePP
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Single stud path (wood or steel) ---
  if (assemblyType === 'single' || wallType === 'steel') {
    const entry = sp.materials[cavityMaterial]?.[cavityType]
    if (!entry) return base

    const studDepthMm = wt.studs[entry.stud].depth_mm
    const studRsi = wallType === 'wood'
      ? studDepthMm * 0.0085
      : studDepthMm * 0.0000161

    base.mainWall = {
      studDepthMm,
      studRsi,
      cavityPct: sp.cavity_pct,
      cavityRsi: entry.cavityRsi,
      cavityMaterial,
      cavityType,
      ppRsi: parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct),
    }

    if (wallType === 'steel') {
      const spacingInches = parseInt(spacing)
      const hasInsSheathing = contInsRsi > 0
      const { k1, k2 } = steelKValues(spacingInches, hasInsSheathing)

      // Use steelCavityPct() for consistency with compute.js (not the JSON value)
      base.mainWall.cavityPct = steelCavityPct(spacingInches)

      // Boundary sum for steel (no sheathing)
      const bSum = boundaryObj.outside_air + boundaryObj.cladding
        + (boundaryObj.air_space || 0) + contInsRsi
        + boundaryObj.drywall + boundaryObj.inside_air

      const cavityPct = base.mainWall.cavityPct
      const framingPct = 100 - cavityPct
      const tStud = bSum + studRsi
      const tCavity = bSum + entry.cavityRsi
      const rsiT1 = 100 / (framingPct / tStud + cavityPct / tCavity)
      const rsiT2 = parallelPath(studRsi, entry.cavityRsi, cavityPct)
      const rsiT3 = bSum + rsiT2

      base.steel = { k1, k2, boundarySum: bSum, rsiT1, rsiT2, rsiT3 }
      base.totalRsi = k1 * rsiT1 + k2 * rsiT3
    } else {
      base.totalRsi = boundarySum(boundaryObj, { contInsRsi }) + base.mainWall.ppRsi
    }

    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Double stud path (wood only, no service wall) ---
  if (assemblyType === 'doubleStud') {
    const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
    const dsEntry = doubleStudData[spacing]?.[key]
    if (!dsEntry) return base

    const outerDepthMm = wt.studs[dsEntry.outerStud]?.depth_mm || 89
    const innerDepthMm = wt.studs[dsEntry.innerStud]?.depth_mm || 89
    const plateDepthMm = wt.studs[dsEntry.plate]?.depth_mm || 235

    base.mainWall = {
      studDepthMm: outerDepthMm,
      studRsi: outerDepthMm * 0.0085,
      cavityPct: sp.cavity_pct,
      cavityRsi: outerDepthMm * dsEntry.rsiPerMm,
      cavityMaterial: dsEntry.material,
      cavityType: null,
      ppRsi: dsEntry.outerPpRsi,
    }

    base.doubleStud = {
      outerStud: dsEntry.outerStud, outerDepthMm,
      outerStudRsi: outerDepthMm * 0.0085,
      outerCavityRsi: outerDepthMm * dsEntry.rsiPerMm,
      outerPpRsi: dsEntry.outerPpRsi,
      innerStud: dsEntry.innerStud, innerDepthMm,
      innerStudRsi: innerDepthMm * 0.0085,
      innerCavityRsi: innerDepthMm * dsEntry.rsiPerMm,
      innerPpRsi: dsEntry.innerPpRsi,
      plate: dsEntry.plate, plateDepthMm,
      gapMm: dsEntry.gapMm, gapRsi: dsEntry.gapRsi,
      material: dsEntry.material, rsiPerMm: dsEntry.rsiPerMm,
      cavityPct: sp.cavity_pct,
    }

    base.totalRsi = boundarySum(boundaryObj, { contInsRsi })
      + dsEntry.outerPpRsi + dsEntry.gapRsi + dsEntry.innerPpRsi
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  return base
}
