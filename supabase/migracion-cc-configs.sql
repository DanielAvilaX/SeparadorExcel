-- ============================================================
-- Migración: configuraciones de correos en copia (CC)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

-- Configuraciones con nombre (los correos viven UNA sola vez aquí)
create table if not exists cc_configs (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  emails     text[] not null default '{}',
  es_general boolean not null default false,   -- la configuración base (no se puede eliminar)
  created_at timestamptz not null default now()
);

-- Configuración por defecto de cada tipo de archivo (null = usar la General)
create table if not exists cc_defaults (
  tipo         text primary key,               -- PACOM | ROTACION | DESCUENTOS
  cc_config_id uuid references cc_configs(id) on delete set null
);

alter table cc_configs  enable row level security;
alter table cc_defaults enable row level security;

drop policy if exists "anon_all_cc_configs" on cc_configs;
drop policy if exists "auth_all_cc_configs" on cc_configs;
create policy "anon_all_cc_configs" on cc_configs for all to anon          using (true) with check (true);
create policy "auth_all_cc_configs" on cc_configs for all to authenticated using (true) with check (true);

drop policy if exists "anon_all_cc_defaults" on cc_defaults;
drop policy if exists "auth_all_cc_defaults" on cc_defaults;
create policy "anon_all_cc_defaults" on cc_defaults for all to anon          using (true) with check (true);
create policy "auth_all_cc_defaults" on cc_defaults for all to authenticated using (true) with check (true);

-- La lista de CC que ya existía pasa a ser la configuración "General" (solo la primera vez)
insert into cc_configs (nombre, emails, es_general)
select 'General', coalesce((select array_agg(email) from cc_global), '{}'::text[]), true
where not exists (select 1 from cc_configs where es_general);

-- Defaults por tipo (null = usar General)
insert into cc_defaults (tipo, cc_config_id) values ('PACOM', null)      on conflict do nothing;
insert into cc_defaults (tipo, cc_config_id) values ('ROTACION', null)   on conflict do nothing;
insert into cc_defaults (tipo, cc_config_id) values ('DESCUENTOS', null) on conflict do nothing;

-- Excepciones por proveedor y por tipo (null = usar la cascada de defaults)
alter table providers
  add column if not exists cc_pacom      uuid references cc_configs(id) on delete set null,
  add column if not exists cc_rotacion   uuid references cc_configs(id) on delete set null,
  add column if not exists cc_descuentos uuid references cc_configs(id) on delete set null;

-- Nota: la tabla vieja `cc_global` queda migrada dentro de "General"; ya no se usa.
-- Cuando confirmes que todo funciona puedes borrarla con:  drop table cc_global;
