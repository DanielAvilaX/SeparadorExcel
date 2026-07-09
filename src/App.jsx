import { useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import TypeSelector from './components/TypeSelector'
import Uploader from './components/Uploader'
import { getType } from './lib/fileTypes'
import { generateZip, downloadBlob } from './lib/excel'

export default function App() {
  const [theme, setTheme] = useState('light')
  const [typeKey, setTypeKey] = useState('PACOM')
  const [parsed, setParsed] = useState(null)
  const [fileName, setFileName] = useState('')
  const [prefix, setPrefix] = useState('')
  const [selectedCols, setSelectedCols] = useState([])
  const [busy, setBusy] = useState(false)

  const type = getType(typeKey)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function selectType(key) {
    setTypeKey(key)
    setParsed(null)
    setFileName('')
    setSelectedCols([])
  }

  function onParsed(p, name) {
    setParsed(p)
    setFileName(name)
    setSelectedCols(p.columns)
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
        rows: parsed.rows,
        columns: selectedCols,
        providerColumn: parsed.providerColumn,
        prefix,
      })
      downloadBlob(blob, `${type.key}_DOCUMENTOS_SEPARADOS.zip`)
    } catch (e) {
      console.error(e)
      alert('Ocurrió un error generando los archivos. Revisa la consola.')
    } finally {
      setBusy(false)
    }
  }

  const ready = parsed && parsed.providerColExists

  return (
    <>
      <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>

      <div className="wrap">
        <TopBar theme={theme} onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />

        {/* Paso 1 */}
        <div className="step">
          <span className="n">1</span>
          <h2>¿Qué archivo vas a procesar?</h2>
          <span className="sub">· elige el tipo</span>
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
                    <button
                      key={c}
                      type="button"
                      className={'chip ' + (selectedCols.includes(c) ? 'g' : 'w')}
                      onClick={() => toggleCol(c)}
                    >
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

        {/* Paso 3 */}
        {ready && (
          <>
            <div className="step">
              <span className="n">3</span>
              <h2>Revisa y genera</h2>
              <span className="sub">· {parsed.providers.length} proveedores en el archivo</span>
            </div>
            <div className="glass">
              <div className="rev good">
                <h4><span className="dot" /> Proveedores encontrados <span className="count">{parsed.providers.length}</span></h4>
                <div className="chips">
                  {parsed.providers.map((p) => <span key={p} className="chip g">{p}</span>)}
                </div>
              </div>
              <p className="hint">
                En la siguiente fase, estos proveedores se cruzarán contra la base de datos para marcar quién recibe
                correo y quién no. Por ahora puedes descargar el ZIP con un Excel por proveedor.
              </p>
              <div className="actions">
                <button className="btn btn-primary" disabled={busy || selectedCols.length === 0} onClick={handleGenerate}>
                  {busy ? 'Generando…' : 'Descargar ZIP'}
                </button>
              </div>
            </div>
          </>
        )}

        <p className="note">
          Fase 1 · separación multi-tipo (PACOM · Rotación) · base de proveedores y correo en las siguientes fases
        </p>
      </div>
    </>
  )
}
