// src/optimize/wallTypes.js
// Curated wall assemblies per construction type (Capability 2 spec section 3). Data only; BEA curates the lists.
// Each assembly is a complete wall-builder selection, so it prices through wallLayers and scores through
// calculateWallRsi unchanged. `points` is the step the assembly is curated for with the default exterior
// (OSB, vinyl); wallTypes.test.js asserts it.
import { getBoundaryOptions, calculateWallRsi, getWallPoints } from '../data/ecpData'
import { describeWall } from '../costing/assumedAssemblies'
import { inches } from '../costing/wallLayers'

const b = getBoundaryOptions()
const DEFAULT_EXTERIOR = { sheathingId: b.sheathing.defaults.wood, claddingId: b.cladding.defaults.wood }

const single = (cavityType, contInsType, contInsThickness = 'None') => ({
  wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType,
  contInsType: contInsThickness === 'None' ? undefined : contInsType, contInsThickness, ...DEFAULT_EXTERIOR,
})
// calculateWallRsi's service-wall path ignores continuous insulation, and spec 3 forbids foam here anyway.
const serviceCavity = (cavityType, serviceCavityType) => ({
  ...single(cavityType), hasServiceWall: true, serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt', serviceCavityType,
})
const doubleStud = (plate, doubleStudMaterial) => ({
  wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"', outerStud: '2x4', innerStud: '2x4', plate, doubleStudMaterial,
  contInsThickness: 'None', ...DEFAULT_EXTERIOR,
})
const asm = (id, points, selection) => ({ id, points, selection })

export const STANDARD_TYPE_ID = 'standard'
export const OWN_WALL_ID = 'own'

export const WALL_TYPES = [
  {
    id: 'standard', label: '2x4 or 2x6 studs, no foam or thin exterior foam (under 1.5 in)', locked: true,
    assemblies: [
      asm('2x6_r22', 0, single('2x6 R22')),                       // RSI 3.00, the code minimum wall
      asm('2x6_r24', 1.6, single('2x6 R24')),                     // 3.11
      asm('2x6_r24_xps1', 7.7, single('2x6 R24', 'XPS', '1"')),   // 3.99, the Typical Tier 2 wall
      asm('2x6_r24_pic1', 7.7, single('2x6 R24', 'Polyiso', '1"')), // 4.08
    ],
  },
  {
    id: 'thickFoam', label: '2x6 with thick exterior foam (2 in and up)',
    assemblies: [
      asm('2x6_r24_xps2', 11.1, single('2x6 R24', 'XPS', '2"')),        // 4.79
      asm('2x6_r24_pic2', 11.6, single('2x6 R24', 'Polyiso', '2"')),    // 4.91
      asm('2x6_r24_xps2_5', 12.2, single('2x6 R24', 'XPS', '2-1/2"')),  // 5.25
      asm('2x6_r24_xps3', 13.6, single('2x6 R24', 'XPS', '3"')),        // 5.67
    ],
  },
  {
    id: 'largeStuds', label: 'Larger studs (2x8 and up)',
    assemblies: [
      asm('2x8_r28', 6.2, single('2x8 R28')),                      // 3.75
      asm('2x8_r28_xps1', 10.6, single('2x8 R28', 'XPS', '1"')),   // 4.63
      asm('2x10_r31', 9.2, single('2x10 R31')),                    // 4.35
      asm('2x12_r40', 12.2, single('2x12 R40')),                   // 5.35
    ],
  },
  {
    id: 'serviceCavity', label: '2x6 with an interior service cavity',
    assemblies: [
      asm('2x6_r24_svc_2x4_r14', 11.1, serviceCavity('2x6 R24', '2x4 R14')),  // 4.73
    ],
  },
  {
    id: 'doubleStud', label: 'Double stud wall',
    assemblies: [
      asm('ds_2x4_2x4_2x10_dense', 11.1, doubleStud('2x10', 'Dense Pack Cellulose')),  // 4.83
      asm('ds_2x4_2x4_2x12_dense', 13.6, doubleStud('2x12', 'Dense Pack Cellulose')),  // 6.05
    ],
  },
]

