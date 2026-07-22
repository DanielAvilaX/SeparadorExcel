import { supabase } from './supabase'
import * as XLSX from 'xlsx'

// -------- Utilidades --------

// "a@x.com; b@y.com , c@z.com" -> ["a@x.com","b@y.com","c@z.com"]
export function parseEmails(str) {
  if (!str) return []
  return [...new Set(
    String(str)
      .split(/[;,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  )]
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// -------- Proveedores --------

export async function listProviders() {
  const { data, error } = await supabase.from('providers').select('*').order('nombre')
  if (error) throw error
  return data
}

export async function addProvider({ nombre, emails, activo = true }) {
  const { data, error } = await supabase
    .from('providers')
    .insert({ nombre: nombre.trim(), emails, activo }) // por defecto participa en los 3 tipos
    .select()
    .single()
  if (error) throw error
  return data
}

// Actualiza el flag de un tipo (envia_pacom / envia_rotacion / envia_descuentos)
export async function setTypeFlag(id, flag, value) {
  const { error } = await supabase.from('providers').update({ [flag]: value }).eq('id', id)
  if (error) throw error
}

// Marca/desmarca el flag de un tipo para varios proveedores a la vez
export async function setTypeFlagMany(ids, flag, value) {
  if (!ids.length) return
  const { error } = await supabase.from('providers').update({ [flag]: value }).in('id', ids)
  if (error) throw error
}

// Actualiza un campo (ej. cc_pacom) para varios proveedores a la vez
export async function setFieldMany(ids, field, value) {
  if (!ids.length) return
  const { error } = await supabase.from('providers').update({ [field]: value }).in('id', ids)
  if (error) throw error
}

export async function updateProvider(id, patch) {
  const { error } = await supabase.from('providers').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProvider(id) {
  const { error } = await supabase.from('providers').delete().eq('id', id)
  if (error) throw error
}

// Elimina TODOS los proveedores. El filtro (id no nulo) hace match con todas las filas.
export async function deleteAllProviders() {
  const { error } = await supabase.from('providers').delete().not('id', 'is', null)
  if (error) throw error
}

// Carga masiva: upsert por nombre (coincidencia exacta).
export async function bulkUpsertProviders(rows) {
  const { error } = await supabase
    .from('providers')
    .upsert(rows, { onConflict: 'nombre' })
  if (error) throw error
}

// Lee un Excel de carga masiva. Detecta columnas de nombre y correo(s) de forma flexible.
export async function parseProvidersFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (!rows.length) return []

  const headers = Object.keys(rows[0])
  const norm = (s) => s.toString().toUpperCase()
  const nameKey = headers.find((h) => norm(h).includes('NOMBRE') || norm(h).includes('PROVEEDOR')) || headers[0]
  const mailKey = headers.find((h) => norm(h).includes('CORREO') || norm(h).includes('EMAIL') || norm(h).includes('MAIL')) || headers[1]

  const out = []
  for (const r of rows) {
    const nombre = (r[nameKey] || '').toString().trim()
    if (!nombre) continue
    const emails = parseEmails(r[mailKey])
    out.push({ nombre, emails })
  }
  return out
}

// -------- CC global --------

export async function listCc() {
  const { data, error } = await supabase.from('cc_global').select('*').order('email')
  if (error) throw error
  return data
}

export async function addCc(email) {
  const { error } = await supabase.from('cc_global').insert({ email: email.trim() })
  if (error) throw error
}

export async function deleteCc(id) {
  const { error } = await supabase.from('cc_global').delete().eq('id', id)
  if (error) throw error
}
