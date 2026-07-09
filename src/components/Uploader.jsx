import { useRef, useState } from 'react'
import { parseFile } from '../lib/excel'
import Spinner from './Spinner'

export default function Uploader({ type, fileName, onParsed }) {
  const ref = useRef(null)
  const [hot, setHot] = useState(false)
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState('')

  async function handle(file) {
    if (!file) return
    setErr('')
    setReading(true)
    try {
      const parsed = await parseFile(file, type)
      onParsed(parsed, file.name)
    } catch (e) {
      console.error(e)
      setErr('No se pudo leer el archivo. ¿Es un Excel válido (.xlsx / .xls)?')
    } finally {
      setReading(false)
    }
  }

  const sheetLabel = type.sheetHints && type.sheetHints[0]
    ? `hoja "${type.sheetHints[0]}" (o la primera)`
    : 'primera hoja'

  const loaded = !!fileName && !reading

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])}
      />
      <div
        className={'drop' + (hot ? ' hot' : '') + (loaded ? ' loaded' : '')}
        role="button"
        tabIndex={0}
        onClick={() => ref.current.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ref.current.click() } }}
        onDragOver={(e) => { e.preventDefault(); setHot(true) }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); handle(e.dataTransfer.files[0]) }}
      >
        {reading ? (
          <>
            <div className="up" aria-hidden="true"><Spinner /></div>
            <b>Leyendo archivo…</b>
            <p>Un momento</p>
          </>
        ) : loaded ? (
          <>
            <div className="up ok" aria-hidden="true"></div>
            <b className="fname">{fileName}</b>
            <p>Archivo cargado · haz clic para cambiarlo</p>
          </>
        ) : (
          <>
            <div className="up" aria-hidden="true">⬆️</div>
            <b>Arrastra tu Excel aquí o haz clic para buscar</b>
            <p>Se lee la {sheetLabel} · .xlsx, .xls</p>
          </>
        )}
      </div>
      {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}
    </>
  )
}
