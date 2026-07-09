import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// La anon key es pública por diseño; la seguridad la dan las políticas RLS.
export const supabase = url && key ? createClient(url, key) : null

export const isConfigured = () => !!supabase
