-- ============================================================
-- Migración: multi-usuario
-- Cada usuario pasa a tener sus PROPIOS proveedores, plantillas y
-- configuraciones de CC (antes todo era compartido entre todos los que
-- iniciaban sesión). Los usuarios nuevos se pueden registrar solos desde
-- la pantalla de login.
--
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
--
-- ⚠️ ANTES DE CORRERLO: reemplaza 'TU_CORREO_AQUI' (línea marcada abajo con
-- <<<) por el correo con el que hoy inicias sesión en la app. Ahí se le
-- asigna TODO lo que ya existe (nadie pierde nada, tu cuenta se queda con
-- todos los proveedores/plantillas/CC actuales). Los usuarios que se creen
-- después arrancan con su propia lista vacía.
-- ============================================================

-- 1) owner_id en las tablas que deben quedar separadas por usuario.
--    El default auth.uid() hace que las filas NUEVAS se marquen solas con
--    quien las crea -- el código de la app no necesita mandar owner_id.
alter table providers       add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table cc_configs      add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table cc_defaults     add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table email_templates add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();

-- 2) Asignar todo lo que ya existe (sin dueño todavía) a tu cuenta.
do $$
declare
  v_owner uuid;
begin
  select id into v_owner from auth.users where email = 'TU_CORREO_AQUI'; -- <<< EDITA ESTA LÍNEA
  if v_owner is null then
    raise exception 'No se encontró ningún usuario con ese correo. Edita esta línea del script (bloque 2) con tu correo real de login antes de correrlo.';
  end if;

  update providers       set owner_id = v_owner where owner_id is null;
  update cc_configs      set owner_id = v_owner where owner_id is null;
  update cc_defaults     set owner_id = v_owner where owner_id is null;
  update email_templates set owner_id = v_owner where owner_id is null;
end $$;

-- 3) Ya no hay filas sin dueño: owner_id pasa a ser obligatorio.
alter table providers       alter column owner_id set not null;
alter table cc_configs      alter column owner_id set not null;
alter table cc_defaults     alter column owner_id set not null;
alter table email_templates alter column owner_id set not null;

-- 4) 'nombre' deja de ser único global: dos usuarios distintos SÍ pueden
--    tener un proveedor o una configuración de CC con el mismo nombre.
--    Pasa a ser único solo dentro de cada usuario.
alter table providers  drop constraint if exists providers_nombre_key;
alter table providers  add constraint providers_owner_nombre_key unique (owner_id, nombre);
alter table cc_configs drop constraint if exists cc_configs_nombre_key;
alter table cc_configs add constraint cc_configs_owner_nombre_key unique (owner_id, nombre);

-- 5) cc_defaults tenía una fila por tipo (compartida por todos); ahora es
--    una fila por (usuario, tipo).
alter table cc_defaults drop constraint if exists cc_defaults_pkey;
alter table cc_defaults add primary key (owner_id, tipo);

-- 6) RLS: cada quien ve y edita SOLO lo suyo.
drop policy if exists "auth_all_providers"   on providers;
drop policy if exists "anon_all_providers"   on providers;
drop policy if exists "auth_all_cc_configs"  on cc_configs;
drop policy if exists "anon_all_cc_configs"  on cc_configs;
drop policy if exists "auth_all_cc_defaults" on cc_defaults;
drop policy if exists "anon_all_cc_defaults" on cc_defaults;
drop policy if exists "auth_all_templates"   on email_templates;
drop policy if exists "anon_all_templates"   on email_templates;

create policy "own_providers"   on providers       for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_cc_configs"  on cc_configs      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_cc_defaults" on cc_defaults     for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_templates"   on email_templates for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 7) Bootstrap automático: cuando alguien crea una cuenta (se registra solo,
--    o la creas tú a mano desde Supabase), se le arma su punto de partida
--    -- una config "General" de CC, los 3 defaults por tipo, y una plantilla
--    vacía -- para que la app funcione igual que hoy, sin pantallas vacías
--    raras ni que el código de la UI tenga que adivinar si algo existe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cc_configs (nombre, emails, es_general, owner_id)
  values ('General', '{}', true, new.id);

  insert into cc_defaults (tipo, cc_config_id, owner_id) values
    ('PACOM', null, new.id),
    ('ROTACION', null, new.id),
    ('DESCUENTOS', null, new.id);

  insert into email_templates (nombre, asunto, cuerpo, owner_id)
  values ('Plantilla principal', '', '', new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
