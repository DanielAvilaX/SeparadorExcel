-- ============================================================
-- Migración: a qué tipo de archivo se le envía a cada proveedor
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- Es seguro correrlo más de una vez.
-- ============================================================

-- Un proveedor puede participar (o no) en cada tipo de archivo.
-- Por defecto participa en los 3 (para no cambiar el comportamiento actual).
alter table providers
  add column if not exists envia_pacom      boolean not null default true,
  add column if not exists envia_rotacion   boolean not null default true,
  add column if not exists envia_descuentos boolean not null default true;
