import { useRef, useState } from 'react'
import { parseBuffer, formatBytes } from '../lib/excel'

export default function Uploader({ type, file, onParsed, onClear }) {
  const ref = useRef(null)
  const [hot, setHot] = useState(false)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')

  function openPicker() { ref.current && ref.current.click() }

  function handle(f) {
    if (!f) return
    setErr('')
    setReading(true)
    setProgress(0)

    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    reader.onerror = () => {
      setReading(false)
      setErr('No se pudo leer el archivo.')
    }
    reader.onload = () => {
      setProgress(100)
      // Pequeña pausa para que la barra alcance el 100% antes de procesar (parseo síncrono).
      setTimeout(() => {
        try {
          const parsed = parseBuffer(reader.result, type)
          onParsed(parsed, f)
        } catch (e) {
          console.error(e)
          setErr('No se pudo procesar el archivo. ¿Es un Excel válido (.xlsx / .xls)?')
        } finally {
          setReading(false)
        }
      }, 120)
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
      <input ref={ref} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onInputChange} />

      {/* Estado: leyendo (barra de porcentaje) */}
      {reading ? (
        <div className="drop reading" aria-live="polite">
          <div className="up" aria-hidden="true">📖</div>
          <b>Leyendo archivo… <span className="progress-label">{progress}%</span></b>
          <div className="progress" style={{ marginTop: 12 }}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : file ? (
        /* Estado: archivo cargado (miniatura) */
        <div className="filecard">
          <div className="thumb" aria-hidden="true"><span>{ext || 'XLS'}</span></div>
          <div className="meta">
            <b title={file.name}>{file.name}</b>
            <div className="sub">Excel · {type.label} · {formatBytes(file.size)}</div>
          </div>
          <div className="fc-actions">
            <button className="mini edit" type="button" onClick={openPicker}>Reemplazar</button>
            <button className="mini del" type="button" onClick={onClear}>Eliminar</button>
          </div>
        </div>
      ) : (
        /* Estado: vacío / arrastrando */
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
              <p>Se lee la {type.sheetHints && type.sheetHints[0] ? `hoja "${type.sheetHints[0]}" (o la primera)` : 'primera hoja'} · .xlsx, .xls</p>
            </>
          )}
        </div>
      )}

      {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}
    </>
  )
}
