import { useEffect, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import Spinner from '../components/Spinner'
import { toast } from '../lib/toast'
import { isConfigured } from '../lib/supabase'
import {
  listProviders, addProvider, updateProvider, deleteProvider,
  bulkUpsertProviders, parseProvidersFile, parseEmails, isEmail,
} from '../lib/providers'
import { downloadBlob } from '../lib/excel'

export default function ProveedoresView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [emailsStr, setEmailsStr] = useState('')
  const [activo, setActivo] = useState(true)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try { setRows(await listProviders()) }
    catch (e) { console.error(e); setError(e.message || 'No se pudo cargar la lista.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isConfigured()) load(); else setLoading(false) }, [])

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
      resetForm()
      await load()
    } catch (e) {
      console.error(e)
      toast.error(e.message?.includes('duplicate') ? 'Ya existe un proveedor con ese nombre.' : (e.message || 'Error al guardar.'))
    } finally { setSaving(false) }
  }

  async function remove(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    try { await deleteProvider(p.id); toast.success('Proveedor eliminado.'); await load() }
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
    } catch (e) {
      console.error(e); toast.error('Error al importar: ' + (e.message || ''))
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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

  if (!isConfigured()) {
    return (
      <div className="glass">
        <div className="banner warn">
          Falta configurar Supabase. Agrega <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en <b>.env.local</b> y reinicia <code>npm run dev</code>.
        </div>
      </div>
    )
  }

  const filtered = rows.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <div className="step"><span className="n">P</span><h2>Proveedores</h2><span className="sub">· globales para los 3 tipos</span></div>

      {error && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="banner bad">
            No se pudo leer la tabla de proveedores. Si es la primera vez, ejecuta <b>supabase/schema.sql</b> en el
            SQL Editor de Supabase.<br /><span className="muted">Detalle: {error}</span>
          </div>
        </div>
      )}

      {/* Formulario add / edit */}
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

      {/* Carga masiva */}
      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h2>Carga masiva por Excel</h2>
          <button className="toggle" type="button" onClick={downloadTemplate}>Descargar plantilla</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Columnas: <b>NOMBRE DEL PROVEEDOR</b> y <b>CORREO(S)</b> (varios separados por <b>;</b>). Los nombres que ya
          existan se actualizan; los nuevos se agregan.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => onImportFile(e.target.files[0])} />
        <button className="btn btn-ghost" type="button" disabled={importing} onClick={() => fileRef.current.click()}>
          {importing ? <><Spinner /> Importando…</> : 'Subir Excel de proveedores'}
        </button>
      </div>

      {/* Lista */}
      <div className="glass">
        <div className="section-title">
          <h2>Lista de proveedores <span className="muted">({rows.length})</span></h2>
          <input className="input" style={{ maxWidth: 260 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" />
        </div>

        {loading ? (
          <div className="loader-row"><Spinner /> Cargando proveedores…</div>
        ) : filtered.length === 0 ? (
          <p className="muted">{rows.length === 0 ? 'Aún no hay proveedores. Agrega uno o sube el Excel.' : 'Sin resultados para la búsqueda.'}</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Nombre</th><th>Correo(s)</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b></td>
                    <td>
                      {(p.emails || []).length
                        ? p.emails.map((e) => <span key={e} className="email-chip">{e}</span>)
                        : <span className="muted">— sin correo —</span>}
                    </td>
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
