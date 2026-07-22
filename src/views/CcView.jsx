import { useEffect, useState } from 'react'
import Spinner from '../components/Spinner'
import { toast } from '../lib/toast'
import { confirmDialog } from '../lib/confirm'
import { isConfigured } from '../lib/supabase'
import { FILE_TYPES } from '../lib/fileTypes'
import { parseEmails, isEmail } from '../lib/providers'
import {
  listCcConfigs, createCcConfig, updateCcConfig, deleteCcConfig,
  findDuplicateConfig, countConfigUsage, getCcDefaults, setCcDefault,
} from '../lib/cc'

const TYPES = FILE_TYPES.filter((t) => t.enabled && t.ccField)

export default function CcView() {
  const [configs, setConfigs] = useState([])
  const [defaults, setDefaults] = useState({})
  const [selId, setSelId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [emailsStr, setEmailsStr] = useState('')
  const [dirty, setDirty] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function loadInto(c) {
    setSelId(c.id); setNombre(c.nombre || ''); setEmailsStr((c.emails || []).join('; ')); setDirty(false)
  }

  async function load(keepId) {
    setLoading(true); setError('')
    try {
      const [rows, defs] = await Promise.all([listCcConfigs(), getCcDefaults()])
      setConfigs(rows); setDefaults(defs)
      const pick = rows.find((r) => r.id === keepId) || rows[0]
      if (pick) loadInto(pick)
    } catch (e) { console.error(e); setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isConfigured()) load(); else setLoading(false) }, [])

  const sel = configs.find((c) => c.id === selId)

  async function selectConfig(c) {
    if (c.id === selId) return
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Cambios sin guardar',
        message: `Tienes cambios sin guardar en "${nombre}". Si cambias de configuración se perderán.`,
        confirmText: 'Descartar y cambiar', danger: true,
      })
      if (!ok) return
    }
    loadInto(c)
  }

  async function save() {
    const nom = nombre.trim()
    if (!nom) return toast.error('Ponle un nombre a la configuración.')
    const emails = parseEmails(emailsStr)
    const bad = emails.filter((e) => !isEmail(e))
    if (bad.length) return toast.error('Correo no válido: ' + bad[0])

    // Bloqueo de duplicados: mismo conjunto de correos que otra configuración
    const dup = findDuplicateConfig(configs, emails, selId)
    if (dup) return toast.error(`Ya existe una configuración con esos mismos correos: "${dup.nombre}". Úsala en su lugar.`)

    setSaving(true)
    try {
      await updateCcConfig(selId, { nombre: nom, emails })
      toast.success('Configuración guardada.'); setDirty(false); await load(selId)
    } catch (e) {
      console.error(e)
      toast.error(e.message?.includes('duplicate') ? 'Ya existe una configuración con ese nombre.' : e.message)
    } finally { setSaving(false) }
  }

  async function nueva() {
    try {
      const c = await createCcConfig({ nombre: `Configuración ${configs.length + 1}`, emails: [] })
      toast.success('Configuración creada.'); await load(c.id)
    } catch (e) { console.error(e); toast.error(e.message) }
  }

  async function eliminar() {
    if (!sel || sel.es_general) return
    let uso = 0
    try { uso = await countConfigUsage(selId) } catch { /* noop */ }
    const ok = await confirmDialog({
      title: 'Eliminar configuración',
      message: uso > 0
        ? `"${nombre}" la usan ${uso} proveedor${uso === 1 ? '' : 'es'} como excepción. Si la eliminas, esos proveedores volverán a su copia por defecto.`
        : `¿Eliminar la configuración "${nombre}"?`,
      confirmText: 'Eliminar', danger: true,
    })
    if (!ok) return
    try { await deleteCcConfig(selId); toast.success('Configuración eliminada.'); await load() }
    catch (e) { console.error(e); toast.error(e.message) }
  }

  async function changeDefault(tipo, value) {
    const id = value || null
    setDefaults((d) => ({ ...d, [tipo]: id }))
    try { await setCcDefault(tipo, id); toast.success('Predeterminada actualizada.') }
    catch (e) { console.error(e); toast.error(e.message); load(selId) }
  }

  if (!isConfigured()) {
    return <div className="glass"><div className="banner warn">Falta configurar Supabase.</div></div>
  }

  const general = configs.find((c) => c.es_general)

  return (
    <>
      <div className="step"><span className="n">C</span><h2>Copias (CC)</h2><span className="sub">· configuraciones de correos en copia</span></div>

      {error && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="banner bad">
            No se pudieron cargar las configuraciones. Si es la primera vez, ejecuta
            <b> supabase/migracion-cc-configs.sql</b> en el SQL Editor de Supabase.
            <br /><span className="muted">Detalle: {error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass"><div className="loader-row"><Spinner /> Cargando…</div></div>
      ) : (
        <>
          <div className="tpl-layout">
            {/* Lista lateral */}
            <aside className="glass tpl-list">
              <div className="section-title">
                <h2>Configuraciones <span className="muted">({configs.length})</span></h2>
              </div>
              <div className="tpl-items">
                {configs.map((c) => (
                  <button key={c.id} type="button"
                    className={'tpl-card' + (c.id === selId ? ' on' : '')}
                    onClick={() => selectConfig(c)}>
                    <b>
                      {c.nombre}{c.id === selId && dirty ? ' •' : ''}
                      {c.es_general && <span className="badge on" style={{ marginLeft: 8 }}>base</span>}
                    </b>
                    <span className="tpl-snip">{(c.emails || []).length} correo{(c.emails || []).length === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost" type="button" onClick={nueva} style={{ width: '100%', marginTop: 12 }}>
                + Nueva configuración
              </button>
            </aside>

            {/* Editor */}
            <section className="tpl-editor">
              {sel && (
                <div className="glass" style={{ marginBottom: 16 }}>
                  <div className="section-title">
                    <h2>Editar {dirty && <span className="badge off">sin guardar</span>}</h2>
                    {!sel.es_general && (
                      <button className="mini del" type="button" onClick={eliminar}>Eliminar</button>
                    )}
                  </div>

                  {sel.es_general && (
                    <p className="muted" style={{ marginTop: 0 }}>
                      Esta es la configuración <b>base</b>: se usa cuando un tipo o un proveedor no tiene otra asignada.
                      No se puede eliminar.
                    </p>
                  )}

                  <div className="field" style={{ marginBottom: 16 }}>
                    <label>Nombre de la configuración</label>
                    <input className="input" value={nombre}
                      onChange={(e) => { setNombre(e.target.value); setDirty(true) }}
                      placeholder="Ej: CC PACOM dermo" />
                  </div>

                  <div className="field">
                    <label>Correos en copia — separa varios con ;</label>
                    <input className="input" value={emailsStr}
                      onChange={(e) => { setEmailsStr(e.target.value); setDirty(true) }}
                      placeholder="jefe@cruzverde.com.co; area@cruzverde.com.co" />
                  </div>

                  <div className="actions">
                    <button className="btn btn-primary" disabled={saving} onClick={save}>
                      {saving ? <><Spinner light /> Guardando…</> : 'Guardar configuración'}
                    </button>
                  </div>
                </div>
              )}

              {/* Defaults por tipo */}
              <div className="glass">
                <div className="section-title"><h2>Copia por defecto de cada tipo</h2></div>
                <p className="muted" style={{ marginTop: 0 }}>
                  Es la copia que usa cada tipo de archivo cuando el proveedor no tiene una excepción propia
                  (las excepciones se asignan en <b>Proveedores</b>, dentro de la pestaña de cada tipo).
                </p>
                <div className="fields">
                  {TYPES.map((t) => (
                    <div className="field" key={t.key}>
                      <label>{t.label}</label>
                      <select className="input" value={defaults[t.key] || ''} onChange={(e) => changeDefault(t.key, e.target.value)}>
                        <option value="">{general ? `${general.nombre} (base)` : '— base —'}</option>
                        {configs.filter((c) => !c.es_general).map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  )
}
