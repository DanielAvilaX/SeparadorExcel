import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import HelpShot from '../components/HelpShot'
import { HELP_GROUPS, HELP_SECTIONS } from '../help/content'

const byId = new Map(HELP_SECTIONS.map((s) => [s.id, s]))
const ORDER = HELP_GROUPS.flatMap((g) => g.ids).filter((id) => byId.has(id))

// **negrita** -> <b>
function Rich({ text }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))
}

const plain = (s) => String(s || '').replace(/\*\*/g, '').toLowerCase()
function sectionText(s) {
  return plain([s.title, ...s.blocks.flatMap((b) => [b.p, b.h, b.note, b.title, b.caption, ...(b.steps || []), ...(b.list || []), ...Object.values(b.legend || {})])].join(' '))
}

function Block({ b, index }) {
  if (b.h) return <h3 className="hv-h">{b.h}</h3>
  if (b.p) return <p className="hv-p"><Rich text={b.p} /></p>
  if (b.steps) return <ol className="hv-steps">{b.steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>
  if (b.list) return <ul className="hv-list">{b.list.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>
  if (b.note) {
    return (
      <div className={'hv-note ' + (b.tone || 'info')}>
        {b.title && <b className="hv-note-title">{b.title}</b>}
        <span><Rich text={b.note} /></span>
      </div>
    )
  }
  if (b.table) {
    return (
      <div className="tbl-wrap hv-table">
        <table className="tbl">
          <thead><tr>{b.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  if (b.shot) {
    const legend = Object.entries(b.legend || {})
    return (
      <div className="hv-shot" key={index}>
        <HelpShot id={b.shot} caption={b.caption} />
        {legend.length > 0 && (
          <ol className="hv-legend">
            {legend.map(([n, text]) => (
              <li key={n}><span className="hv-num">{n}</span><span><Rich text={text} /></span></li>
            ))}
          </ol>
        )}
      </div>
    )
  }
  return null
}

export default function AyudaView({ sectionId, onSectionChange }) {
  const [query, setQuery] = useState('')
  const current = byId.get(sectionId) ? sectionId : ORDER[0]
  const section = byId.get(current)
  const pos = ORDER.indexOf(current)
  const prev = pos > 0 ? byId.get(ORDER[pos - 1]) : null
  const next = pos < ORDER.length - 1 ? byId.get(ORDER[pos + 1]) : null
  const topRef = useRef(null)

  const matches = useMemo(() => {
    const q = plain(query).trim()
    if (!q) return null
    return new Set(HELP_SECTIONS.filter((s) => sectionText(s).includes(q)).map((s) => s.id))
  }, [query])

  function go(id) {
    onSectionChange(id)
  }

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
    window.scrollTo(0, 0)
  }, [current])

  // Flechas del teclado para pasar de sección (salvo mientras se escribe en el buscador).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || document.querySelector('.hs-zoom')) return
      if (e.key === 'ArrowRight' && next) go(next.id)
      if (e.key === 'ArrowLeft' && prev) go(prev.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const NavButtons = ({ bottom }) => (
    <div className={'hv-pager' + (bottom ? ' bottom' : '')}>
      <button type="button" className="btn btn-ghost" disabled={!prev} onClick={() => prev && go(prev.id)}>
        <ChevronLeft size={16} /> {bottom && prev ? prev.title : 'Anterior'}
      </button>
      <span className="muted hv-count">{pos + 1} de {ORDER.length}</span>
      <button type="button" className="btn btn-primary" disabled={!next} onClick={() => next && go(next.id)}>
        {bottom && next ? next.title : 'Siguiente'} <ChevronRight size={16} />
      </button>
    </div>
  )

  return (
    <>
      <div className="step" ref={topRef}><span className="n">?</span><h2>Ayuda</h2><span className="sub">· cómo usar la aplicación</span></div>

      <div className="hv-layout">
        <aside className="glass hv-toc">
          <div className="hv-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en la ayuda…" />
          </div>
          {HELP_GROUPS.map((g) => {
            const ids = g.ids.filter((id) => byId.has(id) && (!matches || matches.has(id)))
            if (!ids.length) return null
            return (
              <div key={g.title} className="hv-group">
                <p className="hv-group-title">{g.title}</p>
                {ids.map((id) => (
                  <button key={id} type="button" className={'hv-link' + (id === current ? ' on' : '')} onClick={() => go(id)}>
                    <span className="hv-link-n">{ORDER.indexOf(id) + 1}</span>{byId.get(id).title}
                  </button>
                ))}
              </div>
            )
          })}
          {matches && matches.size === 0 && <p className="muted" style={{ fontSize: 13 }}>Sin resultados para "{query}".</p>}
        </aside>

        <article className="glass hv-content">
          <NavButtons />
          <h1 className="hv-title"><span className="hv-title-n">{pos + 1}</span>{section.title}</h1>
          {section.blocks.map((b, i) => <Block key={`${current}-${i}`} b={b} index={i} />)}
          <NavButtons bottom />
        </article>
      </div>
    </>
  )
}
