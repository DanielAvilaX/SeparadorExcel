import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Muestra `content` en una burbuja flotante al dejar el mouse encima > delay ms.
// La burbuja es interactiva: puedes llevar el mouse encima y hacer scroll.
export default function HoverPreview({ children, content, delay = 1000, width = 340, block = false }) {
  const ref = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current) }, [])

  function computeAndOpen() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const margin = 12
    let left = r.right + margin              // preferido: a la derecha
    let top = r.top
    if (left + width > window.innerWidth - 8) left = r.left - margin - width // si no cabe, a la izquierda
    if (left < 8) {                           // si tampoco, debajo
      left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      top = r.bottom + margin
    }
    top = Math.max(8, Math.min(top, window.innerHeight - 320))
    setPos({ left, top })
  }

  function scheduleClose(ms) {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPos(null), ms)
  }

  function triggerEnter() {
    clearTimeout(closeTimer.current)
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(computeAndOpen, delay)
  }
  function triggerLeave() {
    clearTimeout(openTimer.current)
    scheduleClose(300) // margen para alcanzar la burbuja
  }

  return (
    <span
      ref={ref}
      className={'hp-trigger' + (block ? ' block' : '')}
      onMouseEnter={triggerEnter}
      onMouseLeave={triggerLeave}
    >
      {children}
      {pos && createPortal(
        <div
          className="hp-pop"
          style={{ left: pos.left, top: pos.top, width }}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={() => scheduleClose(150)}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  )
}
