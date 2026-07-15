import { useEffect, useRef, useState } from 'react'
import Spinner from '../components/Spinner'
import RichBody from '../components/RichBody'
import { toast } from '../lib/toast'
import { isConfigured } from '../lib/supabase'
import { getTemplate, saveTemplate, VARS, render, bodyToHtml } from '../lib/template'

export default function PlantillaView() {
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return }
    getTemplate()
      .then((t) => {
        setAsunto(t.asunto || '')
        // Las plantillas viejas (texto plano) se migran a HTML al cargarlas
        setCuerpo(bodyToHtml(t.cuerpo || ''))
      })
      .catch((e) => { console.error(e); setError(e.message) })
      .finally(() => setLoading(false))
  }, [])

  function insertVar(token) {
    if (bodyRef.current) bodyRef.current.insertText(token)
  }

  async function save() {
    setSaving(true)
    try {
      await saveTemplate({ asunto, cuerpo })
      toast.success('Plantilla guardada.')
    } catch (e) { console.error(e); toast.error('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  const sampleValues = { proveedor: 'BEIERSDORF SA', correos: 'compras@beiersdorf.com', mes: 'agosto' }

  if (!isConfigured()) {
    return <div className="glass"><div className="banner warn">Falta configurar Supabase.</div></div>
  }

  return (
    <>
      <div className="step"><span className="n">✉</span><h2>Plantilla del correo</h2><span className="sub">· se usa para cada envío</span></div>

      <div className="glass" style={{ marginBottom: 16 }}>
        {error && <div className="banner bad">No se pudo cargar la plantilla. {error}</div>}
        {loading ? <div className="loader-row"><Spinner /> Cargando plantilla…</div> : (
          <>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Asunto</label>
              <input className="input" value={asunto} onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: Participación {{mes}} — {{proveedor}}" />
            </div>

            <div className="field">
              <label>Cuerpo</label>
              <RichBody
                ref={bodyRef}
                value={cuerpo}
                onChange={setCuerpo}
                placeholder="Escribe el mensaje. Puedes pegar imágenes (Ctrl+V) e insertar variables como {{proveedor}}."
              />
            </div>

            <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Insertar variable:</span>
              {VARS.map((v) => (
                <button key={v.token} type="button" className="chip g" title={v.label} onClick={() => insertVar(v.token)}>
                  {v.token}
                </button>
              ))}
            </div>

            <div className="actions">
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? <><Spinner light /> Guardando…</> : 'Guardar plantilla'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Vista previa */}
      <div className="glass">
        <div className="section-title"><h2>Vista previa</h2><span className="muted">con datos de ejemplo</span></div>
        <div className="inset" style={{ marginBottom: 12 }}>
          <b style={{ marginRight: 8 }}>Asunto:</b> {render(asunto, sampleValues) || <span className="muted">— vacío —</span>}
        </div>
        {cuerpo
          ? <div className="preview-body" dangerouslySetInnerHTML={{ __html: render(cuerpo, sampleValues) }} />
          : <div className="inset" style={{ display: 'block', minHeight: 80 }}><span className="muted">— vacío —</span></div>}
      </div>
    </>
  )
}
