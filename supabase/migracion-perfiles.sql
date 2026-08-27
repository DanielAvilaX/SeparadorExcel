-- ============================================================
-- Migración: perfiles de usuario (nombre para mostrar + foto de perfil)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

-- Una fila por usuario (creada la primera vez que guarda algo en Configuración -- no hace
-- falta backfill, si no existe la fila la app simplemente usa el correo/iniciales como hoy).
create table if not exists perfiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

alter table perfiles enable row level security;

drop policy if exists "own_perfil" on perfiles;
create policy "own_perfil" on perfiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Bucket público para las fotos de perfil (público de LECTURA -- cualquiera con el link ve la
-- foto, como en casi cualquier app; escribir/borrar sigue restringido por las políticas de abajo).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Cada usuario solo puede subir/reemplazar/borrar objetos DENTRO de su propia carpeta
-- (el código sube siempre a "<uid>/avatar.<ext>"), pero cualquiera puede leer (bucket público).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_own_insert" on storage.objects;
create policy "avatars_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
