import { useEffect, useState } from 'react'

// Below 900 px the Cost tab uses the phone layout (spec rev 3 3.4). Without matchMedia (tests), wide.
const QUERY = '(max-width: 899px)'
const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? Boolean(window.matchMedia(QUERY)?.matches) : false)

export default function useNarrow() {
  const [narrow, setNarrow] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(QUERY)
    if (!mq) return undefined
    const on = () => setNarrow(Boolean(mq.matches))
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener?.(on)
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener?.(on) }
  }, [])
  return narrow
}
