import { useEffect, useState } from 'react'
import { isConfigured } from '../lib/supabase'
import { listCc, addCc, deleteCc, isEmail } from '../lib/providers'

export default function CcView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try { setRows(await listCc()) }
    catch (e) { console.error(e); setError(e.message || 'No se pudo cargar.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isConfigured()) load(); else setLoading(false) }, [])

  async function add() {
    const e = email.trim()
    if (!isEmail(e)) return alert('Correo no válido.')
    setSaving(true)
    try { await addCc(e); setEmail(''); await load() }
    catch (err) { console.error(err); alert(err.message?.includes('duplicate') ? 'Ese correo ya está en la copia.' : (err.message || 'Error.')) }
    finally { setSaving(false) }
  }

  async function remove(item) {
    if (!confirm(`¿Quitar ${item.email} de la copia?`)) return
    try { await deleteCc(item.id); await load() } catch (e) { console.error(e); alert(e.message) }
  }

  if (!isConfigured()) {
    return (
      <div className="glass">
        <div className="banner warn">Falta configurar Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</div>
      </div>
    )
  }

  return (
    <>
      <div className="step"><span className="n">C</span><h2>Correos en copia (CC)</h2><span className="sub">· los mismos para todos los envíos</span></div>

      <div className="glass">
        <p className="muted" style={{ marginTop: 0 }}>
          Estos correos irán <b>en copia</b> en cada correo enviado a los proveedores. Es una lista global.
        </p>

        {error && <div className="banner bad">No se pudo leer la tabla. ¿Ejecutaste <b>supabase/schema.sql</b>? <br /><span className="muted">{error}</span></div>}

        <div className="row" style={{ marginBottom: 18 }}>
          <div className="grow">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="jefe.comercial@cruzverde.com.co"
              onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={add} style={{ padding: '12px 22px' }}>
            {saving ? 'Agregando…' : 'Agregar a la copia'}
          </button>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Aún no hay correos en copia.</p>
        ) : (
          <div className="chips" style={{ maxHeight: 'none' }}>
            {rows.map((r) => (
              <span key={r.id} className="email-chip" style={{ fontSize: 13, padding: '6px 12px' }}>
                {r.email}{' '}
                <button className="mini del" style={{ padding: '2px 8px', marginLeft: 6 }} onClick={() => remove(r)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
