// Shared wording for the Cost tab (spec rev 3 section 8).
import { ftToM } from './units'

// 'Single detached' -> 'single detached house'; names already ending in home or house stay as they are (R40).
export const houseNoun = typeName => {
  const n = String(typeName || 'house').toLowerCase()
  return /(home|house)$/.test(n) ? n : `${n} house`
}
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const m1 = ft => ftToM(Number(ft) || 0).toFixed(1)
export const shapeSentence = ({ typeName, houseFields }) =>
  `Based on a ${houseNoun(typeName)}, ${houseFields.lengthFt} x ${houseFields.widthFt} ft (${m1(houseFields.lengthFt)} x ${m1(houseFields.widthFt)} m); other shapes will differ.`
