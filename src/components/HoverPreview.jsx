import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Muestra `content` en una burbuja flotante al dejar el mouse encima > delay ms.
// La burbuja es interactiva (se puede llevar el mouse encima y hacer scroll) y
// se reubica para caber completa en la pantalla.
export default function HoverPreview({ children, content, delay = 1000, width = 340, block = false }) {
  const ref = useRef(null)
  const popRef = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current) }, [])

  function computeAndOpen() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const margin = 12
    let left = r.right + margin              // preferido: a la derecha
    if (left + width > window.innerWidth - 8) left = r.left - margin - width // si no cabe, a la izquierda
    if (left < 8) left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8) // si tampoco, alineado abajo
    // El alto real se ajusta después de renderizar (useLayoutEffect)
    setPos({ left, top: r.top })
  }

  // Sube/ajusta la burbuja para que no se salga de la pantalla
  useLayoutEffect(() => {
    if (!pos || !popRef.current) return
    const h = popRef.current.offsetHeight
    const maxTop = window.innerHeight - h - 8
    const clamped = Math.max(8, Math.min(pos.top, maxTop))
    if (Math.abs(clamped - pos.top) > 1) setPos((p) => ({ ...p, top: clamped }))
  }, [pos])

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
          ref={popRef}
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
