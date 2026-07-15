# Separador & Envío · Cruz Verde

Herramienta interna para dividir un Excel maestro **por proveedor** (un archivo por proveedor)
y —en fases siguientes— **enviar a cada proveedor su archivo por correo** desde la cuenta
corporativa. Reemplaza el proceso manual + macro.

Stack: **Vite + React**, Supabase (base de proveedores + auth), Microsoft Graph (correo, Plan A),
despliegue en **Vercel**. Estilo glassmorfismo + claymorfismo, blanco dominante con verde Cruz Verde.

> 📘 **[MANUAL-DE-USO.md](MANUAL-DE-USO.md)** — guía de uso para la usuaria final (paso a paso y solución de errores).

## Requisitos
- Node 18+ (probado con Node 24).

## Desarrollo
```bash
npm install
npm run dev      # servidor local (http://localhost:5173)
npm run build    # build de producción a /dist
npm run preview  # previsualiza el build
```

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar. En Vercel se configuran como *Environment Variables*.
La `anon key` de Supabase es pública por diseño; la seguridad la dan las políticas RLS.

## Despliegue en Vercel
1. Subir el repo a GitHub (ya está: `DanielAvilaX/SeparadorExcel`).
2. En vercel.com → **Add New → Project → Import** el repo.
3. Vercel detecta Vite automáticamente (build `npm run build`, salida `dist`).
4. Agregar las Environment Variables del `.env.example`.
5. Deploy. Cada `git push` a `main` re-despliega solo.

## Estado actual
- ✅ **3 tipos**: PACOM, Rotación por canales y Descuentos (detección automática de la fila de encabezado).
- ✅ Separación por proveedor → ZIP con un `.xlsx` por proveedor. Descuentos genera un **formato de 2 hojas** (CONFIRMACION DESCUENTO + DEPURACION con total).
- ✅ **Base de proveedores** en Supabase (CRUD + carga masiva + CC global + plantilla de correo).
- ✅ **Login** (Supabase Auth) y **pantalla de revisión** (cruce contra la base).
- ✅ UI glass + clay, tema claro/oscuro, animaciones (carga, rebote por pestaña, toasts, modal de confirmación).
- 🔒 **Envío de correo** (Microsoft Graph) — pendiente de la prueba de consentimiento de Microsoft.

## Estructura
```
src/
  main.jsx
  App.jsx
  components/   TopBar, Nav, TypeSelector, Uploader, Login, Spinner, ToastHost, ConfirmHost
  views/        ProcesarView, ProveedoresView, CcView, PlantillaView
  lib/          fileTypes.js (config por tipo) · excel.js (lectura + separación + zip) · supabase, providers, template, toast, confirm
  styles/       theme.css (glass + clay Cruz Verde)
supabase/       schema.sql · rls-authenticated.sql
```

> Nota: los archivos Excel de datos (`.xlsx`) están en `.gitignore` — no se suben al repo por privacidad.
