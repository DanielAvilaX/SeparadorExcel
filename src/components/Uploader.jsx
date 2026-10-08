import { useRef, useState } from 'react'
import { formatBytes } from '../lib/excel'
import { loadWorkbook } from '../lib/splitter/workbook'

// Carga un Excel y lo entrega ya leído (libro de ExcelJS, con valores y estilos).
// `hint`: texto bajo "Arrastra tu Excel aquí".
export default function Uploader({ file, onLoaded, onClear, hint, label }) {
  const ref = useRef(null)
  const [hot, setHot] = useState(false)
  const [stage, setStage] = useState(null) // null | 'reading' | 'parsing'
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')

  function openPicker() { ref.current && ref.current.click() }

  function handle(f) {
    if (!f) return
    setErr('')
    setStage('reading')
    setProgress(0)

    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    reader.onerror = () => {
      setStage(null)
      setErr('No se pudo leer el archivo.')
    }
    reader.onload = async () => {
      setProgress(100)
      setStage('parsing')
      // Un respiro para que se pinte "Analizando…" antes del trabajo pesado.
      await new Promise((r) => setTimeout(r, 60))
      try {
        const wb = await loadWorkbook(reader.result, f.name)
        onLoaded(wb, f)
      } catch (e) {
        console.error(e)
        setErr(`No se pudo procesar el archivo. ¿Es un Excel válido (.xlsx / .xls)? Detalle: ${e.message || e}`)
      } finally {
        setStage(null)
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function onInputChange(e) {
    handle(e.target.files[0])
    e.target.value = '' // permite volver a elegir el mismo archivo
  }

  const ext = file ? (file.name.split('.').pop() || '').toUpperCase() : ''

  return (
    <>
      <input ref={ref} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }} onChange={onInputChange} />

      {stage ? (
        <div className="drop reading" aria-live="polite">
          <div className="up" aria-hidden="true">📖</div>
          {stage === 'reading' ? (
            <b>Leyendo archivo… <span className="progress-label">{progress}%</span></b>
          ) : (
            <b>Analizando hojas, columnas y formatos…</b>
          )}
          <div className="progress" style={{ marginTop: 12 }}>
            <i style={{ width: `${stage === 'reading' ? progress : 100}%` }} />
          </div>
        </div>
      ) : file ? (
        <div className="filecard">
          <div className="thumb" aria-hidden="true"><span>{ext || 'XLS'}</span></div>
          <div className="meta">
            <b title={file.name}>{file.name}</b>
            <div className="sub">Excel{label ? ` · ${label}` : ''} · {formatBytes(file.size)}</div>
          </div>
          <div className="fc-actions">
            <button className="mini edit" type="button" onClick={openPicker}>Reemplazar</button>
            <button className="mini del" type="button" onClick={onClear}>Eliminar</button>
          </div>
        </div>
      ) : (
        <div
          className={'drop' + (hot ? ' hot' : '')}
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
          onDragOver={(e) => { e.preventDefault(); if (!hot) setHot(true) }}
          onDragEnter={(e) => { e.preventDefault(); setHot(true) }}
          onDragLeave={(e) => { e.preventDefault(); setHot(false) }}
          onDrop={(e) => { e.preventDefault(); setHot(false); handle(e.dataTransfer.files[0]) }}
        >
          <div className="up" aria-hidden="true">{hot ? '📥' : '⬆️'}</div>
          {hot ? (
            <b className="drop-release">¡Suéltalo!</b>
          ) : (
            <>
              <b>Arrastra tu Excel aquí o haz clic para buscar</b>
              <p>{hint || '.xlsx, .xls'}</p>
            </>
          )}
        </div>
      )}

      {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}
    </>
  )
}
