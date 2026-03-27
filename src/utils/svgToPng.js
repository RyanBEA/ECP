/**
 * Convert an SVG DOM element to a base64 PNG string.
 *
 * Uses native browser APIs: XMLSerializer, Canvas, Image.
 * Returns a Promise that resolves to { base64, width, height } where base64 is
 * the PNG data (without data URL prefix) and width/height are the natural
 * pixel dimensions of the rendered image.
 *
 * Handles SVGs that use viewBox without explicit width/height by reading
 * the viewBox dimensions and setting them on the serialized SVG.
 */
export function svgToPng(svgElement, scale = 2) {
  return new Promise((resolve, reject) => {
    try {
      // Clone the SVG so we can modify it without affecting the DOM
      const clone = svgElement.cloneNode(true)

      // Ensure explicit width/height from viewBox if not set
      const viewBox = clone.getAttribute('viewBox')
      if (viewBox && (!clone.getAttribute('width') || !clone.getAttribute('height'))) {
        const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number)
        if (vbW && vbH) {
          clone.setAttribute('width', vbW)
          clone.setAttribute('height', vbH)
        }
      }

      // Fall back to bounding rect if still no dimensions
      if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
        const rect = svgElement.getBoundingClientRect()
        clone.setAttribute('width', rect.width)
        clone.setAttribute('height', rect.height)
      }

      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(clone)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth * scale
        canvas.height = img.naturalHeight * scale
        const ctx = canvas.getContext('2d')
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)

        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        resolve({ base64, width: img.naturalWidth, height: img.naturalHeight })
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
