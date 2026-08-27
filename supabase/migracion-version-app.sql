-- ============================================================
-- Migración: version publicada de la app (para el aviso de actualización)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

-- Una sola fila con la ULTIMA version publicada. La app compara esto contra su propia
-- version (package.json, inyectada al compilar) y muestra un aviso si está desactualizada.
create table if not exists app_version (
  id           int primary key default 1,
  version      text not null,
  download_url text not null default '',
  changelog    text not null default '',
  updated_at   timestamptz not null default now(),
  constraint solo_una_fila check (id = 1)
);

insert into app_version (id, version) values (1, '0.2.0') on conflict (id) do nothing;

alter table app_version enable row level security;

-- Los usuarios autenticados solo pueden LEER esta fila. No hay política de escritura para
-- 'authenticated' a propósito: la versión solo se actualiza a mano (Supabase → Table Editor,
-- o SQL Editor) cuando Daniel publica un build nuevo. Con RLS activo y sin política de
-- INSERT/UPDATE, esas operaciones quedan bloqueadas para cualquier usuario normal.
drop policy if exists "auth_read_app_version" on app_version;
create policy "auth_read_app_version" on app_version for select to authenticated using (true);
