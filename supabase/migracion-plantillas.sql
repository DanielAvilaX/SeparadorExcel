-- ============================================================
-- Migración: de UNA plantilla a VARIAS plantillas
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

create table if not exists email_templates (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  asunto     text not null default '',
  cuerpo     text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table email_templates enable row level security;

-- Acceso (se dejan ambas por si aún no se restringió a usuarios autenticados)
drop policy if exists "anon_all_templates" on email_templates;
drop policy if exists "auth_all_templates" on email_templates;
create policy "anon_all_templates" on email_templates for all to anon          using (true) with check (true);
create policy "auth_all_templates" on email_templates for all to authenticated using (true) with check (true);

-- Pasa la plantilla que ya existía a la nueva tabla (solo si aún no hay ninguna)
insert into email_templates (nombre, asunto, cuerpo)
select 'Plantilla principal', coalesce(asunto, ''), coalesce(cuerpo, '')
from email_template
where id = 1
  and not exists (select 1 from email_templates);

-- Si no había nada que migrar, deja una plantilla vacía para empezar
insert into email_templates (nombre, asunto, cuerpo)
select 'Plantilla principal', '', ''
where not exists (select 1 from email_templates);

-- Nota: la tabla vieja `email_template` queda ahí por si acaso; ya no se usa.
-- Cuando confirmes que todo funciona, puedes borrarla con:
--   drop table email_template;
