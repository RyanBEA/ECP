import React, { useLayoutEffect, useId, useRef } from 'react'
import { CloseIcon } from './icons'

// A modal on the browser's own <dialog> (iteration 3): showModal gives the backdrop, the focus trap and the
// top layer. jsdom has no showModal, so there the dialog is opened with the open attribute. Esc, the Close
// button and a click outside the content all call onClose. The <dialog> has no padding: its content fills
// .dialog-body, so a click whose target is the <dialog> itself landed on the backdrop.
export default function Dialog({ title, sub, onClose, className = '', children }) {
  const ref = useRef(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // A layout effect: it runs before the children's effects, so a child (the editor scrolling to a card) finds the
  // dialog already open.
  useLayoutEffect(() => {
    const d = ref.current
    if (!d) return undefined
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal() } else d.setAttribute('open', '')
    // The browser's own Esc handling fires "cancel"; keep the element mounted and let onClose decide.
    const onCancel = e => { e.preventDefault(); closeRef.current() }
    d.addEventListener('cancel', onCancel)
    return () => {
      d.removeEventListener('cancel', onCancel)
      if (typeof d.close === 'function' && d.open) d.close()
    }
  }, [])
  const onKeyDown = e => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
  const onClick = e => { if (e.target === ref.current) onClose() }
  return (
    <dialog ref={ref} className={`dialog ${className}`.trim()} aria-labelledby={titleId} onKeyDown={onKeyDown} onClick={onClick}>
      <div className="dialog-body">
        <div className="dialog-head">
          <div>
            <h2 id={titleId} className="dialog-title">{title}</h2>
            {sub && <p className="dialog-sub">{sub}</p>}
          </div>
          <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
