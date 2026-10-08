import { useEffect, useMemo, useState } from 'react'
import { prepareRun } from '../lib/splitter/engine'

// Prepara la corrida (agrupar sin escribir) con un pequeño retraso, para no recalcular con cada
// tecla en archivos grandes (Rotación tarda ~0,4 s en agrupar 150.000 filas).
export function usePrepared(wb, definition, delay = 350) {
  const key = JSON.stringify(definition)
  const [debounced, setDebounced] = useState(key)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(key), delay)
    return () => clearTimeout(t)
  }, [key, delay])

  return useMemo(() => {
    if (!wb) return { prepared: null, error: null }
    try {
      return { prepared: prepareRun(wb, JSON.parse(debounced)), error: null }
    } catch (e) {
      return { prepared: null, error: e.message || String(e) }
    }
  }, [wb, debounced])
}

// Resumen de lo que va a salir. Con `selected`/`onSelectedChange` deja elegir qué grupos generar.
export default function RunPreview({ prepared, error, selected, onSelectedChange, hideGroups = false }) {
  const [query, setQuery] = useState('')
  if (error) return <div className="banner bad" style={{ marginBottom: 0 }}>{error}</div>
  if (!prepared) return null

  const by = prepared.def.split?.by
  const dataSheets = prepared.sheets.filter((s) => s.kind === 'data')
  const missing = prepared.sheets.filter((s) => s.kind === 'missing')
  const output = by === 'none' ? 'single' : prepared.def.output
  const groups = prepared.groupKeys
  const shown = groups.filter((g) => g.toLowerCase().includes(query.toLowerCase()))
  const selectable = !!onSelectedChange && output !== 'single'
  const sel = selected || new Set(groups)
  const toggle = (g) => {
    const next = new Set(sel)
    if (next.has(g)) next.delete(g)
    else next.add(g)
    onSelectedChange(next)
  }

  return (
    <>
      <div className="dz-stats">
        <div className="dz-stat">
          <b>{output === 'single' ? 1 : output === 'sheets' ? 1 : (selectable ? sel.size : groups.length)}</b>
          <span>{output === 'files' ? 'archivo(s)' : 'archivo'}</span>
        </div>
        {by !== 'none' && output !== 'single' && <div className="dz-stat"><b>{groups.length}</b><span>grupo(s){output === 'sheets' ? ' = pestañas' : ''}</span></div>}
        {dataSheets.map((s) => (
          <div className="dz-stat" key={s.def.name}>
            <b>{s.kept.length.toLocaleString('es-CO')}</b>
            <span>filas en "{s.def.name}" (de la hoja "{s.ws.name}"{s.filteredOut ? `, ${s.filteredOut.toLocaleString('es-CO')} filtradas` : ''})</span>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="hint" style={{ marginTop: 0 }}>
          No se generan: {missing.map((s) => `"${s.def.name}"`).join(', ')} (el archivo no trae esa hoja o sus datos ya están en otra).
        </p>
      )}
      {prepared.skippedRows > 0 && (
        <div className="banner warn">
          {prepared.skippedRows.toLocaleString('es-CO')} fila(s) no tienen valor en "{prepared.def.split.column}" (vacío o 0) y no entran en ningún grupo.
        </div>
      )}
      {prepared.warnings.map((w) => <div className="banner warn" key={w}>{w}</div>)}

      {!hideGroups && by !== 'none' && output !== 'single' && groups.length > 0 && (
        <div className="field">
          <label>
            {selectable ? 'Grupos a generar' : 'Grupos'}
            {selectable && (
              <>
                {' · '}
                <button className="toggle" type="button" onClick={() => onSelectedChange(new Set(groups))}>todos</button>
                {' / '}
                <button className="toggle" type="button" onClick={() => onSelectedChange(new Set())}>ninguno</button>
              </>
            )}
          </label>
          {groups.length > 12 && (
            <input className="input" style={{ maxWidth: 280, marginBottom: 10 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar grupo…" />
          )}
          <div className="chips">
            {shown.map((g) => (
              selectable ? (
                <button key={g} type="button" className={'chip ' + (sel.has(g) ? 'g' : 'gray')} onClick={() => toggle(g)}>
                  {sel.has(g) ? '✓ ' : ''}{g}
                </button>
              ) : <span key={g} className="chip g">{g}</span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
