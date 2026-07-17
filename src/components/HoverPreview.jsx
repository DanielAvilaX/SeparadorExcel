import { useEffect, useRef, useState } from 'react'

// Muestra `content` en una burbuja flotante al dejar el mouse encima > delay ms.
export default function HoverPreview({ children, content, delay = 1000, width = 340, block = false }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function enter() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const margin = 12
      let left = r.right + margin        // preferido: a la derecha
      let top = r.top
      if (left + width > window.innerWidth - 8) left = r.left - margin - width // si no cabe, a la izquierda
      if (left < 8) {                    // si tampoco, debajo
        left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
        top = r.bottom + margin
      }
      top = Math.max(8, Math.min(top, window.innerHeight - 300))
      setPos({ left, top })
    }, delay)
  }

  function leave() { clearTimeout(timer.current); setPos(null) }

  return (
    <span
      ref={ref}
      className={'hp-trigger' + (block ? ' block' : '')}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      {children}
      {pos && (
        <div className="hp-pop" style={{ left: pos.left, top: pos.top, width }}>
          {content}
        </div>
      )}
    </span>
  )
}
