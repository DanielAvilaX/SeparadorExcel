import { supabase } from './supabase'

// ¿El proveedor recibe esta configuración? ¿con qué CC propia? Las 3 de fábrica guardan esto en
// columnas de providers (envia_pacom, cc_pacom...); las nuevas en provider_config_settings.
// `settings` = Map "providerId|configKey" -> fila (ver listSettings).

const settingKey = (providerId, configKey) => `${providerId}|${configKey}`

export async function listSettings() {
  if (!supabase) return new Map()
  const { data, error } = await supabase.from('provider_config_settings').select('*')
  if (error) {
    // Sin la migración no hay configuraciones nuevas, así que tampoco hay nada que leer.
    console.warn('provider_config_settings:', error.message)
    return new Map()
  }
  return new Map(data.map((r) => [settingKey(r.provider_id, r.config_key), r]))
}

export function enviaOf(provider, cfg, settings) {
  if (cfg.builtinFlag) return provider[cfg.builtinFlag] !== false
  const s = settings.get(settingKey(provider.id, cfg.key))
  return s ? s.envia : true
}

export function ccOf(provider, cfg, settings) {
  if (!provider) return null
  if (cfg.builtinCcField) return provider[cfg.builtinCcField] || null
  return settings.get(settingKey(provider.id, cfg.key))?.cc_config_id || null
}

export async function setEnviaMany(ids, cfg, value) {
  if (!ids.length) return
  if (cfg.builtinFlag) {
    const { error } = await supabase.from('providers').update({ [cfg.builtinFlag]: value }).in('id', ids)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('provider_config_settings')
    .upsert(ids.map((id) => ({ provider_id: id, config_key: cfg.key, envia: value })), { onConflict: 'provider_id,config_key' })
  if (error) throw error
}

export async function setCcMany(ids, cfg, ccConfigId) {
  if (!ids.length) return
  if (cfg.builtinCcField) {
    const { error } = await supabase.from('providers').update({ [cfg.builtinCcField]: ccConfigId }).in('id', ids)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('provider_config_settings')
    .upsert(ids.map((id) => ({ provider_id: id, config_key: cfg.key, cc_config_id: ccConfigId })), { onConflict: 'provider_id,config_key' })
  if (error) throw error
}

// Aplica un cambio local (optimista) al Map de settings para configuraciones nuevas.
export function patchSettings(settings, ids, cfg, patch) {
  const next = new Map(settings)
  for (const id of ids) {
    const k = settingKey(id, cfg.key)
    next.set(k, { provider_id: id, config_key: cfg.key, envia: true, cc_config_id: null, ...(next.get(k) || {}), ...patch })
  }
  return next
}
