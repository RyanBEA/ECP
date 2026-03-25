/**
 * Export the current wall assembly as an Excel workbook.
 *
 * Orchestrates: resolveWallData → buildWallSheet → svgToPng → download.
 * ExcelJS is dynamically imported to avoid bundling it upfront.
 */

import { resolveWallData } from './resolveWallData'
import { buildWallSheet } from './buildWallSheet'
import { svgToPng } from './svgToPng'

/**
 * Generate and download an Excel workbook for the current wall assembly.
 *
 * @param {object} selection - The wall builder selection object from App.jsx state
 * @param {SVGElement|null} svgElement - The wall section SVG DOM element (optional)
 */
export async function exportWallAssembly(selection, svgElement) {
  // Dynamically import ExcelJS (keeps it out of the main bundle)
  const ExcelJS = (await import('exceljs')).default

  // Resolve all intermediate calculation values
  const data = resolveWallData(selection)
  if (!data || data.totalRsi === null) {
    throw new Error('Cannot export: incomplete wall configuration')
  }

  // Build the workbook and sheet
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ECP Calculator'
  workbook.created = new Date()

  const sheet = buildWallSheet(workbook, data)

  // Embed wall section image (graceful degradation: skip on failure)
  if (svgElement) {
    try {
      const pngBase64 = await svgToPng(svgElement)
      const imageId = workbook.addImage({
        base64: pngBase64,
        extension: 'png',
      })

      // Find the last used row to place image below
      const lastRow = sheet.lastRow?.number || 30
      const imageRow = lastRow + 2

      sheet.addImage(imageId, {
        tl: { col: 0, row: imageRow },
        ext: { width: 500, height: 300 },
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
  const filename = `Wall-Assembly-RSI-${data.wallTypeLabel.replace(/\s+/g, '-')}-${date}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
