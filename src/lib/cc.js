import { supabase } from './supabase'

// Clave normalizada del conjunto de correos (sin orden ni mayúsculas)
function setKey(emails) {
  return [...new Set((emails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))].sort().join('|')
}

// Devuelve la configuración existente con el MISMO conjunto de correos (o null)
export function findDuplicateConfig(configs, emails, excludeId = null) {
  const key = setKey(emails)
  if (!key) return null
  return configs.find((c) => c.id !== excludeId && setKey(c.emails) === key) || null
}

export async function listCcConfigs() {
  const { data, error } = await supabase
    .from('cc_configs')
    .select('*')
    .order('es_general', { ascending: false })
    .order('nombre')
  if (error) throw error
  return data
}

export async function createCcConfig({ nombre, emails }) {
  const { data, error } = await supabase
    .from('cc_configs')
    .insert({ nombre: nombre.trim(), emails })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCcConfig(id, { nombre, emails }) {
  const { error } = await supabase.from('cc_configs').update({ nombre: nombre.trim(), emails }).eq('id', id)
  if (error) throw error
}

export async function deleteCcConfig(id) {
  const { error } = await supabase.from('cc_configs').delete().eq('id', id)
  if (error) throw error
}

// Cuántos proveedores usan esta configuración como excepción (en cualquier tipo)
export async function countConfigUsage(id) {
  const { count, error } = await supabase
    .from('providers')
    .select('id', { count: 'exact', head: true })
    .or(`cc_pacom.eq.${id},cc_rotacion.eq.${id},cc_descuentos.eq.${id}`)
  if (error) throw error
  // También las excepciones de las configuraciones nuevas (si la migración ya existe).
  const res = await supabase
    .from('provider_config_settings')
    .select('provider_id', { count: 'exact', head: true })
    .eq('cc_config_id', id)
  return (count || 0) + (res.error ? 0 : res.count || 0)
}

// Defaults por tipo: { PACOM: id|null, ROTACION: id|null, DESCUENTOS: id|null }
export async function getCcDefaults() {
  const { data, error } = await supabase.from('cc_defaults').select('*')
  if (error) throw error
  const out = {}
  for (const r of data) out[r.tipo] = r.cc_config_id
  return out
}

export async function setCcDefault(tipo, ccConfigId) {
  const { error } = await supabase.from('cc_defaults').upsert({ tipo, cc_config_id: ccConfigId })
  if (error) throw error
}

// Cascada: excepción del proveedor para la configuración → default de la configuración → General.
// `overrideId`: la CC propia del proveedor (ver ccOf en participation.js). Devuelve la
// configuración de CC (objeto) o null si no hay ninguna.
export function resolveCc(overrideId, typeKey, configs, defaults) {
  const byId = new Map(configs.map((c) => [c.id, c]))
  if (overrideId && byId.has(overrideId)) return byId.get(overrideId)
  const defId = defaults && typeKey ? defaults[typeKey] : null
  if (defId && byId.has(defId)) return byId.get(defId)
  return configs.find((c) => c.es_general) || null
}
