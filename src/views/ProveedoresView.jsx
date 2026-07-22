import { useEffect, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import Spinner from '../components/Spinner'
import { toast } from '../lib/toast'
import { confirmDialog } from '../lib/confirm'
import { isConfigured } from '../lib/supabase'
import { FILE_TYPES } from '../lib/fileTypes'
import {
  listProviders, addProvider, updateProvider, deleteProvider, deleteAllProviders,
  bulkUpsertProviders, parseProvidersFile, parseEmails, isEmail,
  setTypeFlag, setTypeFlagMany, setFieldMany,
} from '../lib/providers'
import { listCcConfigs, getCcDefaults } from '../lib/cc'
import { downloadBlob } from '../lib/excel'

const TYPES = FILE_TYPES.filter((t) => t.enabled && t.flag)

export default function ProveedoresView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('todos') // 'todos' | tipo.key

  // formulario add/edit (solo en "Todos")
  const [editingId, setEditingId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [emailsStr, setEmailsStr] = useState('')
  const [activo, setActivo] = useState(true)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const [ccConfigs, setCcConfigs] = useState([])
  const [ccDefaults, setCcDefaults] = useState({})

  async function load() {
    setLoading(true); setError('')
    try { setRows(await listProviders()) }
    catch (e) { console.error(e); setError(e.message || 'No se pudo cargar la lista.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return }
    load()
    // Configuraciones de CC (para el selector en las pestañas por tipo)
    listCcConfigs().then(setCcConfigs).catch((e) => console.error('CC configs:', e.message))
    getCcDefaults().then(setCcDefaults).catch((e) => console.error('CC defaults:', e.message))
  }, [])

  function resetForm() { setEditingId(null); setNombre(''); setEmailsStr(''); setActivo(true) }
  function startEdit(p) {
    setEditingId(p.id); setNombre(p.nombre); setEmailsStr((p.emails || []).join('; ')); setActivo(p.activo)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    const nom = nombre.trim()
    if (!nom) return toast.error('Escribe el nombre del proveedor.')
    const emails = parseEmails(emailsStr)
    const bad = emails.filter((e) => !isEmail(e))
    if (bad.length) return toast.error('Correo no válido: ' + bad[0])
    setSaving(true)
    try {
      if (editingId) { await updateProvider(editingId, { nombre: nom, emails, activo }); toast.success('Proveedor actualizado.') }
      else { await addProvider({ nombre: nom, emails, activo }); toast.success('Proveedor agregado.') }
      resetForm(); await load()
    } catch (e) {
      console.error(e)
      toast.error(e.message?.includes('duplicate') ? 'Ya existe un proveedor con ese nombre.' : (e.message || 'Error al guardar.'))
    } finally { setSaving(false) }
  }

  async function remove(p) {
    const ok = await confirmDialog({
      title: 'Eliminar proveedor',
      message: `¿Seguro que quieres eliminar "${p.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar', danger: true,
    })
    if (!ok) return
    try { await deleteProvider(p.id); toast.success('Proveedor eliminado.'); await load() }
    catch (e) { console.error(e); toast.error(e.message || 'Error al eliminar.') }
  }

  async function removeAll() {
    if (rows.length === 0) return
    const ok = await confirmDialog({
      title: 'Eliminar TODOS los proveedores',
      message: `Vas a eliminar los ${rows.length} proveedores de la base. Esta acción no se puede deshacer.`,
      requireText: 'si quiero eliminar todos los proveedores',
      confirmText: 'Eliminar todos', danger: true,
    })
    if (!ok) return
    try { await deleteAllProviders(); toast.success('Todos los proveedores fueron eliminados.'); await load() }
    catch (e) { console.error(e); toast.error(e.message || 'Error al eliminar.') }
  }

  async function onImportFile(file) {
    if (!file) return
    setImporting(true)
    try {
      const parsed = await parseProvidersFile(file)
      if (!parsed.length) { toast.error('El archivo no tiene filas válidas.'); return }
      await bulkUpsertProviders(parsed)
      toast.success(`${parsed.length} proveedores cargados/actualizados.`)
      await load()
    } catch (e) { console.error(e); toast.error('Error al importar: ' + (e.message || '')) }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Proveedores')
    ws.columns = [
      { header: 'NOMBRE DEL PROVEEDOR', key: 'n', width: 48 },
      { header: 'CORREO(S)', key: 'c', width: 48 },
    ]
    ws.addRow({ n: 'BEIERSDORF SA', c: 'compras@beiersdorf.com; ventas@beiersdorf.com' })
    ws.addRow({ n: 'GALDERMA DE COLOMBIA SA', c: 'contacto@galderma.com' })
    ws.getRow(1).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } }
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    })
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(new Blob([buf]), 'plantilla_proveedores.xlsx')
  }

  // ---- Pestañas por tipo ----
  async function toggleFlag(p, flag) {
    const value = !p[flag]
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [flag]: value } : r)))
    try { await setTypeFlag(p.id, flag, value) }
    catch (e) { console.error(e); toast.error('No se pudo guardar el cambio.'); load() }
  }

  async function bulkFlag(flag, value, ids) {
    if (!ids.length) return
    const idset = new Set(ids)
    setRows((rs) => rs.map((r) => (idset.has(r.id) ? { ...r, [flag]: value } : r)))
    try {
      await setTypeFlagMany(ids, flag, value)
      toast.success(value ? 'Marcados.' : 'Quitados.')
    } catch (e) { console.error(e); toast.error('No se pudo guardar.'); load() }
  }

  // CC: excepción por proveedor para el tipo activo ('' = usar el por defecto)
  async function changeCc(p, ccField, value) {
    const id = value || null
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [ccField]: id } : r)))
    try { await updateProvider(p.id, { [ccField]: id }) }
    catch (e) { console.error(e); toast.error('No se pudo guardar la copia.'); load() }
  }

  async function bulkCc(ccField, value, ids) {
    if (!ids.length) return
    const id = value || null
    const idset = new Set(ids)
    setRows((rs) => rs.map((r) => (idset.has(r.id) ? { ...r, [ccField]: id } : r)))
    try { await setFieldMany(ids, ccField, id); toast.success('Copia asignada.') }
    catch (e) { console.error(e); toast.error('No se pudo guardar.'); load() }
  }

  if (!isConfigured()) {
    return (
      <div className="glass">
        <div className="banner warn">
          Falta configurar Supabase. Agrega <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en <b>.env.local</b>.
        </div>
      </div>
    )
  }

  const filtered = rows.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()))
  const activeType = TYPES.find((t) => t.key === tab)

  return (
    <>
      <div className="step"><span className="n">P</span><h2>Proveedores</h2><span className="sub">· globales, con envío por tipo</span></div>

      {error && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="banner bad">
            No se pudo leer la tabla. Ejecuta <b>supabase/schema.sql</b> y
            <b> supabase/migracion-proveedores-por-tipo.sql</b> en Supabase.
            <br /><span className="muted">Detalle: {error}</span>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div className="ptabs">
        <button className={tab === 'todos' ? 'on' : ''} onClick={() => setTab('todos')}>
          Todos <span className="tab-count">{rows.length}</span>
        </button>
        {TYPES.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label} <span className="tab-count on-count">{rows.filter((r) => r[t.flag]).length}</span>
          </button>
        ))}
      </div>

      {/* Panel con animación al cambiar de pestaña */}
      <div className="ptab-panel" key={tab}>
        {tab === 'todos' ? (
          <TodosTab
            rows={rows} filtered={filtered} loading={loading} query={query} setQuery={setQuery}
            editingId={editingId} nombre={nombre} setNombre={setNombre} emailsStr={emailsStr} setEmailsStr={setEmailsStr}
            activo={activo} setActivo={setActivo} saving={saving} save={save} resetForm={resetForm}
            startEdit={startEdit} remove={remove} removeAll={removeAll}
            importing={importing} fileRef={fileRef} onImportFile={onImportFile} downloadTemplate={downloadTemplate}
          />
        ) : (
          <TypeTab
            type={activeType} loading={loading} query={query} setQuery={setQuery}
            filtered={filtered} toggleFlag={toggleFlag} bulkFlag={bulkFlag}
            ccConfigs={ccConfigs} ccDefaults={ccDefaults} changeCc={changeCc} bulkCc={bulkCc}
          />
        )}
      </div>
    </>
  )
}

// ---------- Pestaña "Todos" (gestión completa) ----------
function TodosTab(props) {
  const {
    rows, filtered, loading, query, setQuery, editingId, nombre, setNombre, emailsStr, setEmailsStr,
    activo, setActivo, saving, save, resetForm, startEdit, remove, removeAll,
    importing, fileRef, onImportFile, downloadTemplate,
  } = props

  return (
    <>
      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h2>{editingId ? 'Editar proveedor' : 'Agregar proveedor'}</h2>
          {editingId && <button className="toggle" type="button" onClick={resetForm}>Cancelar edición</button>}
        </div>
        <div className="row">
          <div className="grow">
            <label className="muted">Nombre (debe coincidir EXACTO con el del Excel)</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="BEIERSDORF SA" />
          </div>
          <div className="grow">
            <label className="muted">Correo(s) — separa varios con ;</label>
            <input className="input" value={emailsStr} onChange={(e) => setEmailsStr(e.target.value)} placeholder="compras@x.com; ventas@x.com" />
          </div>
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12 }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo
          </label>
          <button className="btn btn-primary" disabled={saving} onClick={save} style={{ padding: '12px 22px' }}>
            {saving ? <><Spinner light /> Guardando…</> : editingId ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </div>

      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h2>Carga masiva por Excel</h2>
          <button className="toggle" type="button" onClick={downloadTemplate}>Descargar plantilla</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Columnas: <b>NOMBRE DEL PROVEEDOR</b> y <b>CORREO(S)</b> (varios separados por <b>;</b>).
          Los nombres que ya existan se actualizan; los nuevos se agregan.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => onImportFile(e.target.files[0])} />
        <button className="btn btn-ghost" type="button" disabled={importing} onClick={() => fileRef.current.click()}>
          {importing ? <><Spinner /> Importando…</> : 'Subir Excel de proveedores'}
        </button>
      </div>

      <div className="glass">
        <div className="section-title">
          <h2>Lista de proveedores <span className="muted">({rows.length})</span></h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" style={{ maxWidth: 240 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" />
            {rows.length > 0 && <button className="mini del" style={{ padding: '9px 14px' }} onClick={removeAll}>Eliminar todos</button>}
          </div>
        </div>

        {loading ? (
          <div className="loader-row"><Spinner /> Cargando proveedores…</div>
        ) : filtered.length === 0 ? (
          <p className="muted">{rows.length === 0 ? 'Aún no hay proveedores. Agrega uno o sube el Excel.' : 'Sin resultados.'}</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Nombre</th><th>Correo(s)</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b></td>
                    <td>{(p.emails || []).length ? p.emails.map((e) => <span key={e} className="email-chip">{e}</span>) : <span className="muted">— sin correo —</span>}</td>
                    <td><span className={'badge ' + (p.activo ? 'on' : 'off')}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="mini edit" onClick={() => startEdit(p)}>Editar</button>
                      <button className="mini del" onClick={() => remove(p)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ---------- Pestaña de un tipo (incluir / excluir del envío + copia CC) ----------
function TypeTab({ type, loading, query, setQuery, filtered, toggleFlag, bulkFlag, ccConfigs, ccDefaults, changeCc, bulkCc }) {
  const flag = type.flag
  const ccField = type.ccField
  const ids = filtered.map((p) => p.id)
  const incluidos = filtered.filter((p) => p[flag]).length
  const [bulkCcSel, setBulkCcSel] = useState('')

  // Nombre de la copia por defecto para este tipo (default del tipo → General)
  const general = ccConfigs.find((c) => c.es_general)
  const defId = ccDefaults[type.key]
  const defConfig = (defId && ccConfigs.find((c) => c.id === defId)) || general
  const defName = defConfig ? defConfig.nombre : '—'

  return (
    <div className="glass">
      <div className="section-title">
        <h2>
          ¿A quién se le envía <span style={{ color: 'var(--cv-green-deep)' }}>{type.label}</span>?
          <span className="muted"> · {incluidos} incluido{incluidos === 1 ? '' : 's'}</span>
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 220 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" />
          <button className="mini edit" onClick={() => bulkFlag(flag, true, ids)}>Marcar todos</button>
          <button className="mini del" onClick={() => bulkFlag(flag, false, ids)}>Quitar todos</button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
        Enciende el interruptor de los proveedores que reciben <b>{type.label}</b>, y elige su <b>copia (CC)</b> si es
        distinta a la por defecto (<b>{defName}</b>). {query && <>Las acciones en bloque aplican a los <b>{filtered.length}</b> que ves ahora.</>}
      </p>

      {ccConfigs.length > 0 && (
        <div className="row" style={{ marginBottom: 14 }}>
          <select className="input" style={{ maxWidth: 260 }} value={bulkCcSel} onChange={(e) => setBulkCcSel(e.target.value)}>
            <option value="">Por defecto ({defName})</option>
            {ccConfigs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button className="mini edit" onClick={() => bulkCc(ccField, bulkCcSel, ids)}>Asignar esa copia a los visibles</button>
        </div>
      )}

      {loading ? (
        <div className="loader-row"><Spinner /> Cargando…</div>
      ) : filtered.length === 0 ? (
        <p className="muted">Sin proveedores.</p>
      ) : (
        <div className="prov-list">
          {filtered.map((p) => {
            const on = !!p[flag]
            const sinCorreo = !(p.emails || []).length
            return (
              <div key={p.id} className={'prov-row' + (on ? ' on' : '')}>
                <div className="pr-info">
                  <b>{p.nombre}</b>
                  <span className="pr-mail">
                    {sinCorreo ? <span className="muted">— sin correo —</span> : (p.emails || []).join('  ·  ')}
                  </span>
                </div>
                {ccConfigs.length > 0 && (
                  <select
                    className="cc-select"
                    title="Copia (CC) para este tipo"
                    value={p[ccField] || ''}
                    onChange={(e) => changeCc(p, ccField, e.target.value)}
                  >
                    <option value="">CC: por defecto</option>
                    {ccConfigs.map((c) => <option key={c.id} value={c.id}>CC: {c.nombre}</option>)}
                  </select>
                )}
                <button
                  type="button"
                  className={'switch' + (on ? ' on' : '')}
                  role="switch"
                  aria-checked={on}
                  title={on ? 'Incluido — clic para excluir' : 'Excluido — clic para incluir'}
                  onClick={() => toggleFlag(p, flag)}
                >
                  <span className="knob" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
