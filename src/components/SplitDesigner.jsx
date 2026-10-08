import { FILTER_OPS, validateDefinition } from '../lib/splitter/engine'

// Editor de una definición de separación (ver el formato en src/lib/splitter/engine.js).
// `analysis`: resumen del Excel de ejemplo (analyzeWorkbook) para ofrecer hojas y columnas reales;
// sin ejemplo, los nombres se pueden escribir a mano.
// `allowEmail`: muestra la opción "usar para enviar correos" (no aplica al Separador express).

const upper = (s) => String(s || '').trim().toUpperCase()

function moveItem(list, i, delta) {
  const j = i + delta
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function Opt({ name, value, current, onPick, title, children, disabled }) {
  const on = current === value
  return (
    <label className={'dz-opt' + (on ? ' on' : '') + (disabled ? ' off' : '')}>
      <input type="radio" name={name} checked={on} disabled={disabled} onChange={() => onPick(value)} />
      <span><b>{title}</b>{children}</span>
    </label>
  )
}

// Hoja del ejemplo que correspondería a una hoja de salida (por nombre, o la primera libre).
function sampleSheetFor(sheet, analysis, allSheets) {
  if (!analysis) return null
  const hints = (sheet.source || []).map(upper)
  const byName = analysis.find((a) => hints.includes(upper(a.name)))
  if (byName) return byName
  if (sheet.fallback !== 'first') return null
  const claimed = new Set(allSheets.filter((s) => s.type === 'data').flatMap((s) => (s.source || []).map(upper)))
  return analysis.find((a) => !claimed.has(upper(a.name))) || null
}

function DataSheetEditor({ sheet, onChange, analysis, allSheets, columnList }) {
  const sample = sampleSheetFor(sheet, analysis, allSheets)
  const sampleCols = sample ? sample.columns.map((c) => c.name) : []
  const set = (patch) => onChange({ ...sheet, ...patch })
  const mainSource = (sheet.source || [])[0] || ''
  const otherSources = (sheet.source || []).slice(1).join('; ')

  function pickColumnsMode(explicit) {
    if (!explicit) return set({ columns: null })
    const base = sampleCols.length ? sampleCols : []
    set({ columns: base.map((name) => ({ from: name, as: name })) })
  }

  // Columnas del ejemplo que todavía no están en la lista (para agregarlas).
  const listed = new Set((sheet.columns || []).map((c) => upper(c.from)))
  const notListed = sampleCols.filter((c) => !listed.has(upper(c)))

  return (
    <>
      <div className="fields" style={{ marginTop: 0 }}>
        <div className="field">
          <label>Toma los datos de la hoja</label>
          {analysis ? (
            <select className="input" value={mainSource}
              onChange={(e) => set({ source: [e.target.value, ...(sheet.source || []).slice(1)].filter(Boolean) })}>
              <option value="">— elegir hoja —</option>
              {analysis.map((a) => <option key={a.name} value={a.name}>{a.name} ({a.rowCount} filas)</option>)}
              {mainSource && !analysis.some((a) => upper(a.name) === upper(mainSource)) && (
                <option value={mainSource}>{mainSource} (no está en el ejemplo)</option>
              )}
            </select>
          ) : (
            <input className="input" value={mainSource} placeholder="Nombre de la hoja en el Excel"
              onChange={(e) => set({ source: [e.target.value, ...(sheet.source || []).slice(1)] })} />
          )}
        </div>
        <div className="field">
          <label>Otros nombres que puede tener (separados por ;)</label>
          <input className="input" value={otherSources} placeholder="Ej: CONFIRMACION DESCUENTOS"
            onChange={(e) => set({ source: [mainSource, ...e.target.value.split(';').map((s) => s.trim())].filter((s, i) => i === 0 || s) })} />
        </div>
      </div>

      <label className="dz-check">
        <input type="checkbox" checked={sheet.fallback === 'first'} onChange={(e) => set({ fallback: e.target.checked ? 'first' : 'none' })} />
        Si el archivo no trae esa hoja, usar la primera hoja que no use otra hoja de salida
      </label>
      <label className="dz-check">
        <input type="checkbox" checked={!!sheet.optional} onChange={(e) => set({ optional: e.target.checked })} />
        Opcional: si el archivo no la trae, se omite sin error
      </label>

      <div className="fields">
        <div className="field">
          <label>Fila del encabezado</label>
          <input className="input" type="number" min="1" value={sheet.headerRow || ''}
            placeholder={sample ? `Automática (en este ejemplo: fila ${sample.headerRow})` : 'Automática'}
            onChange={(e) => set({ headerRow: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null })} />
        </div>
        <div className="field">
          <label>Fila de total arriba del encabezado</label>
          <input className="input" list="dz-all-columns" value={sheet.total || ''} placeholder="Sin total (o escribe/elige una columna)"
            onChange={(e) => set({ total: e.target.value || null })} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Columnas</label>
        <label className="dz-check" style={{ marginTop: 0 }}>
          <input type="radio" checked={!sheet.columns} onChange={() => pickColumnsMode(false)} />
          <span><b>Todas las que traiga el archivo</b>, en su mismo orden (si el reporte agrega una columna nueva, sale sola)</span>
        </label>
        <label className="dz-check">
          <input type="radio" checked={!!sheet.columns} onChange={() => pickColumnsMode(true)} />
          <span><b>Elegir columnas</b>, su orden y su nombre en la salida</span>
        </label>

        {sheet.columns && (
          <>
            <table className="dz-cols">
              <tbody>
                {sheet.columns.map((c, i) => (
                  <tr key={i}>
                    <td className="dz-arrows">
                      <button type="button" disabled={i === 0} onClick={() => set({ columns: moveItem(sheet.columns, i, -1) })} title="Subir">▲</button>
                      <button type="button" disabled={i === sheet.columns.length - 1} onClick={() => set({ columns: moveItem(sheet.columns, i, 1) })} title="Bajar">▼</button>
                    </td>
                    <td style={{ width: '45%' }}>
                      <input className="input" list="dz-all-columns" value={c.from}
                        onChange={(e) => set({ columns: sheet.columns.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)) })} />
                    </td>
                    <td className="muted">→</td>
                    <td style={{ width: '45%' }}>
                      <input className="input" value={c.as} placeholder="Mismo nombre"
                        onChange={(e) => set({ columns: sheet.columns.map((x, k) => (k === i ? { ...x, as: e.target.value } : x)) })} />
                    </td>
                    <td>
                      <button className="mini del" type="button" onClick={() => set({ columns: sheet.columns.filter((_, k) => k !== i) })}>Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dz-line">
              {notListed.length > 0 && (
                <select className="input" value="" onChange={(e) => e.target.value && set({ columns: [...sheet.columns, { from: e.target.value, as: e.target.value }] })}>
                  <option value="">+ Agregar columna del ejemplo…</option>
                  {notListed.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <button className="mini edit" type="button" onClick={() => set({ columns: [...sheet.columns, { from: '', as: '' }] })}>+ Columna escrita a mano</button>
            </div>
            {!columnList.length && <p className="hint">Carga un Excel de ejemplo para elegir las columnas de una lista.</p>}
          </>
        )}
      </div>
    </>
  )
}

function FormSheetEditor({ sheet, onChange }) {
  const set = (patch) => onChange({ ...sheet, ...patch })
  const headers = sheet.headers || []
  const setHeader = (i, patch) => set({ headers: headers.map((h, k) => (k === i ? { ...h, ...patch } : h)) })
  const toHex = (argb) => '#' + String(argb || 'FFB4C7E7').slice(-6)

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>Hoja sin datos del archivo: encabezados con color y filas vacías para que quien la reciba la llene.</p>
      <div className="field">
        <label>Notas arriba (una por línea, opcional)</label>
        <textarea className="input" rows={2} value={(sheet.notes || []).join('\n')}
          onChange={(e) => set({ notes: e.target.value.split('\n') })} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Encabezados</label>
        <table className="dz-cols">
          <tbody>
            {headers.map((h, i) => (
              <tr key={i}>
                <td className="dz-arrows">
                  <button type="button" disabled={i === 0} onClick={() => set({ headers: moveItem(headers, i, -1) })}>▲</button>
                  <button type="button" disabled={i === headers.length - 1} onClick={() => set({ headers: moveItem(headers, i, 1) })}>▼</button>
                </td>
                <td style={{ width: '55%' }}>
                  <input className="input" value={h.label} placeholder="Texto del encabezado" onChange={(e) => setHeader(i, { label: e.target.value })} />
                </td>
                <td title="Color de fondo">
                  <input className="dz-color" type="color" value={toHex(h.fill)} onChange={(e) => setHeader(i, { fill: 'FF' + e.target.value.slice(1).toUpperCase() })} />
                </td>
                <td style={{ width: 90 }}>
                  <input className="input" type="number" min="5" value={h.width || ''} placeholder="Ancho" onChange={(e) => setHeader(i, { width: e.target.value ? Number(e.target.value) : null })} />
                </td>
                <td><button className="mini del" type="button" onClick={() => set({ headers: headers.filter((_, k) => k !== i) })}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dz-line">
          <button className="mini edit" type="button" onClick={() => set({ headers: [...headers, { label: '', fill: 'FF00B050', width: 18 }] })}>+ Encabezado</button>
        </div>
      </div>
      <div className="fields">
        <div className="field">
          <label>Filas en blanco antes del encabezado</label>
          <input className="input" type="number" min="0" value={sheet.blankBefore ?? 0} onChange={(e) => set({ blankBefore: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <div className="field">
          <label>Filas vacías con borde para llenar</label>
          <input className="input" type="number" min="0" value={sheet.emptyRows ?? 2} onChange={(e) => set({ emptyRows: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
      </div>
    </>
  )
}

export default function SplitDesigner({ definition: def, onChange, analysis, allowEmail }) {
  const set = (patch) => onChange({ ...def, ...patch })
  const split = def.split || { by: 'none' }
  const setSplit = (patch) => {
    const next = { ...split, ...patch }
    onChange({ ...def, split: next, output: next.by === 'none' ? 'single' : (def.output === 'single' ? 'files' : def.output) })
  }

  const columnList = [...new Set((analysis || []).flatMap((a) => a.columns.map((c) => c.name)))]
  const sheets = def.sheets || []
  const setSheet = (i, s) => set({ sheets: sheets.map((x, k) => (k === i ? s : x)) })
  const filters = def.filters || []
  const setFilter = (i, patch) => set({ filters: filters.map((f, k) => (k === i ? { ...f, ...patch } : f)) })

  const splitInfo = split.by === 'column' && analysis
    ? analysis.flatMap((a) => a.columns.filter((c) => upper(c.name) === upper(split.column)).map((c) => `${c.distinct} valores distintos en "${a.name}"`))
    : []

  function addDataSheet() {
    const first = analysis?.[0]?.name || ''
    set({ sheets: [...sheets, { type: 'data', name: first || `Hoja ${sheets.length + 1}`, source: first ? [first] : [], fallback: 'none', optional: false, headerRow: null, columns: null, total: null }] })
  }
  function addFormSheet() {
    set({ sheets: [...sheets, { type: 'form', name: 'FORMULARIO', notes: [], blankBefore: 0, headers: [{ label: '', fill: 'FF00B050', width: 18 }], staticRows: [], emptyRows: 2 }] })
  }

  const errors = validateDefinition({ ...def, sheets })

  return (
    <>
      <datalist id="dz-all-columns">
        {columnList.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title"><h2>1 · ¿Cómo se separa?</h2></div>
        <div className="dz-opts">
          <Opt name="split" value="column" current={split.by} onPick={(v) => setSplit({ by: v })} title="Por columna">
            Un grupo por cada valor distinto de una columna (ej. cada PROVEEDOR).
          </Opt>
          <Opt name="split" value="rows" current={split.by} onPick={(v) => setSplit({ by: v })} title="Por cantidad de filas">
            Grupos de N filas (Parte 1, Parte 2…).
          </Opt>
          <Opt name="split" value="none" current={split.by} onPick={(v) => setSplit({ by: v })} title="Sin separar">
            Todo en un solo archivo (útil para filtrar o reorganizar hojas y columnas).
          </Opt>
        </div>
        {split.by === 'column' && (
          <div className="field" style={{ marginTop: 14 }}>
            <label>Columna para separar</label>
            {columnList.length ? (
              <select className="input" value={split.column || ''} onChange={(e) => setSplit({ column: e.target.value })}>
                <option value="">— elegir columna —</option>
                {columnList.map((c) => <option key={c} value={c}>{c}</option>)}
                {split.column && !columnList.some((c) => upper(c) === upper(split.column)) && <option value={split.column}>{split.column} (no está en el ejemplo)</option>}
              </select>
            ) : (
              <input className="input" value={split.column || ''} placeholder="Ej: PROVEEDOR" onChange={(e) => setSplit({ column: e.target.value })} />
            )}
            {splitInfo.length > 0 && <p className="hint">{splitInfo.join(' · ')}</p>}
          </div>
        )}
        {split.by === 'rows' && (
          <div className="field" style={{ marginTop: 14, maxWidth: 260 }}>
            <label>Filas por grupo</label>
            <input className="input" type="number" min="1" value={split.size || ''} onChange={(e) => setSplit({ size: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
          </div>
        )}

        {split.by !== 'none' && (
          <>
            <div className="field" style={{ marginTop: 18 }}><label>Resultado</label></div>
            <div className="dz-opts">
              <Opt name="output" value="files" current={def.output} onPick={(v) => set({ output: v })} title="Un archivo por grupo">
                Un Excel para cada grupo (todos dentro de un ZIP).
              </Opt>
              <Opt name="output" value="sheets" current={def.output} onPick={(v) => set({ output: v, email: false })} title="Un archivo, una hoja por grupo">
                Un solo Excel con una pestaña para cada grupo.
              </Opt>
              <Opt name="output" value="single" current={def.output} onPick={(v) => set({ output: v, email: false })} title="Un solo archivo con todo">
                Sin separar en grupos, solo con los filtros y las hojas elegidas.
              </Opt>
            </div>
          </>
        )}

        {allowEmail && (
          <label className="dz-check" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={!!def.email}
              disabled={split.by !== 'column' || def.output !== 'files'}
              onChange={(e) => set({ email: e.target.checked })} />
            <span>
              <b>Usar para enviar correos a proveedores</b>: cada grupo es un proveedor de la base y recibe su archivo.
              {(split.by !== 'column' || def.output !== 'files') && ' (Requiere separar por columna y un archivo por grupo.)'}
            </span>
          </label>
        )}
      </div>

      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h2>2 · Filtrar filas <span className="muted">(opcional)</span></h2>
          <button className="mini edit" type="button" onClick={() => set({ filters: [...filters, { action: 'exclude', column: split.column || '', op: 'empty', value: '' }] })}>+ Filtro</button>
        </div>
        {filters.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Se incluyen todas las filas.</p>
        ) : filters.map((f, i) => {
          const op = FILTER_OPS.find((o) => o.key === f.op) || FILTER_OPS[0]
          return (
            <div className="dz-line" key={i}>
              <select className="input" value={f.action} onChange={(e) => setFilter(i, { action: e.target.value })}>
                <option value="include">Incluir solo filas donde</option>
                <option value="exclude">Excluir filas donde</option>
              </select>
              <input className="input" list="dz-all-columns" value={f.column} placeholder="Columna" onChange={(e) => setFilter(i, { column: e.target.value })} />
              <select className="input" value={f.op} onChange={(e) => setFilter(i, { op: e.target.value })}>
                {FILTER_OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {op.needsValue && <input className="input" value={f.value ?? ''} placeholder="Valor" onChange={(e) => setFilter(i, { value: e.target.value })} />}
              <button className="mini del" type="button" onClick={() => set({ filters: filters.filter((_, k) => k !== i) })}>Quitar</button>
            </div>
          )
        })}
        {filters.length > 0 && <p className="hint">Sin importar mayúsculas. Un filtro aplica a las hojas que tengan esa columna.</p>}
      </div>

      <div className="glass">
        <div className="section-title">
          <h2>3 · Hojas de cada archivo</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mini edit" type="button" onClick={addDataSheet}>+ Hoja con datos</button>
            <button className="mini edit" type="button" onClick={addFormSheet}>+ Hoja formulario</button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Cada celda conserva el formato y el estilo del Excel original (porcentajes, moneda, fechas, colores, anchos).
        </p>
        {sheets.length === 0 && <p className="muted">Todavía no hay hojas. Agrega al menos una hoja con datos.</p>}
        {sheets.map((s, i) => (
          <div className="dz-sheet" key={i}>
            <div className="dz-sheet-head">
              <span className={'tag' + (s.type === 'form' ? ' form' : '')}>{s.type === 'form' ? 'Formulario' : 'Datos'}</span>
              <input className="input" style={{ maxWidth: 320, padding: '8px 11px' }} value={s.name} placeholder="Nombre de la hoja en la salida"
                onChange={(e) => setSheet(i, { ...s, name: e.target.value })} />
              <span className="spacer-x" />
              <span className="dz-arrows">
                <button type="button" disabled={i === 0} onClick={() => set({ sheets: moveItem(sheets, i, -1) })} title="Mover a la izquierda">▲</button>
                <button type="button" disabled={i === sheets.length - 1} onClick={() => set({ sheets: moveItem(sheets, i, 1) })} title="Mover a la derecha">▼</button>
              </span>
              <button className="mini del" type="button" onClick={() => set({ sheets: sheets.filter((_, k) => k !== i) })}>Quitar hoja</button>
            </div>
            {s.type === 'form'
              ? <FormSheetEditor sheet={s} onChange={(x) => setSheet(i, x)} />
              : <DataSheetEditor sheet={s} onChange={(x) => setSheet(i, x)} analysis={analysis} allSheets={sheets} columnList={columnList} />}
          </div>
        ))}
        {errors.length > 0 && <ul className="dz-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      </div>
    </>
  )
}

// Propuesta inicial a partir de un Excel de ejemplo: una hoja de salida por cada hoja con datos,
// separando por la columna que parezca de proveedor.
export function suggestDefinition(analysis) {
  const cols = analysis.flatMap((a) => a.columns.map((c) => c.name))
  const guess = cols.find((c) => /PROVEEDOR|NOMBRE_PROV/i.test(c)) || ''
  return {
    email: false,
    split: guess ? { by: 'column', column: guess, size: 1000 } : { by: 'none', column: '', size: 1000 },
    output: guess ? 'files' : 'single',
    filters: [],
    sheets: analysis.filter((a) => a.rowCount > 0).map((a) => ({
      type: 'data', name: a.name, source: [a.name], fallback: 'none', optional: false, headerRow: null, columns: null, total: null,
    })),
  }
}
