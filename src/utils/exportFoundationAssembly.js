/**
 * Export the current below-grade (foundation) wall assembly as an Excel workbook.
 *
 * Orchestrates: resolveFoundationData → buildFoundationSheet → svgToPng → download.
 * Same contract as exportWallAssembly: ExcelJS is dynamically imported to avoid bundling
 * it upfront, and the cross-section PNG is embedded when an SVG element is given.
 */

import { resolveFoundationData } from './resolveFoundationData'
import { buildFoundationSheet } from './buildFoundationSheet'
import { svgToPng } from './svgToPng'

/**
 * Generate and download an Excel workbook for the current foundation wall assembly.
 *
 * @param {object} selection - The below-grade builder selection object from App.jsx state
 * @param {SVGElement|null} svgElement - The foundation section SVG DOM element (optional)
 */
export async function exportFoundationAssembly(selection, svgElement) {
  // Dynamically import ExcelJS (keeps it out of the main bundle)
  const ExcelJS = (await import('exceljs')).default

  // Resolve all intermediate calculation values
  const data = resolveFoundationData(selection)
  if (!data || data.totalRsi === null) {
    throw new Error('Cannot export: incomplete foundation wall configuration')
  }

  // Build the workbook and sheet
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ECP Calculator'
  workbook.created = new Date()

  const sheet = buildFoundationSheet(workbook, data)

  // Embed foundation section image (graceful degradation: skip on failure)
  if (svgElement) {
    try {
      const { base64: pngBase64, width: imgW, height: imgH } = await svgToPng(svgElement)
      const imageId = workbook.addImage({
        base64: pngBase64,
        extension: 'png',
      })

      // Find the last used row to place image below
      const lastRow = sheet.lastRow?.number || 30
      const imageRow = lastRow + 2

      // Scale to fit ~500px wide while preserving aspect ratio
      const maxWidth = 500
      const scale = imgW > maxWidth ? maxWidth / imgW : 1
      sheet.addImage(imageId, {
        tl: { col: 0, row: imageRow },
        ext: { width: imgW * scale, height: imgH * scale },
      })
    } catch (err) {
      console.warn('SVG-to-PNG conversion failed, exporting without image:', err.message)
    }
  }

  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const date = new Date().toISOString().slice(0, 10)
  const filename = `Foundation-Wall-RSI-${data.foundationTypeLabel.replace(/\s+/g, '-')}-${date}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
