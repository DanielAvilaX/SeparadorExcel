import { useState } from 'react'
import Uploader from '../components/Uploader'
import Spinner from '../components/Spinner'
import SplitDesigner, { suggestDefinition } from '../components/SplitDesigner'
import RunPreview, { usePrepared } from '../components/RunPreview'
import { toast } from '../lib/toast'
import { analyzeWorkbook } from '../lib/splitter/workbook'
import { buildFiles } from '../lib/splitter/engine'
import { downloadFiles } from '../lib/excel'
import { createConfig } from '../lib/configs'

// Separador express: subir un Excel, decidir cómo separarlo y descargar. No envía correos ni
// guarda nada (salvo que el usuario decida guardarlo como configuración).
// El estado vive en App (`state`/`setState`) para no perder el trabajo al cambiar de pestaña.
export default function ExpressView({ state, setState, dbReady, onConfigsChanged }) {
  const { wb, file, analysis, definition, selected, prefix } = state
  const patch = (p) => setState((s) => ({ ...s, ...p }))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  const { prepared, error } = usePrepared(wb, definition)

  function onLoaded(book, f) {
    const a = analyzeWorkbook(book)
    patch({ wb: book, file: f, analysis: a, definition: suggestDefinition(a), selected: null })
  }

  async function generate() {
    if (!prepared) return
    setBusy(true)
    setProgress(null)
    try {
      const only = selected ? [...selected] : null
      if (only && only.length === 0) { toast.error('No hay grupos marcados para generar.'); return }
      const base = (file?.name || 'separado').replace(/\.[^.]+$/, '')
      const files = await buildFiles(prepared, {
        prefix, onlyGroups: only, baseName: base,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      await downloadFiles(files, `${prefix}${base}_SEPARADO.zip`)
      toast.success(`Listo · ${files.length} archivo${files.length === 1 ? '' : 's'}.`)
    } catch (e) {
      console.error(e)
      toast.error('Error generando los archivos: ' + (e.message || e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function saveAsConfig() {
    if (!saveName.trim()) return toast.error('Ponle un nombre a la configuración.')
    setSaving(true)
    try {
      await createConfig({ nombre: saveName, descripcion: '', icono: '', definition, nota: 'Creada desde el Separador express' })
      toast.success(`Configuración "${saveName.trim()}" guardada. La encuentras en Separaciones.`)
      setSaveName('')
      onConfigsChanged()
    } catch (e) {
      console.error(e)
      toast.error('No se pudo guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => setState({ wb: null, file: null, analysis: null, definition: null, selected: null, prefix: '' })

  return (
    <>
      <div className="step"><span className="n">⚡</span><h2>Separador express</h2><span className="sub">· separa cualquier Excel sin guardar ni enviar correos</span></div>

      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="glass-head"><h2>Archivo</h2></div>
        <Uploader file={file} onLoaded={onLoaded} onClear={reset} hint="Se analizan todas sus hojas y columnas · .xlsx, .xls" />
      </div>

      {wb && definition && (
        <>
          <SplitDesigner definition={definition} onChange={(d) => patch({ definition: d, selected: null })} analysis={analysis} allowEmail={false} />

          <div className="step"><span className="n">4</span><h2>Resultado</h2></div>
          <div className="glass">
            <RunPreview prepared={prepared} error={error} selected={selected} onSelectedChange={(s) => patch({ selected: s })} />

            <div className="fields">
              <div className="field">
                <label>Prefijo del archivo (opcional)</label>
                <input className="input" value={prefix} onChange={(e) => patch({ prefix: e.target.value })} placeholder="Ej: Octubre_" />
              </div>
            </div>

            <div className="actions">
              <button className="btn btn-primary" type="button" disabled={!prepared || busy} onClick={generate}>
                {busy
                  ? <><Spinner light /> {progress ? `Generando ${progress.done}/${progress.total}…` : 'Generando…'}</>
                  : 'Descargar'}
              </button>
            </div>

            {dbReady && (
              <div className="row" style={{ marginTop: 18, borderTop: '1px solid var(--panel-glass-brd)', paddingTop: 16 }}>
                <div className="grow">
                  <label className="muted">¿Lo vas a repetir? Guárdalo como configuración</label>
                  <input className="input" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre de la configuración" />
                </div>
                <button className="btn btn-ghost" type="button" disabled={saving || !prepared} onClick={saveAsConfig}>
                  {saving ? <><Spinner /> Guardando…</> : 'Guardar configuración'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
