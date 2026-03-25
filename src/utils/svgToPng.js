/**
 * Convert an SVG DOM element to a base64 PNG string.
 *
 * Uses native browser APIs: XMLSerializer, Canvas, Image.
 * Returns a Promise that resolves to a base64 string (without data URL prefix).
 */
export function svgToPng(svgElement, scale = 2) {
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgElement)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)

        // Extract base64 without the data URL prefix
        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        resolve(base64)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG as image'))
      }
      img.src = url
    } catch (err) {
      reject(err)
    }
  })
}
