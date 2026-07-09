import { useRef, useState } from 'react'
import { parseFile } from '../lib/excel'

export default function Uploader({ type, fileName, onParsed }) {
  const ref = useRef(null)
  const [hot, setHot] = useState(false)
  const [err, setErr] = useState('')

  async function handle(file) {
    if (!file) return
    setErr('')
    try {
      const parsed = await parseFile(file, type)
      onParsed(parsed, file.name)
    } catch (e) {
      console.error(e)
      setErr('No se pudo leer el archivo. ¿Es un Excel válido (.xlsx / .xls)?')
    }
  }

  const sheetLabel = type.sheetHints && type.sheetHints[0]
    ? `hoja "${type.sheetHints[0]}" (o la primera)`
    : 'primera hoja'

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
        className={'drop' + (hot ? ' hot' : '')}
        role="button"
        tabIndex={0}
        onClick={() => ref.current.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ref.current.click() } }}
        onDragOver={(e) => { e.preventDefault(); setHot(true) }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); handle(e.dataTransfer.files[0]) }}
      >
        <div className="up" aria-hidden="true">⬆️</div>
        {fileName
          ? <b className="fname">{fileName}</b>
          : <b>Arrastra tu Excel aquí o haz clic para buscar</b>}
        <p>Se lee la {sheetLabel} · .xlsx, .xls</p>
      </div>
      {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}
    </>
  )
}
