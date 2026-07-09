-- ============================================================
-- Separador & Envío · Cruz Verde — Esquema Supabase
-- Ejecutar en:  Supabase → SQL Editor → New query → pegar → Run
-- ============================================================

-- Proveedores (globales para los 3 tipos de archivo).
-- 'nombre' debe coincidir EXACTO con el proveedor del Excel para enrutar el correo.
create table if not exists providers (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  emails     text[] not null default '{}',   -- destinatarios "Para" (puede tener varios)
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Correos en copia (CC) globales: la misma lista para todos los envíos.
create table if not exists cc_global (
  id    uuid primary key default gen_random_uuid(),
  email text not null unique
);

-- Plantilla del correo (una sola fila). Vacía por ahora, editable.
create table if not exists email_template (
  id     int primary key default 1,
  asunto text not null default '',
  cuerpo text not null default '',
  constraint solo_una_fila check (id = 1)
);
insert into email_template (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RLS (Row Level Security)
-- FASE 2 (sin login todavía): se permite acceso al rol 'anon'.
-- FASE 3 (con login): reemplazar 'to anon' por 'to authenticated' para restringir.
-- ------------------------------------------------------------
alter table providers      enable row level security;
alter table cc_global      enable row level security;
alter table email_template enable row level security;

drop policy if exists "anon_all_providers" on providers;
drop policy if exists "anon_all_cc" on cc_global;
drop policy if exists "anon_all_template" on email_template;

create policy "anon_all_providers" on providers      for all to anon using (true) with check (true);
create policy "anon_all_cc"        on cc_global       for all to anon using (true) with check (true);
create policy "anon_all_template"  on email_template  for all to anon using (true) with check (true);
