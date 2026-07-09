-- ============================================================
-- Endurecer RLS: restringir el acceso a usuarios AUTENTICADOS.
-- Ejecutar SOLO cuando el login ya funcione y la usuaria exista.
-- (Si lo corres antes, la app pedirá login para poder leer/escribir.)
-- ============================================================

-- Quitar las políticas abiertas para 'anon'
drop policy if exists "anon_all_providers" on providers;
drop policy if exists "anon_all_cc" on cc_global;
drop policy if exists "anon_all_template" on email_template;

-- Permitir todo solo a usuarios autenticados
create policy "auth_all_providers" on providers      for all to authenticated using (true) with check (true);
create policy "auth_all_cc"        on cc_global       for all to authenticated using (true) with check (true);
create policy "auth_all_template"  on email_template  for all to authenticated using (true) with check (true);
