import { supabase } from './supabase'

const MAX_AVATAR_BYTES = 4 * 1024 * 1024 // 4MB

// Devuelve la fila de perfiles del usuario actual, o null si todavía no ha guardado nada
// (usuario nuevo, o alguien que nunca tocó Configuración -- no es un error).
export async function getPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  return data
}

// Crea o actualiza la fila de perfiles del usuario actual.
export async function upsertPerfil(patch) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')
  const { data, error } = await supabase
    .from('perfiles')
    .upsert({ id: user.id, ...patch, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// Sube la foto de perfil al bucket "avatars" (siempre a "<uid>/avatar.<ext>", reemplazando la
// anterior) y devuelve la URL pública. No guarda todavía en la tabla perfiles -- eso lo hace
// el llamador con upsertPerfil, para poder mostrar el nombre y la foto en un solo guardado.
export async function uploadAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('La imagen no puede pesar más de 4MB.')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${user.id}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true, cacheControl: '3600', contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // cache-bust: la URL pública es siempre la misma ruta, así que sin esto el navegador podría
  // seguir mostrando la foto vieja en caché tras reemplazarla.
  return `${data.publicUrl}?v=${Date.now()}`
}

// Cambia la contraseña del usuario que ya tiene sesión iniciada (no pide la actual: Supabase
// confía en la sesión activa, igual que la mayoría de apps).
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
