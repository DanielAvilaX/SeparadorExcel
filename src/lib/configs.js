import { supabase } from './supabase'
import { BUILTIN_CONFIGS, getBuiltin } from './splitter/builtins'

// Configuraciones de separación del usuario actual = las 3 de fábrica (con los cambios que el
// usuario les haya guardado) + las que él creó. Ver supabase/migracion-configuraciones.sql.

const clone = (o) => JSON.parse(JSON.stringify(o))

// Si la migración todavía no se ejecutó, la app sigue funcionando con las 3 de fábrica.
const isMissingTable = (error) =>
  error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))

function toConfig(row, version) {
  const b = row ? getBuiltin(row.key) : null
  return {
    key: row.key,
    configId: row.id,
    builtin: !!row.builtin,
    label: row.nombre,
    description: row.descripcion || b?.description || '',
    icon: row.icono || b?.icon || row.nombre.slice(0, 1).toUpperCase(),
    builtinFlag: b?.builtinFlag || null,
    builtinCcField: b?.builtinCcField || null,
    definition: version ? version.definition : clone(b.definition),
    versionId: version?.id || null,
    version: version?.version || null,
  }
}

function fromBuiltin(b) {
  return {
    key: b.key, configId: null, builtin: true, label: b.label, description: b.description, icon: b.icon,
    builtinFlag: b.builtinFlag, builtinCcField: b.builtinCcField,
    definition: clone(b.definition), versionId: null, version: null,
  }
}

// Devuelve { configs, dbReady }. dbReady=false: falta ejecutar la migración (solo de fábrica).
export async function loadConfigs() {
  if (!supabase) return { configs: BUILTIN_CONFIGS.map(fromBuiltin), dbReady: false }
  const { data: rows, error } = await supabase.from('split_configs').select('*').order('created_at')
  if (error) {
    if (isMissingTable(error)) return { configs: BUILTIN_CONFIGS.map(fromBuiltin), dbReady: false }
    throw error
  }
  const versionIds = rows.map((r) => r.current_version_id).filter(Boolean)
  let versions = []
  if (versionIds.length) {
    const res = await supabase.from('split_config_versions').select('*').in('id', versionIds)
    if (res.error) throw res.error
    versions = res.data
  }
  const vById = new Map(versions.map((v) => [v.id, v]))
  const byKey = new Map(rows.map((r) => [r.key, r]))

  const configs = BUILTIN_CONFIGS.map((b) => {
    const row = byKey.get(b.key)
    return row ? toConfig(row, vById.get(row.current_version_id)) : fromBuiltin(b)
  })
  for (const row of rows) {
    if (row.builtin) continue
    const v = vById.get(row.current_version_id)
    if (v) configs.push(toConfig(row, v))
  }
  return { configs, dbReady: true }
}

async function insertVersion(configId, definition, nota) {
  const { data: last, error: e1 } = await supabase
    .from('split_config_versions').select('version').eq('config_id', configId)
    .order('version', { ascending: false }).limit(1)
  if (e1) throw e1
  const version = (last[0]?.version || 0) + 1
  const { data, error } = await supabase
    .from('split_config_versions')
    .insert({ config_id: configId, version, definition, nota: nota || '' })
    .select().single()
  if (error) throw error
  const { error: e2 } = await supabase
    .from('split_configs').update({ current_version_id: data.id, updated_at: new Date().toISOString() }).eq('id', configId)
  if (e2) throw e2
  return data
}

// Las de fábrica se guardan en la base recién la primera vez que se editan o usan: se crea la
// fila con la versión 1 = la original del código, para que siempre quede en el historial.
async function ensureRow(cfg) {
  if (cfg.configId) return cfg.configId
  const b = getBuiltin(cfg.key)
  const { data: existing, error: e0 } = await supabase.from('split_configs').select('id, current_version_id').eq('key', cfg.key).maybeSingle()
  if (e0) throw e0
  if (existing) return existing.id
  const { data: row, error } = await supabase
    .from('split_configs')
    .insert({ key: b.key, nombre: b.label, descripcion: b.description, icono: b.icon, builtin: true })
    .select().single()
  if (error) throw error
  await insertVersion(row.id, clone(b.definition), 'Versión original')
  return row.id
}

export async function createConfig({ nombre, descripcion, icono, definition, nota }) {
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('split_configs')
    .insert({ id, key: id, nombre: nombre.trim(), descripcion: descripcion || '', icono: icono || '', builtin: false })
  if (error) throw error
  await insertVersion(id, definition, nota || 'Primera versión')
  return id
}

// Guarda una versión nueva (las anteriores quedan intactas en el historial).
export async function saveConfig(cfg, { nombre, descripcion, icono, definition, nota }) {
  const configId = await ensureRow(cfg)
  const { error } = await supabase
    .from('split_configs')
    .update({ nombre: nombre.trim(), descripcion: descripcion || '', icono: icono || '' })
    .eq('id', configId)
  if (error) throw error
  await insertVersion(configId, definition, nota)
}

export async function listVersions(cfg) {
  if (!cfg.configId) return []
  const { data, error } = await supabase
    .from('split_config_versions').select('*').eq('config_id', cfg.configId)
    .order('version', { ascending: false })
  if (error) throw error
  return data
}

// Restaurar = versión nueva con la definición de la elegida (el historial no se reescribe).
export async function restoreVersion(cfg, version) {
  const configId = await ensureRow(cfg)
  await insertVersion(configId, clone(version.definition), `Restaurada desde la versión ${version.version}`)
}

export async function restoreOriginal(cfg) {
  const b = getBuiltin(cfg.key)
  const configId = await ensureRow(cfg)
  await insertVersion(configId, clone(b.definition), 'Restablecida a la versión original')
}

export async function deleteConfig(cfg) {
  if (cfg.builtin) throw new Error('Las configuraciones de fábrica no se eliminan; puedes restablecerlas a la original.')
  await supabase.from('provider_config_settings').delete().eq('config_key', cfg.key)
  await supabase.from('cc_defaults').delete().eq('tipo', cfg.key)
  // Primero se suelta la referencia a la versión vigente (split_configs <-> versiones se apuntan
  // entre sí) y después se borra; las versiones caen en cascada.
  await supabase.from('split_configs').update({ current_version_id: null }).eq('id', cfg.configId)
  const { error } = await supabase.from('split_configs').delete().eq('id', cfg.configId)
  if (error) throw error
}

// Suma un uso a la versión vigente. Nunca interrumpe el flujo principal si falla.
export async function registerUse(cfg) {
  try {
    if (!supabase) return
    let versionId = cfg.versionId
    if (!versionId) {
      const configId = await ensureRow(cfg)
      const { data } = await supabase.from('split_configs').select('current_version_id').eq('id', configId).single()
      versionId = data?.current_version_id
    }
    if (versionId) await supabase.rpc('registrar_uso_config', { p_version_id: versionId })
  } catch (e) {
    console.error('No se pudo registrar el uso de la configuración:', e.message)
  }
}
