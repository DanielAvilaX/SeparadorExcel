import { useState, useEffect, useMemo } from 'react'
import TypeSelector from '../components/TypeSelector'
import Uploader from '../components/Uploader'
import { getType } from '../lib/fileTypes'
import { generateZip, downloadBlob } from '../lib/excel'
import { isConfigured } from '../lib/supabase'
import { listProviders } from '../lib/providers'

export default function ProcesarView() {
  const [typeKey, setTypeKey] = useState('PACOM')
  const [parsed, setParsed] = useState(null)
  const [fileName, setFileName] = useState('')
  const [prefix, setPrefix] = useState('')
  const [selectedCols, setSelectedCols] = useState([])
  const [busy, setBusy] = useState(false)

  // Proveedores en la base (para el cruce)
  const [db, setDb] = useState([])
  const [dbLoaded, setDbLoaded] = useState(false)

  const type = getType(typeKey)

  useEffect(() => {
    if (!isConfigured()) { setDbLoaded(true); return }
    listProviders()
      .then((rows) => setDb(rows))
      .catch((e) => console.error('No se pudo cargar proveedores:', e.message))
      .finally(() => setDbLoaded(true))
  }, [])

  // Índice nombre -> proveedor (coincidencia EXACTA por nombre)
  const dbIndex = useMemo(() => {
    const m = new Map()
    db.forEach((p) => m.set(p.nombre, p))
    return m
  }, [db])

  // Cruce: recibirán correo (en base, activo, con ≥1 correo) vs. sin correo
  const match = useMemo(() => {
    if (!parsed || !parsed.providerColExists) return null
    const conCorreo = []
    const sinCorreo = []
    for (const name of parsed.providers) {
      const p = dbIndex.get(name)
      if (p && p.activo && (p.emails || []).length > 0) conCorreo.push({ name, emails: p.emails })
      else sinCorreo.push({ name, reason: !p ? 'no está en la base' : !p.activo ? 'inactivo' : 'sin correo' })
    }
    return { conCorreo, sinCorreo }
  }, [parsed, dbIndex])

  function selectType(key) {
    setTypeKey(key); setParsed(null); setFileName(''); setSelectedCols([])
  }
  function onParsed(p, name) {
    setParsed(p); setFileName(name); setSelectedCols(p.columns)
  }
  function toggleCol(c) {
    setSelectedCols((cols) => (cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c]))
  }
  function toggleAll() {
    setSelectedCols((cols) => (cols.length === parsed.columns.length ? [] : parsed.columns))
  }

  async function handleGenerate() {
    if (!parsed) return
    setBusy(true)
    try {
      const { blob } = await generateZip({
        rows: parsed.rows, columns: selectedCols, providerColumn: parsed.providerColumn, prefix,
      })
      downloadBlob(blob, `${type.key}_DOCUMENTOS_SEPARADOS.zip`)
    } catch (e) {
      console.error(e); alert('Ocurrió un error generando los archivos. Revisa la consola.')
    } finally { setBusy(false) }
  }

  const ready = parsed && parsed.providerColExists

  return (
    <>
      {/* Paso 1 */}
      <div className="step">
        <span className="n">1</span><h2>¿Qué archivo vas a procesar?</h2><span className="sub">· elige el tipo</span>
      </div>
      <TypeSelector selected={typeKey} onSelect={selectType} />

      {/* Paso 2 */}
      <div className="step"><span className="n">2</span><h2>Carga el archivo</h2></div>
      <div className="glass">
        <div className="glass-head">
          <h2>Archivo de origen</h2>
          <span className="pill-type">Tipo: {type.label}</span>
        </div>

        <Uploader type={type} fileName={fileName} onParsed={onParsed} />

        {parsed && (
          <>
            <div className="fields">
              <div className="field">
                <label>Columna de proveedor detectada</label>
                <div className="inset">
                  {parsed.providerColExists ? parsed.providerColumn : '⚠ no encontrada'}
                  <span className="tag">{parsed.providerColExists ? 'automático' : 'revisar'}</span>
                </div>
              </div>
              <div className="field">
                <label>Prefijo del archivo (opcional)</label>
                <div className="inset">
                  <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Ej: PACOM_Agosto_" />
                </div>
              </div>
            </div>

            {!parsed.providerColExists && (
              <p className="hint" style={{ color: 'var(--bad)' }}>
                El archivo no tiene la columna <b>{parsed.providerColumn}</b>. Verifica que sea un archivo de tipo <b>{type.label}</b>.
              </p>
            )}

            <div className="spacer" />
            <div className="field">
              <label>Columnas a incluir en cada archivo</label>
              <div className="chips" style={{ maxHeight: 'none' }}>
                {parsed.columns.map((c) => (
                  <button key={c} type="button"
                    className={'chip ' + (selectedCols.includes(c) ? 'g' : 'w')}
                    onClick={() => toggleCol(c)}>
                    {selectedCols.includes(c) ? '✓ ' : '＋ '}{c}
                  </button>
                ))}
              </div>
              <div className="hint">
                <button className="toggle" type="button" onClick={toggleAll}>Marcar / desmarcar todas</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Paso 3 — Revisión con cruce contra la base */}
      {ready && match && (
        <>
          <div className="step">
            <span className="n">3</span><h2>Revisa antes de enviar</h2>
            <span className="sub">· {parsed.providers.length} proveedores en el archivo</span>
          </div>
          <div className="glass">
            {!isConfigured() && (
              <div className="banner warn">Supabase no está configurado; no se puede cruzar contra la base.</div>
            )}
            {isConfigured() && dbLoaded && db.length === 0 && (
              <div className="banner warn">
                La base de proveedores está vacía. Ve a <b>Proveedores</b> y carga la lista (o sube el Excel) para
                que se pueda saber quién recibe correo.
              </div>
            )}

            <div className="review-grid">
              <div className="rev good">
                <h4><span className="dot" /> Recibirán correo <span className="count">{match.conCorreo.length}</span></h4>
                {match.conCorreo.length === 0
                  ? <p className="muted">Ninguno coincide con la base todavía.</p>
                  : <div className="chips">{match.conCorreo.map((p) => <span key={p.name} className="chip g" title={p.emails.join(', ')}>{p.name}</span>)}</div>}
              </div>
              <div className="rev warn">
                <h4><span className="dot" /> Sin correo en la base <span className="count">{match.sinCorreo.length}</span></h4>
                {match.sinCorreo.length === 0
                  ? <p className="muted">Todos los proveedores tienen correo. 🎉</p>
                  : <div className="chips">{match.sinCorreo.map((p) => <span key={p.name} className="chip w" title={p.reason}>{p.name}</span>)}</div>}
              </div>
            </div>

            {match.sinCorreo.length > 0 && (
              <div className="banner warn" style={{ marginTop: 16 }}>
                Los de la derecha <b>no recibirán correo</b> (no coinciden exacto con la base, están inactivos o no
                tienen correo). Puedes corregir el Excel o agregarlos en <b>Proveedores</b> y volver a subir el archivo.
                No bloquea la descarga.
              </div>
            )}

            <p className="hint">El envío de correos se habilita en la siguiente fase. Por ahora puedes descargar el ZIP con un Excel por proveedor.</p>
            <div className="actions">
              <button className="btn btn-primary" disabled={busy || selectedCols.length === 0} onClick={handleGenerate}>
                {busy ? 'Generando…' : 'Descargar ZIP'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
