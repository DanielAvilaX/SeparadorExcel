# Separador & Envío · Cruz Verde

Herramienta interna para dividir un Excel maestro **por proveedor** (un archivo por proveedor)
y —en fases siguientes— **enviar a cada proveedor su archivo por correo** desde la cuenta
corporativa. Reemplaza el proceso manual + macro.

Stack: **Vite + React**, Supabase (base de proveedores + auth), Microsoft Graph (correo, Plan A),
despliegue en **Vercel**. Estilo glassmorfismo + claymorfismo, blanco dominante con verde Cruz Verde.

> Ver **[NOTAS-PROYECTO.md](NOTAS-PROYECTO.md)** para decisiones, pendientes y el plan por fases.

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

## Estado actual (Fase 1)
- ✅ Selector de tipo: **PACOM**, **Rotación por canales**, **Descuentos** (próximamente).
- ✅ Configuración por tipo (hoja + columna de proveedor correctas por cada uno).
- ✅ Lectura del Excel, detección de la columna de proveedor, selección de columnas.
- ✅ Separación por proveedor → ZIP con un `.xlsx` por proveedor (encabezado verde, bordes, ancho automático).
- ⏳ Siguiente: base de proveedores (Supabase), login, pantalla de revisión con cruce contra la base, y envío de correo.

## Estructura
```
src/
  main.jsx
  App.jsx
  components/   TopBar, TypeSelector, Uploader
  lib/          fileTypes.js (config por tipo)  ·  excel.js (lectura + separación + zip)
  styles/       theme.css (glass + clay Cruz Verde)
legacy/         app original (HTML/JS/CSS) — referencia
samples/        archivos de ejemplo (PACOM, Rotación)
mockup.html     mockup de estilo standalone
```
