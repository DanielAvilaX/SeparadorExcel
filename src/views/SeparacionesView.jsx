import { useEffect, useState } from 'react'
import Uploader from '../components/Uploader'
import Spinner from '../components/Spinner'
import SplitDesigner, { suggestDefinition } from '../components/SplitDesigner'
import RunPreview, { usePrepared } from '../components/RunPreview'
import { toast } from '../lib/toast'
import { confirmDialog } from '../lib/confirm'
import { analyzeWorkbook } from '../lib/splitter/workbook'
import { buildFiles, validateDefinition } from '../lib/splitter/engine'
import { emptyDefinition, getBuiltin } from '../lib/splitter/builtins'
import { downloadFiles } from '../lib/excel'
import { createConfig, saveConfig, listVersions, restoreVersion, restoreOriginal, deleteConfig } from '../lib/configs'

const NEW_KEY = '__nueva__'
const clone = (o) => JSON.parse(JSON.stringify(o))
const fmtDate = (s) => (s ? new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function draftFrom(cfg) {
  return { nombre: cfg.label, descripcion: cfg.description || '', icono: cfg.icon || '', definition: clone(cfg.definition) }
}

export default function SeparacionesView({ configs, dbReady, onConfigsChanged }) {
  const [selKey, setSelKey] = useState(configs[0]?.key || null)
  const [draft, setDraft] = useState(configs[0] ? draftFrom(configs[0]) : null)
  const [dirty, setDirty] = useState(false)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [sample, setSample] = useState({ wb: null, file: null, analysis: null })
  const [downloading, setDownloading] = useState(false)

  const cfg = configs.find((c) => c.key === selKey) || null
  const isNew = selKey === NEW_KEY
  const { prepared, error } = usePrepared(sample.wb, draft?.definition)

  async function loadVersions(c) {
    if (!c || !dbReady) { setVersions([]); return }
    setLoadingVersions(true)
    try { setVersions(await listVersions(c)) } catch (e) { console.error(e); toast.error('No se pudo cargar el historial: ' + e.message) }
    finally { setLoadingVersions(false) }
  }

  useEffect(() => { loadVersions(cfg) }, [cfg?.configId, cfg?.versionId, dbReady])

  async function confirmDiscard() {
    if (!dirty) return true
    return confirmDialog({
      title: 'Cambios sin guardar',
      message: 'Tienes cambios sin guardar en esta configuración. Si sigues, se pierden.',
      confirmText: 'Descartar cambios', danger: true,
    })
  }

  async function select(c) {
    if (c.key === selKey) return
    if (!(await confirmDiscard())) return
    setSelKey(c.key); setDraft(draftFrom(c)); setDirty(false); setNota('')
  }

  async function nueva() {
    if (!(await confirmDiscard())) return
    setSelKey(NEW_KEY)
    setDraft({ nombre: '', descripcion: '', icono: '', definition: sample.analysis ? suggestDefinition(sample.analysis) : emptyDefinition() })
    setDirty(false); setNota(''); setVersions([])
  }

  function edit(patch) { setDraft((d) => ({ ...d, ...patch })); setDirty(true) }

  function onSample(wb, file) {
    const analysis = analyzeWorkbook(wb, { splitColumn: draft?.definition?.split?.column || null })
    setSample({ wb, file, analysis })
    // Configuración nueva todavía vacía: se propone una a partir del ejemplo.
    if (isNew && !(draft?.definition?.sheets || []).length) edit({ definition: suggestDefinition(analysis) })
  }

  async function save() {
    if (!draft.nombre.trim()) return toast.error('Ponle un nombre a la configuración.')
    const errors = validateDefinition(draft.definition)
    if (errors.length) return toast.error(errors[0])
    setSaving(true)
    try {
      let key = selKey
      if (isNew) key = await createConfig({ ...draft, nota })
      else await saveConfig(cfg, { ...draft, nota })
      const fresh = await onConfigsChanged()
      const saved = fresh.find((c) => c.key === key)
      setSelKey(key)
      if (saved) setDraft(draftFrom(saved))
      setDirty(false); setNota('')
      toast.success(isNew ? 'Configuración creada.' : 'Nueva versión guardada.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo guardar: ' + (e.message?.includes('duplicate') ? 'ya existe una configuración con ese nombre.' : e.message))
    } finally { setSaving(false) }
  }

  async function afterHistoryChange(message) {
    const fresh = await onConfigsChanged()
    const c = fresh.find((x) => x.key === selKey)
    if (c) setDraft(draftFrom(c))
    setDirty(false)
    toast.success(message)
  }

  async function restore(v) {
    if (!(await confirmDiscard())) return
    const ok = await confirmDialog({
      title: `Restaurar la versión ${v.version}`,
      message: 'Se crea una versión nueva igual a esa. La versión actual queda en el historial por si la necesitas.',
      confirmText: 'Restaurar',
    })
    if (!ok) return
    try { await restoreVersion(cfg, v); await afterHistoryChange(`Versión ${v.version} restaurada.`) }
    catch (e) { console.error(e); toast.error('No se pudo restaurar: ' + e.message) }
  }

  async function resetOriginal() {
    if (!(await confirmDiscard())) return
    const ok = await confirmDialog({
      title: 'Restablecer la versión original',
      message: `"${cfg.label}" vuelve a funcionar como venía de fábrica. Tus versiones anteriores quedan en el historial.`,
      confirmText: 'Restablecer',
    })
    if (!ok) return
    try { await restoreOriginal(cfg); await afterHistoryChange('Configuración restablecida a la original.') }
    catch (e) { console.error(e); toast.error('No se pudo restablecer: ' + e.message) }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'Eliminar configuración',
      message: `¿Eliminar "${cfg.label}" con todo su historial? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar', danger: true,
    })
    if (!ok) return
    try {
      await deleteConfig(cfg)
      const fresh = await onConfigsChanged()
      setSelKey(fresh[0]?.key || null); setDraft(fresh[0] ? draftFrom(fresh[0]) : null); setDirty(false)
      toast.success('Configuración eliminada.')
    } catch (e) { console.error(e); toast.error('No se pudo eliminar: ' + e.message) }
  }

  async function downloadSample() {
    if (!prepared) return
    setDownloading(true)
    try {
      const first = prepared.groupKeys[0]
      const files = await buildFiles(prepared, { onlyGroups: first ? [first] : null, baseName: draft.nombre || 'ejemplo' })
      await downloadFiles(files, 'ejemplo.zip')
    } catch (e) { console.error(e); toast.error('No se pudo generar el ejemplo: ' + e.message) }
    finally { setDownloading(false) }
  }

  const totalUsos = versions.reduce((n, v) => n + (v.usos || 0), 0)
  const builtin = cfg?.builtin && !isNew

  return (
    <>
      <div className="step"><span className="n">⚙</span><h2>Separaciones</h2><span className="sub">· cómo se separa cada tipo de archivo (solo para tu cuenta)</span></div>

      {!dbReady && (
        <div className="banner warn">
          Para crear y editar configuraciones falta ejecutar <b>supabase/migracion-configuraciones.sql</b> en el SQL Editor de
          Supabase. Mientras tanto, PACOM, Rotación y Descuentos siguen funcionando con su versión original.
        </div>
      )}

      <div className="tpl-layout">
        <aside className="glass tpl-list">
          <div className="section-title"><h2>Configuraciones <span className="muted">({configs.length})</span></h2></div>
          <div className="tpl-items">
            {configs.map((c) => (
              <button key={c.key} type="button" className={'tpl-card' + (c.key === selKey ? ' on' : '')} onClick={() => select(c)}>
                <b>{c.icon} · {c.label}{c.key === selKey && dirty ? ' •' : ''}</b>
                <span className="tpl-snip">
                  {c.builtin ? 'De fábrica' : 'Propia'}{c.version ? ` · v${c.version}` : ''}{c.definition.email ? ' · envía correos' : ''}
                </span>
              </button>
            ))}
            {isNew && <button type="button" className="tpl-card on"><b>Nueva configuración{dirty ? ' •' : ''}</b></button>}
          </div>
          <button className="btn btn-ghost" type="button" onClick={nueva} disabled={!dbReady} style={{ width: '100%', marginTop: 12 }}>
            + Nueva configuración
          </button>
        </aside>

        <section className="tpl-editor">
          {draft && (
            <>
              <div className="glass" style={{ marginBottom: 16 }}>
                <div className="section-title">
                  <h2>{isNew ? 'Nueva configuración' : 'Editar'} {dirty && <span className="badge off">sin guardar</span>}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {builtin && dbReady && <button className="mini edit" type="button" onClick={resetOriginal}>Restablecer original</button>}
                    {!builtin && !isNew && dbReady && <button className="mini del" type="button" onClick={remove}>Eliminar</button>}
                  </div>
                </div>
                <div className="row">
                  <div className="grow">
                    <label className="muted">Nombre</label>
                    <input className="input" value={draft.nombre} onChange={(e) => edit({ nombre: e.target.value })} placeholder="Ej: Inventario por bodega" />
                  </div>
                  <div style={{ width: 90 }}>
                    <label className="muted">Ícono</label>
                    <input className="input" maxLength={2} value={draft.icono} onChange={(e) => edit({ icono: e.target.value.toUpperCase() })} placeholder="I" />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Descripción (se ve al elegir el tipo de archivo)</label>
                  <input className="input" value={draft.descripcion} onChange={(e) => edit({ descripcion: e.target.value })} placeholder="Qué archivo es y cómo se separa" />
                </div>
              </div>

              <div className="glass" style={{ marginBottom: 16 }}>
                <div className="glass-head"><h2>Excel de ejemplo</h2><span className="muted">para elegir hojas y columnas y ver el resultado</span></div>
                <Uploader file={sample.file} onLoaded={onSample} onClear={() => setSample({ wb: null, file: null, analysis: null })} hint="No se guarda: solo se usa para armar y probar la configuración" />
              </div>

              <SplitDesigner definition={draft.definition} onChange={(d) => edit({ definition: d })} analysis={sample.analysis} allowEmail />

              {sample.wb && (
                <>
                  <div className="step"><span className="n">4</span><h2>Así quedaría con el ejemplo</h2></div>
                  <div className="glass">
                    <RunPreview prepared={prepared} error={error} />
                    <div className="actions" style={{ marginTop: 10 }}>
                      <button className="btn btn-ghost" type="button" disabled={!prepared || downloading} onClick={downloadSample}>
                        {downloading ? <><Spinner /> Generando…</> : 'Descargar ejemplo (primer grupo)'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="glass" style={{ marginTop: 16 }}>
                <div className="row">
                  <div className="grow">
                    <label className="muted">Nota de esta versión (opcional)</label>
                    <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: agregué la columna de descuento" />
                  </div>
                  <button className="btn btn-primary" type="button" disabled={saving || !dbReady || (!dirty && !isNew)} onClick={save}>
                    {saving ? <><Spinner light /> Guardando…</> : isNew ? 'Crear configuración' : 'Guardar nueva versión'}
                  </button>
                </div>
              </div>

              {!isNew && cfg && (
                <div className="glass" style={{ marginTop: 16 }}>
                  <div className="section-title">
                    <h2>Historial de versiones</h2>
                    {versions.length > 0 && <span className="muted">usada {totalUsos} {totalUsos === 1 ? 'vez' : 'veces'} en total</span>}
                  </div>
                  {loadingVersions ? (
                    <div className="loader-row"><Spinner /> Cargando…</div>
                  ) : versions.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {builtin ? 'Sin cambios: usa la versión original de fábrica. El historial empieza cuando la edites o la uses.' : 'Sin versiones.'}
                    </p>
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead><tr><th>Versión</th><th>Fecha</th><th>Nota</th><th>Usos</th><th>Último uso</th><th></th></tr></thead>
                        <tbody>
                          {versions.map((v) => (
                            <tr key={v.id}>
                              <td><b>v{v.version}</b>{v.id === cfg.versionId && <span className="badge on" style={{ marginLeft: 8 }}>actual</span>}</td>
                              <td>{fmtDate(v.created_at)}</td>
                              <td>{v.nota || <span className="muted">—</span>}</td>
                              <td>{v.usos}</td>
                              <td>{fmtDate(v.ultimo_uso)}</td>
                              <td style={{ textAlign: 'right' }}>
                                {v.id !== cfg.versionId && <button className="mini edit" type="button" onClick={() => restore(v)}>Restaurar</button>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {builtin && getBuiltin(cfg.key) && versions.length > 0 && (
                    <p className="hint">La versión 1 es la original de fábrica.</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
