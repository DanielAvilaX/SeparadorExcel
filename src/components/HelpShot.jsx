import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import SHOTS from '../help/shots.json'

const IMAGES = import.meta.glob('../assets/help/*.jpg', { eager: true, import: 'default' })
const imageFor = (id) => IMAGES[`../assets/help/${id}.jpg`]

// Recuadros, números y flechas en un SVG del mismo tamaño que la captura: escalan junto con la
// imagen y siguen nítidos a cualquier tamaño.
function Overlay({ meta }) {
  const id = `ah${useId().replace(/:/g, '')}`
  return (
    <svg className="hs-overlay" viewBox={`0 0 ${meta.w} ${meta.h}`} aria-hidden="true">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#E11D2E" />
        </marker>
      </defs>
      {meta.marks.map((m) => (
        <g key={`r${m.n}`}>
          <rect x={m.x} y={m.y} width={m.w} height={m.h} rx="7" fill="none" stroke="#fff" strokeWidth="6" opacity="0.85" />
          <rect x={m.x} y={m.y} width={m.w} height={m.h} rx="7" fill="none" stroke="#E11D2E" strokeWidth="3" />
        </g>
      ))}
      {meta.marks.filter((m) => m.arrow).map((m) => (
        <g key={`a${m.n}`}>
          <line x1={m.arrow.from[0]} y1={m.arrow.from[1]} x2={m.arrow.to[0]} y2={m.arrow.to[1]} stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.85" />
          <line x1={m.arrow.from[0]} y1={m.arrow.from[1]} x2={m.arrow.to[0]} y2={m.arrow.to[1]} stroke="#E11D2E" strokeWidth="5" strokeLinecap="round" markerEnd={`url(#${id})`} />
        </g>
      ))}
      {meta.marks.map((m) => {
        // Número en la esquina superior izquierda del recuadro, sin salirse de la imagen.
        const cx = Math.min(Math.max(m.x, 15), meta.w - 15)
        const cy = Math.min(Math.max(m.y, 15), meta.h - 15)
        return (
          <g key={`n${m.n}`}>
            <circle cx={cx} cy={cy} r="14" fill="#E11D2E" stroke="#fff" strokeWidth="3" />
            <text x={cx} y={cy + 5.5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">{m.n}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function HelpShot({ id, caption }) {
  const [zoom, setZoom] = useState(false)
  const meta = SHOTS[id]
  const src = imageFor(id)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e) => { if (e.key === 'Escape') setZoom(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  if (!meta || !src) return <p className="muted">(Captura "{id}" no disponible.)</p>

  return (
    <>
      <figure className="hs-figure">
        <button type="button" className="hs-frame" onClick={() => setZoom(true)} title="Clic para ampliar">
          <img src={src} alt={caption || ''} loading="lazy" />
          <Overlay meta={meta} />
        </button>
        {caption && <figcaption>{caption} <span className="muted">· clic para ampliar</span></figcaption>}
      </figure>

      {/* En un portal: dentro de la vista (que tiene una animación con transform) un position:fixed
          queda limitado a ese contenedor en vez de cubrir la ventana. */}
      {zoom && createPortal(
        <div className="hs-zoom" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          <button type="button" className="hs-zoom-close" onClick={() => setZoom(false)}><X size={16} /> Cerrar (Esc)</button>
          <div className="hs-zoom-inner" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={caption || ''} />
            <Overlay meta={meta} />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
