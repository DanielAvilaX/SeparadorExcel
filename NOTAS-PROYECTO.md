# Notas del proyecto — Separador & Envío · Cruz Verde

Documento de trabajo. Registra decisiones cerradas, pendientes y el plan.
Última actualización: 2026-07-08.

---

## 1. Qué es y para qué

Herramienta interna para **María Morales** (Cruz Verde). Toma un Excel maestro,
lo **divide por proveedor** (un archivo Excel por proveedor) y **envía a cada proveedor
su archivo por correo**, desde la cuenta corporativa de ella. Reemplaza el proceso
manual + macro que hoy hace una compañera.

---

## 2. Decisiones cerradas ✅

- **3 tipos de archivo** con selector interactivo:
  - **PACOM** → hoja de lista de productos, columna de proveedor = `PROVEEDOR`.
  - **ROTACIÓN POR CANALES** → hoja `Export`, columna de proveedor = `NOMBRE_PROV`.
  - **DESCUENTOS** → **"Próximamente"** (deshabilitado hasta tener el archivo de muestra).
- **División siempre por proveedor**; salida = 1 Excel por proveedor, empaquetados en ZIP.
- **Cada correo lleva adjunto** el Excel de ese proveedor.
- **Emparejamiento EXACTO** entre el nombre del proveedor en el Excel y el de la base.
  Los que no coinciden **se muestran** en la pantalla de revisión pero **NO bloquean** el envío.
- **Proveedores en Supabase** (globales para los 3 tipos). Ella puede:
  - Ver, agregar, editar y eliminar proveedores manualmente.
  - Carga masiva por Excel. Plantilla: columnas `NOMBRE DEL PROVEEDOR` y `CORREO(S)`
    (varios correos separados por `;`).
  - Un proveedor puede tener **varios correos** (destinatarios "Para").
- **CC (copia) global**: una sola lista de correos en copia para todos los envíos,
  editable por ella (agregar / editar / eliminar).
- **Plantilla del correo** (asunto + cuerpo): vacía por ahora, pero **editable** por ella.
- **Login solo para ella** (Supabase Auth).
- **Envío = Plan A (Microsoft Graph, delegado)**, sí o sí desde su cuenta corporativa.
  Plan B (Gmail) **descartado** (no cumple remitente corporativo).
- **Hosting: Vercel** (front estático + funciones serverless para el correo).
- **Estilo**: glassmorfismo + claymorfismo, **predomina el blanco**, verde Cruz Verde
  solo en detalles, **sin logo**. Sensible a tema claro/oscuro (abre en claro).

---

## 3. Pendientes de María (para mañana / cuando esté disponible)

- [ ] **PRUEBA DE LOGIN DE MICROSOFT** (crítica — desbloquea todo el envío).
      Ver checklist en la sección 5.
- [ ] **Archivo de muestra de DESCUENTOS** (el tercer tipo) para configurar su columna/formato.


---

## 4. Riesgo abierto ⚠️

Todo el envío depende de que el **administrador de Cruz Verde permita el consentimiento
de usuario** para apps. No podemos involucrar a TI. Si está bloqueado, **no hay
alternativa limpia** para enviar desde su correo corporativo (solo caminos incómodos
como Power Automate, no garantizados). Por eso la prueba de login se hace **temprano**,
antes de construir toda la capa de correo.

---

## 5. Checklist prueba de login de Microsoft (Plan A)

1. Yo (dev) registro una app en **Entra ID** (entra.microsoft.com) con una cuenta
   Microsoft propia — **gratis y permanente**, no es la cuenta de Azure de pago,
   no es claude.ai, no es Cruz Verde. Configuración:
   - Tipo: **multi-tenant**.
   - Redirect URI: la URL de Vercel.
   - Permiso: **Microsoft Graph → `Mail.Send` (delegado)**.
   - Genero **Client ID** y **Client Secret** (secreto: rotar cada ≤24 meses).
2. Le paso a María un link de login.
3. Ella inicia sesión con su cuenta **@cruzverde**. Dos resultados posibles:
   - Ve "esta app quiere enviar correo como tú → **Aceptar**" → **Plan A viable** ✅
   - Ve "**se requiere aprobación del administrador**" → Plan A bloqueado ❌ (replantear)

---

## 6. Plan técnico por fases

**Fase 0 — Andamiaje**
- Migrar de HTML plano a estructura desplegable en Vercel (front + `/api` serverless).
- Crear proyecto Supabase (tablas + Auth).

**Fase 1 — Rediseño + motor de separación multi-tipo** ✅ HECHA
- [x] Proyecto Vite + React desplegable en Vercel.
- [x] UI nueva (glass + clay, blanco Cruz Verde) con selector de tipo y tema claro/oscuro.
- [x] Config por tipo (PACOM→hoja "LISTAS DE PRODUCTOS"/col PROVEEDOR; Rotación→hoja "Export"/col NOMBRE_PROV).
- [x] Lectura, detección de columna, selección de columnas, separación por proveedor → ZIP
      con un .xlsx por proveedor (encabezado verde, bordes, ancho automático — ahora sí con
      estilos reales vía ExcelJS; el código viejo los ponía pero SheetJS free los ignoraba).
- Pendiente afinar: formato de fechas/`%descuento` por tipo cuando veamos las salidas reales.

**Fase 2 — Base de proveedores (Supabase)** ✅ HECHA (falta correr el SQL en Supabase)
- [x] Esquema `supabase/schema.sql`: `providers (nombre único, emails[], activo)`, `cc_global`, `email_template`.
- [x] Navegación: Procesar / Proveedores / Copia (CC).
- [x] Proveedores: ver, buscar, agregar, editar, eliminar; carga masiva por Excel + plantilla descargable.
- [x] CC global: agregar / eliminar correos en copia.
- [x] RLS temporal para `anon` (se restringe a `authenticated` en Fase 3).
- **ACCIÓN PENDIENTE (Daniel):** ejecutar `supabase/schema.sql` en Supabase → SQL Editor.
- Nota: NO se migró la lista blanca vieja (los proveedores de consumo son otros; se cargan por Excel).

**Fase 3 — Login (Supabase Auth)** (no depende de María)
- Acceso solo para ella.

**Fase 4 — Pantalla de revisión antes de enviar** (no depende de María)
- Cruzar proveedores del archivo contra la base; mostrar "recibirán" vs "sin correo".

**Fase 5 — Envío por correo (Microsoft Graph)** — GATED por la prueba de login
- Función serverless en Vercel: OAuth con Microsoft + `sendMail` con adjunto.
- Plantilla editable, CC global, envío por lote con confirmación.

**Fase 6 — Descuentos** — GATED por el archivo de muestra.

---

## 7. Esquema de datos Supabase (borrador)

```
providers
  id           uuid pk
  nombre       text  (único, debe coincidir EXACTO con el Excel)
  emails       text[]  (destinatarios "Para")
  activo       bool
  created_at   timestamptz

cc_global
  id           uuid pk
  email        text

email_template
  id           uuid pk  (fila única)
  asunto       text
  cuerpo       text  (con variables: {{proveedor}}, etc.)

send_log (opcional, para auditoría)
  id, proveedor, emails, enviado_at, estado
```
