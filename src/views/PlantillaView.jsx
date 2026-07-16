import { useEffect, useRef, useState } from 'react'
import Spinner from '../components/Spinner'
import RichBody from '../components/RichBody'
import { toast } from '../lib/toast'
import { confirmDialog } from '../lib/confirm'
import { isConfigured } from '../lib/supabase'
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  VARS, render, bodyToHtml,
} from '../lib/template'

export default function PlantillaView() {
  const [items, setItems] = useState([])
  const [selId, setSelId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [dirty, setDirty] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [target, setTarget] = useState('cuerpo')
  const bodyRef = useRef(null)
  const asuntoRef = useRef(null)

  function loadInto(t) {
    setSelId(t.id)
    setNombre(t.nombre || '')
    setAsunto(t.asunto || '')
    setCuerpo(bodyToHtml(t.cuerpo || '')) // migra plantillas viejas de texto plano
    setDirty(false)
  }

  async function load(keepId) {
    setLoading(true); setError('')
    try {
      const rows = await listTemplates()
      setItems(rows)
      const pick = rows.find((r) => r.id === keepId) || rows[0]
      if (pick) loadInto(pick)
      else { setSelId(null); setNombre(''); setAsunto(''); setCuerpo('') }
    } catch (e) {
      console.error(e); setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { if (isConfigured()) load(); else setLoading(false) }, [])

  async function selectTemplate(t) {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Cambios sin guardar',
        message: `Tienes cambios sin guardar en "${nombre}". Si cambias de plantilla se perderán.`,
        confirmText: 'Descartar y cambiar', danger: true,
      })
      if (!ok) return
    }
    loadInto(t)
  }

  async function save() {
    if (!nombre.trim()) return toast.error('Ponle un nombre a la plantilla.')
    setSaving(true)
    try {
      await updateTemplate(selId, { nombre, asunto, cuerpo })
      toast.success('Plantilla guardada.')
      setDirty(false)
      await load(selId)
    } catch (e) { console.error(e); toast.error('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  async function nueva() {
    try {
      const t = await createTemplate({ nombre: `Plantilla ${items.length + 1}` })
      toast.success('Plantilla creada.')
      await load(t.id)
    } catch (e) { console.error(e); toast.error(e.message) }
  }

  async function duplicar() {
    try {
      const t = await createTemplate({ nombre: `${nombre} (copia)`, asunto, cuerpo })
      toast.success('Plantilla duplicada.')
      await load(t.id)
    } catch (e) { console.error(e); toast.error(e.message) }
  }

  async function eliminar() {
    if (items.length <= 1) return toast.error('Debe quedar al menos una plantilla.')
    const ok = await confirmDialog({
      title: 'Eliminar plantilla',
      message: `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar', danger: true,
    })
    if (!ok) return
    try { await deleteTemplate(selId); toast.success('Plantilla eliminada.'); await load() }
    catch (e) { console.error(e); toast.error(e.message) }
  }

  function insertVar(token) {
    if (target === 'asunto') {
      const inp = asuntoRef.current
      const start = inp?.selectionStart ?? asunto.length
      const end = inp?.selectionEnd ?? asunto.length
      setAsunto(asunto.slice(0, start) + token + asunto.slice(end))
      setDirty(true)
      requestAnimationFrame(() => {
        if (!inp) return
        inp.focus()
        inp.selectionStart = inp.selectionEnd = start + token.length
      })
    } else if (bodyRef.current) {
      bodyRef.current.insertText(token)
    }
  }

  const sampleValues = { proveedor: 'BEIERSDORF SA', correos: 'compras@beiersdorf.com', mes: 'agosto' }

  if (!isConfigured()) {
    return <div className="glass"><div className="banner warn">Falta configurar Supabase.</div></div>
  }

  return (
    <>
      <div className="step"><span className="n">✉</span><h2>Plantillas del correo</h2><span className="sub">· al enviar eliges cuál usar</span></div>

      {error && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="banner bad">
            No se pudieron cargar las plantillas. Si es la primera vez, ejecuta
            <b> supabase/migracion-plantillas.sql</b> en el SQL Editor de Supabase.
            <br /><span className="muted">Detalle: {error}</span>
          </div>
        </div>
      )}

      {/* Selector de plantillas */}
      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h2>Mis plantillas <span className="muted">({items.length})</span></h2>
          <button className="toggle" type="button" onClick={nueva}>+ Nueva plantilla</button>
        </div>
        {loading ? <div className="loader-row"><Spinner /> Cargando…</div> : (
          <div className="chips" style={{ maxHeight: 'none' }}>
            {items.map((t) => (
              <button key={t.id} type="button"
                className={'chip ' + (t.id === selId ? 'g' : 'w')}
                onClick={() => selectTemplate(t)}>
                {t.id === selId ? '● ' : ''}{t.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      {!loading && selId && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="section-title">
            <h2>Editar plantilla {dirty && <span className="badge off">sin guardar</span>}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="mini edit" type="button" onClick={duplicar}>Duplicar</button>
              <button className="mini del" type="button" onClick={eliminar}>Eliminar</button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Nombre de la plantilla</label>
            <input className="input" value={nombre}
              onChange={(e) => { setNombre(e.target.value); setDirty(true) }}
              placeholder="Ej: PACOM mensual" />
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Asunto</label>
            <input ref={asuntoRef} className="input" value={asunto}
              onChange={(e) => { setAsunto(e.target.value); setDirty(true) }}
              onFocus={() => setTarget('asunto')}
              placeholder="Ej: Participación {{mes}} — {{proveedor}}" />
          </div>

          <div className="field">
            <label>Cuerpo</label>
            <RichBody
              key={selId}
              ref={bodyRef}
              value={cuerpo}
              onChange={(html) => { setCuerpo(html); setDirty(true) }}
              onFocus={() => setTarget('cuerpo')}
              placeholder="Escribe el mensaje. Puedes dar formato, pegar imágenes (Ctrl+V) e insertar variables."
            />
          </div>

          <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Insertar variable en <b>{target === 'asunto' ? 'el asunto' : 'el cuerpo'}</b>:</span>
            {VARS.map((v) => (
              <button key={v.token} type="button" className="chip g" title={v.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVar(v.token)}>
                {v.token}
              </button>
            ))}
          </div>

          <div className="actions">
            <button className="btn btn-primary" disabled={saving} onClick={save}>
              {saving ? <><Spinner light /> Guardando…</> : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      )}

      {/* Vista previa */}
      {!loading && selId && (
        <div className="glass">
          <div className="section-title"><h2>Vista previa</h2><span className="muted">con datos de ejemplo</span></div>
          <div className="inset" style={{ marginBottom: 12 }}>
            <b style={{ marginRight: 8 }}>Asunto:</b> {render(asunto, sampleValues) || <span className="muted">— vacío —</span>}
          </div>
          {cuerpo
            ? <div className="preview-body" dangerouslySetInnerHTML={{ __html: render(cuerpo, sampleValues) }} />
            : <div className="inset" style={{ display: 'block', minHeight: 80 }}><span className="muted">— vacío —</span></div>}
        </div>
      )}
    </>
  )
}
