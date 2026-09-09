-- ============================================================
-- Migración: multi-usuario
-- A partir de ahora cada usuario tiene sus PROPIOS proveedores, plantillas
-- y configuraciones de CC, totalmente aislados (antes todo era compartido
-- entre cualquiera con sesión iniciada).
--
-- Las DOS cuentas que ya existen hoy (danielo57097@gmail.com y
-- mariaa.morales@cruzverde.com.co) terminan con una COPIA INDEPENDIENTE
-- cada una de todo lo que existe actualmente -- arrancan iguales, pero de
-- ahí en adelante lo que edite/borre/agregue una NO afecta a la otra.
-- Las referencias de un proveedor a una configuración de CC específica
-- (columnas cc_pacom/cc_rotacion/cc_descuentos) se remapean para que la
-- copia de cada quien apunte a SU PROPIA copia de esa configuración, no a
-- la de la otra persona.
--
-- Cualquier cuenta NUEVA que se registre de aquí en adelante arranca
-- completamente vacía (no ve nada de lo de estas dos cuentas).
--
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- ============================================================

-- 1) owner_id en las tablas que deben quedar separadas por usuario.
--    El default auth.uid() hace que las filas NUEVAS se marquen solas con
--    quien las crea -- el código de la app no necesita mandar owner_id.
alter table providers       add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table cc_configs      add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table cc_defaults     add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table email_templates add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();

-- 2) Quitar las restricciones VIEJAS (nombre único global / tipo único global)
--    ANTES de duplicar nada: si no, el paso 3 no podría insertar la copia de
--    María porque tendría el mismo nombre/tipo que la de Daniel.
alter table providers  drop constraint if exists providers_nombre_key;
alter table cc_configs drop constraint if exists cc_configs_nombre_key;
alter table cc_defaults drop constraint if exists cc_defaults_pkey;

-- 3) Asignar todo lo que ya existe a Daniel, y crear una COPIA INDEPENDIENTE
--    de cada fila para María (con ids nuevos, y las referencias a una config
--    de CC específica remapeadas a la copia correspondiente de María).
do $$
declare
  v_daniel uuid;
  v_maria  uuid;
begin
  select id into v_daniel from auth.users where email = 'danielo57097@gmail.com';
  if v_daniel is null then
    raise exception 'No se encontró ningún usuario con el correo danielo57097@gmail.com.';
  end if;

  select id into v_maria from auth.users where email = 'mariaa.morales@cruzverde.com.co';
  if v_maria is null then
    raise exception 'No se encontró ningún usuario con el correo mariaa.morales@cruzverde.com.co. Revisa que esté bien escrito antes de correr esto.';
  end if;

  update providers       set owner_id = v_daniel where owner_id is null;
  update cc_configs      set owner_id = v_daniel where owner_id is null;
  update cc_defaults     set owner_id = v_daniel where owner_id is null;
  update email_templates set owner_id = v_daniel where owner_id is null;

  -- Mapa viejo->nuevo id de cc_configs (Daniel -> copia de María), correlacionado
  -- por nombre -- en este punto todavía es único entre las filas de Daniel.
  create temporary table _map_cc_configs (old_id uuid primary key, new_id uuid not null) on commit drop;

  with inserted as (
    insert into cc_configs (nombre, emails, es_general, owner_id)
    select nombre, emails, es_general, v_maria
    from cc_configs
    where owner_id = v_daniel
    returning id, nombre
  )
  insert into _map_cc_configs (old_id, new_id)
  select old.id, new.id
  from cc_configs old
  join inserted new on new.nombre = old.nombre
  where old.owner_id = v_daniel;

  -- Copia de cc_defaults para María (remapeando cc_config_id si apunta a algo).
  insert into cc_defaults (tipo, cc_config_id, owner_id)
  select d.tipo, m.new_id, v_maria
  from cc_defaults d
  left join _map_cc_configs m on m.old_id = d.cc_config_id
  where d.owner_id = v_daniel;

  -- Copia de providers para María (remapeando cc_pacom/cc_rotacion/cc_descuentos).
  insert into providers (nombre, emails, activo, envia_pacom, envia_rotacion, envia_descuentos, cc_pacom, cc_rotacion, cc_descuentos, owner_id)
  select p.nombre, p.emails, p.activo, p.envia_pacom, p.envia_rotacion, p.envia_descuentos,
         mp.new_id, mr.new_id, md.new_id, v_maria
  from providers p
  left join _map_cc_configs mp on mp.old_id = p.cc_pacom
  left join _map_cc_configs mr on mr.old_id = p.cc_rotacion
  left join _map_cc_configs md on md.old_id = p.cc_descuentos
  where p.owner_id = v_daniel;

  -- Copia de email_templates para María (sin referencias cruzadas que remapear).
  insert into email_templates (nombre, asunto, cuerpo, owner_id)
  select nombre, asunto, cuerpo, v_maria
  from email_templates
  where owner_id = v_daniel;
end $$;

-- 4) Ya no hay filas sin dueño: owner_id pasa a ser obligatorio.
alter table providers       alter column owner_id set not null;
alter table cc_configs      alter column owner_id set not null;
alter table cc_defaults     alter column owner_id set not null;
alter table email_templates alter column owner_id set not null;

-- 5) Las restricciones nuevas: únicas por dueño, no globales.
alter table providers  add constraint providers_owner_nombre_key unique (owner_id, nombre);
alter table cc_configs add constraint cc_configs_owner_nombre_key unique (owner_id, nombre);
alter table cc_defaults add primary key (owner_id, tipo);

-- 6) RLS: cada quien ve y edita SOLO lo suyo (sin excepciones -- Daniel y
--    María quedaron con copias independientes en el paso 3, así que esto
--    ya los aísla correctamente entre sí también).
drop policy if exists "auth_all_providers"   on providers;
drop policy if exists "anon_all_providers"   on providers;
drop policy if exists "auth_all_cc_configs"  on cc_configs;
drop policy if exists "anon_all_cc_configs"  on cc_configs;
drop policy if exists "auth_all_cc_defaults" on cc_defaults;
drop policy if exists "anon_all_cc_defaults" on cc_defaults;
drop policy if exists "auth_all_templates"   on email_templates;
drop policy if exists "anon_all_templates"   on email_templates;
drop policy if exists "own_providers"   on providers;
drop policy if exists "own_cc_configs"  on cc_configs;
drop policy if exists "own_cc_defaults" on cc_defaults;
drop policy if exists "own_templates"   on email_templates;
drop policy if exists "own_or_shared_providers"   on providers;
drop policy if exists "own_or_shared_cc_configs"  on cc_configs;
drop policy if exists "own_or_shared_cc_defaults" on cc_defaults;
drop policy if exists "own_or_shared_templates"   on email_templates;

create policy "own_providers"   on providers       for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_cc_configs"  on cc_configs      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_cc_defaults" on cc_defaults     for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own_templates"   on email_templates for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 7) Ya no hace falta la función de excepción compartida de un intento
--    anterior de este script (si llegó a crearse).
drop function if exists public.es_cuenta_compartida(uuid);

-- 8) Bootstrap automático: cuando alguien crea una cuenta NUEVA (se registra
--    solo desde el login), se le arma su punto de partida -- una config
--    "General" de CC, los 3 defaults por tipo, y una plantilla vacía --
--    propios y aislados, para que la app funcione igual que hoy sin
--    pantallas vacías raras.
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