export const wallTypeOf = id => WALL_TYPES.find(t => t.id === id) ?? null

const candidate = (id, typeId, selection, own) => ({
  id, typeId, selection, own, label: describeWall(selection), points: getWallPoints(calculateWallRsi(selection)),
})

// The construction type of a complete wall-builder selection, by the same rules the curated lists are sorted by.
function classifyWall(ws) {
  if (ws.assemblyType === 'doubleStud') return 'doubleStud'
  if (ws.hasServiceWall) return 'serviceCavity'
  if (ws.contInsType && inches(ws.contInsThickness) >= 2) return 'thickFoam'
  const stud = (ws.cavityType || '').split(' ')[0]
  if (stud === '2x8' || stud === '2x10' || stud === '2x12') return 'largeStuds'
  return STANDARD_TYPE_ID
}

// The builder's own Points-tab wall, if it is a complete assembly with an RSI. A Select RSI pick is not one
// (builders do not speak RSI; the standard type's 2x6 R22 covers the code minimum). It is classed by its real
// construction type so runners-up can offer another type's wall; `own` marks it, and OWN_WALL_ID is its id.
export function ownWallCandidate(wallSelection) {
  const ws = wallSelection || {}
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) return null
  if (!ws.wallType) return null
  const rsi = calculateWallRsi(ws)
  if (rsi === null || rsi === undefined) return null
  return candidate(OWN_WALL_ID, classifyWall(ws), ws, true)
}

// The fields that make two selections the same wall for the search.
const SAME_FIELDS = ['wallType', 'assemblyType', 'studSpacing', 'cavityMaterial', 'cavityType', 'contInsType', 'contInsThickness', 'hasServiceWall',
  'serviceSpacing', 'serviceCavityMaterial', 'serviceCavityType', 'outerStud', 'innerStud', 'plate', 'doubleStudMaterial', 'sheathingId', 'claddingId',
  'interiorLayerMaterial', 'interiorLayerThickness']  // not in the review's list: a curated wall has no interior layer, so an own service wall with one is a different wall
const norm = (field, v) => {
  if (field === 'contInsType') return v === 'None' || v === undefined || v === null ? undefined : v
  if (field === 'contInsThickness') return v === undefined || v === null ? 'None' : v
  if (field === 'hasServiceWall') return !!v
  if (field === 'interiorLayerMaterial' || field === 'interiorLayerThickness') return v || undefined
  if (field === 'sheathingId') return v || DEFAULT_EXTERIOR.sheathingId
  if (field === 'claddingId') return v || DEFAULT_EXTERIOR.claddingId
  return v === null ? undefined : v
}
const sameWall = (a, b) => SAME_FIELDS.every(f => norm(f, a[f]) === norm(f, b[f]))

// Candidates for the ticked types (the standard type always), with the builder's own sheathing and cladding
// when their wall has them, plus the own wall itself last. A curated assembly equal to the own wall is dropped.
export function wallCandidates(tickedTypeIds, wallSelection) {
  const own = ownWallCandidate(wallSelection)
  const exterior = own
    ? { sheathingId: own.selection.sheathingId || DEFAULT_EXTERIOR.sheathingId, claddingId: own.selection.claddingId || DEFAULT_EXTERIOR.claddingId }
    : DEFAULT_EXTERIOR
  const out = []
  for (const t of WALL_TYPES) {
    if (t.id !== STANDARD_TYPE_ID && !tickedTypeIds.has(t.id)) continue
    for (const a of t.assemblies) {
      const selection = { ...a.selection, ...exterior }
      // The builder's own wall stands in for a curated twin: one candidate per distinct wall.
      if (own && sameWall(selection, own.selection)) continue
      out.push(candidate(a.id, t.id, selection, false))
    }
  }
  if (own) out.push(own)
  return out
}
