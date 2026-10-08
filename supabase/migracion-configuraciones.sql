-- =============================================================================
-- Migración: configuraciones de separación por usuario, con historial de versiones
-- =============================================================================
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin daño.
--
-- split_configs            una fila por configuración y por usuario. Las de fábrica (PACOM,
--                          ROTACION, DESCUENTOS) solo aparecen acá cuando el usuario las edita
--                          o las usa por primera vez; mientras tanto la app usa la versión
--                          original que trae el código.
-- split_config_versions    cada guardado = una versión nueva (nunca se sobreescribe ninguna), con
--                          su contador de usos. Restaurar = crear una versión nueva copiando una
--                          anterior, así el historial nunca pierde nada.
-- provider_config_settings quién recibe cada configuración NUEVA y con qué CC (las 3 de fábrica
--                          siguen usando las columnas envia_* / cc_* de providers).
-- Todo es privado por usuario (owner_id = auth.uid()), igual que proveedores y plantillas.
-- =============================================================================

create table if not exists public.split_configs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key                text not null,
  nombre             text not null,
  descripcion        text not null default '',
  icono              text not null default '',
  builtin            boolean not null default false,
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint split_configs_owner_key unique (owner_id, key)
);

create table if not exists public.split_config_versions (
  id          uuid primary key default gen_random_uuid(),
  config_id   uuid not null references public.split_configs(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version     int not null,
  definition  jsonb not null,
  nota        text not null default '',
  usos        int not null default 0,
  ultimo_uso  timestamptz,
  created_at  timestamptz not null default now(),
  constraint split_config_versions_num unique (config_id, version)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'split_configs_current_fk') then
    alter table public.split_configs
      add constraint split_configs_current_fk foreign key (current_version_id)
      references public.split_config_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.provider_config_settings (
  provider_id  uuid not null references public.providers(id) on delete cascade,
  config_key   text not null,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  envia        boolean not null default true,
  cc_config_id uuid references public.cc_configs(id) on delete set null,
  primary key (provider_id, config_key)
);

alter table public.split_configs            enable row level security;
alter table public.split_config_versions    enable row level security;
alter table public.provider_config_settings enable row level security;

drop policy if exists "own_split_configs" on public.split_configs;
drop policy if exists "own_split_config_versions" on public.split_config_versions;
drop policy if exists "own_provider_config_settings" on public.provider_config_settings;
create policy "own_split_configs"            on public.split_configs            for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_split_config_versions"    on public.split_config_versions    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_provider_config_settings" on public.provider_config_settings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Suma un uso a una versión. Una función (y no un update desde la app) para que el +1 sea
-- atómico aunque dos ventanas usen la misma configuración a la vez. security invoker: respeta RLS.
create or replace function public.registrar_uso_config(p_version_id uuid)
returns void
language sql
security invoker
as $$
  update public.split_config_versions
     set usos = usos + 1, ultimo_uso = now()
   where id = p_version_id and owner_id = auth.uid();
$$;

grant execute on function public.registrar_uso_config(uuid) to authenticated;
