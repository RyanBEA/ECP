// House fields -> quantities (spec 4.3). Inputs in feet, outputs in metric, sentences in imperial.
import { ftToM, m2ToSqFt } from './units'

export const DOOR_AREA_M2 = 1.9   // placeholder per exterior door
export const MORE_THAN_5 = 'moreThan5'

// NBC 2020 Table 9.32.3.3, normal operating exhaust capacity of the principal ventilation fan, L/s
export const AIRFLOW_BY_BEDROOMS = {
  1: { min: 16, max: 24 }, 2: { min: 18, max: 28 }, 3: { min: 22, max: 32 }, 4: { min: 26, max: 38 }, 5: { min: 30, max: 45 },
}

export function computeQuantities(f) {
  const lengthM = ftToM(f.lengthFt)
  const widthM = ftToM(f.widthFt)
  const storeyHeightM = ftToM(f.storeyHeightFt)
  const foundationM = ftToM(f.foundationHeightFt || 0)
  const perimeterM = 2 * (lengthM + widthM)
  const exposedLengthM = perimeterM - (f.partyWalls || 0) * lengthM
  const exteriorGrossM2 = exposedLengthM * f.storeys * storeyHeightM
  const openingsM2 = exteriorGrossM2 * f.glazingRatio
  const doorAreaM2 = (f.doors || 0) * DOOR_AREA_M2
  const windowAreaM2 = Math.max(0, openingsM2 - doorAreaM2)
  const opaqueWallM2 = exteriorGrossM2 - openingsM2
  const belowGradeApplicable = foundationM > 0
  const belowGradeM2 = belowGradeApplicable ? exposedLengthM * foundationM : 0
  let airflow = null
  if (f.bedrooms === MORE_THAN_5) {
    if (f.designedAirflowLs > 0) airflow = { min: f.designedAirflowLs, max: f.designedAirflowLs }
  } else if (AIRFLOW_BY_BEDROOMS[f.bedrooms]) {
    airflow = { ...AIRFLOW_BY_BEDROOMS[f.bedrooms] }
  }
  return {
    perimeterM, exposedLengthM, exteriorGrossM2, openingsM2, doorAreaM2, windowAreaM2, opaqueWallM2,
    belowGradeM2, belowGradeApplicable, airflow,
    doors: f.doors || 0, waterHeaterGal: f.waterHeaterGal, bedrooms: f.bedrooms,
  }
}

const sqft = m2 => Math.round(m2ToSqFt(m2)).toLocaleString('en-CA')
const ft = m => Math.round(m * 3.280839895)

export function quantitySentences(q, f) {
  const pct = Math.round(f.glazingRatio * 100)
  const party = f.partyWalls ? ` (${f.partyWalls} party wall${f.partyWalls > 1 ? 's' : ''} excluded)` : ''
  return {
    opaqueWall: `${f.storeys} storeys x ${f.storeyHeightFt} ft x ${ft(q.exposedLengthM)} ft exposed perimeter${party}, less ${pct}% openings = ${sqft(q.opaqueWallM2)} sq ft opaque wall, from your house fields.`,
    windows: `${pct}% of ${sqft(q.exteriorGrossM2)} sq ft exterior wall is openings, less ${q.doors} door${q.doors === 1 ? '' : 's'} = ${sqft(q.windowAreaM2)} sq ft of windows.`,
    belowGrade: q.belowGradeApplicable
      ? `${ft(q.exposedLengthM)} ft exposed perimeter x ${f.foundationHeightFt} ft foundation wall = ${sqft(q.belowGradeM2)} sq ft, priced wholly as foundation wall (above-grade exposure not separated).`
      : 'No foundation wall; below-grade walls do not apply.',
    airflow: q.airflow
      ? `${f.bedrooms === MORE_THAN_5 ? 'Designed airflow' : `${f.bedrooms} bedrooms`}: ${q.airflow.min}-${q.airflow.max} L/s (NBC Table 9.32.3.3).`
      : 'More than 5 bedrooms: enter the designed airflow to price the HRV.',
  }
}
