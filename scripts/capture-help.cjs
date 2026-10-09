// Genera las capturas de la Ayuda (src/assets/help/*.jpg + src/help/shots.json).
//
// Abre la app real con una sesión de prueba y datos de EJEMPLO (las respuestas de Supabase y de
// GitHub se simulan acá: no se lee ni se escribe nada de la base real), recorre cada pantalla y
// guarda, por cada captura, la posición de los botones a señalar. La Ayuda dibuja los recuadros
// rojos y las flechas encima, así siguen nítidos a cualquier tamaño.
//
// Uso:  npx vite build  &&  npx electron scripts/capture-help.cjs
// Archivos de ejemplo: carpeta HELP_SAMPLES (por defecto Escritorio\Aleja).
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..')
const OUT_IMG = path.join(ROOT, 'src', 'assets', 'help')
const OUT_JSON = path.join(ROOT, 'src', 'help', 'shots.json')
const SAMPLES = process.env.HELP_SAMPLES || 'C:/Users/Usuario/OneDrive/Escritorio/Aleja'
const W = 1280
const H = 800

process.chdir(ROOT)
delete process.env.ELECTRON_DEV
const { app, session, net, ipcMain } = require('electron')
// Perfil propio y limpio en cada corrida (si quedara la sesión de prueba anterior, no se vería el login).
const USER_DATA = path.join(require('os').tmpdir(), 'separador-help-capture')
fs.rmSync(USER_DATA, { recursive: true, force: true })
app.setPath('userData', USER_DATA)
require(path.join(ROOT, 'electron', 'main.cjs'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
fs.mkdirSync(OUT_IMG, { recursive: true })
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })

// ------------------------------------------------------------------ datos de ejemplo
const UID = '00000000-0000-0000-0000-000000000001'
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const NAMES = [
  '3M COLOMBIA SA', 'ABBOTT LABORATORIES DE COLOMBIA S.A.S', 'AIPHEX GLOBALPHARMA S.A.S', 'ALCE PUBLICIDAD S.A.S',
  'ALFA TRADING SAS', 'ALIMENTOS LIFT SAS', 'ALMACENES J.R. S.A.S', 'AREOLA LTDA', 'AVALON PHARMACEUTICAL S.A',
  'BABARIA COLOMBIA S.A.S', 'BAYER SA', 'BEIERSDORF SA', 'BELLA PIEL LTDA', 'BELLEZA EXPRESS SA', 'BOYDORR SAS',
  'BSN MEDICAL LTDA', 'C.E. LOGISTICA INTEGRAL S.A.S', 'CARDINAL HEALTH COLOMBIA SAS', 'CERESCOS SAS',
  'COLGATE PALMOLIVE COMPANIA', 'HENKEL COLOMBIANA SAS', 'ISDIN COLOMBIA SAS',
]
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14)
const DB = {
  providers: NAMES.map((nombre, i) => ({
    id: uuid(100 + i), owner_id: UID, nombre,
    emails: i === 6 ? [] : i % 4 === 0 ? [`compras@${slug(nombre)}.ejemplo.co`, `ventas@${slug(nombre)}.ejemplo.co`] : [`compras@${slug(nombre)}.ejemplo.co`],
    activo: i !== 8,
    envia_pacom: true, envia_rotacion: i !== 3, envia_descuentos: ![4, 11].includes(i),
    cc_pacom: i === 1 ? uuid(2) : null, cc_rotacion: null, cc_descuentos: i === 2 ? uuid(2) : null,
    created_at: '2026-08-01T12:00:00Z',
  })),
  cc_configs: [
    { id: uuid(1), owner_id: UID, nombre: 'General', emails: ['compras.lider@cruzverde.com.co'], es_general: true },
    { id: uuid(2), owner_id: UID, nombre: 'CC Dermocosmética', emails: ['dermo@cruzverde.com.co', 'compras.lider@cruzverde.com.co'], es_general: false },
    { id: uuid(3), owner_id: UID, nombre: 'CC Rotación', emails: ['analitica@cruzverde.com.co'], es_general: false },
  ],
  cc_defaults: [
    { owner_id: UID, tipo: 'PACOM', cc_config_id: null },
    { owner_id: UID, tipo: 'ROTACION', cc_config_id: uuid(3) },
    { owner_id: UID, tipo: 'DESCUENTOS', cc_config_id: null },
  ],
  email_templates: [
    {
      id: uuid(10), owner_id: UID, nombre: 'Descuentos mensual', asunto: 'Solicitud de descuentos {{mes}} - {{proveedor}}',
      cuerpo: '<p>Buen día equipo de <b>{{proveedor}}</b>,</p><p>Adjuntamos el archivo con los productos de la depuración de <b>{{mes}}</b>. Por favor diligencien la hoja <b>CONFIRMACION DESCUENTO</b> y la devuelven respondiendo este correo.</p><p>Quedamos atentos.</p><p>Cordialmente,<br>Equipo de Compras</p>',
      updated_at: '2026-09-30T15:00:00Z',
    },
    { id: uuid(11), owner_id: UID, nombre: 'PACOM', asunto: 'Participación PACOM {{mes}} - {{proveedor}}', cuerpo: '<p>Hola {{proveedor}},</p><p>Les compartimos el PACOM de {{mes}}.</p>', updated_at: '2026-09-01T15:00:00Z' },
  ],
  perfiles: [{ id: UID, display_name: 'Analista de Compras', avatar_url: null }],
  provider_config_settings: [],
  split_configs: [],
  split_config_versions: [],
}

let showUpdate = false
let builtins

async function seedConfigs() {
  builtins = (await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'splitter', 'builtins.js')).href)).BUILTIN_CONFIGS
  const pacom = builtins.find((b) => b.key === 'PACOM')
  const v = (n, def, nota, usos, dias) => ({
    id: uuid(300 + n), config_id: uuid(200), owner_id: UID, version: n, definition: def, nota, usos,
    ultimo_uso: usos ? new Date(Date.now() - dias * 86400000).toISOString() : null,
    created_at: new Date(Date.now() - (40 - n * 10) * 86400000).toISOString(),
  })
  const v2def = JSON.parse(JSON.stringify(pacom.definition))
  v2def.filters = [{ action: 'exclude', column: 'ACTIVIDAD', op: 'eq', value: 'Descuentos de miedo' }]
  DB.split_config_versions.push(
    v(1, pacom.definition, 'Versión original', 14, 30),
    v(2, v2def, 'Sin la actividad "Descuentos de miedo"', 3, 12),
    v(3, pacom.definition, 'Restaurada desde la versión 1', 2, 1),
  )
  DB.split_configs.push({
    id: uuid(200), owner_id: UID, key: 'PACOM', nombre: 'PACOM', descripcion: pacom.description, icono: 'P',
    builtin: true, current_version_id: uuid(303), created_at: '2026-09-01T00:00:00Z',
  })
  const custom = {
    email: false, split: { by: 'column', column: 'MACROCATEGORIA', size: 1000 }, output: 'sheets', filters: [],
    sheets: [{ type: 'data', name: 'Productos', source: ['CONFIRMACION DESCUENTOS'], fallback: 'first', optional: false, headerRow: null, columns: null, total: null }],
  }
  DB.split_configs.push({
    id: uuid(201), owner_id: UID, key: uuid(201), nombre: 'Productos por categoría', descripcion: 'Un archivo con una pestaña por macrocategoría.',
    icono: 'C', builtin: false, current_version_id: uuid(310), created_at: '2026-09-20T00:00:00Z',
  })
  DB.split_config_versions.push({ id: uuid(310), config_id: uuid(201), owner_id: UID, version: 1, definition: custom, nota: 'Primera versión', usos: 5, ultimo_uso: new Date().toISOString(), created_at: '2026-09-20T00:00:00Z' })
}

// ------------------------------------------------------------------ Supabase / GitHub simulados
function filterRows(rows, params) {
  let out = rows
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === decodeURIComponent(v.slice(3)))
    else if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((s) => decodeURIComponent(s).replace(/^"|"$/g, '')))
      out = out.filter((r) => set.has(String(r[k])))
    }
  }
  const order = params.get('order')
  if (order) {
    const [col, dir] = order.split(',')[0].split('.')
    out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1))
  }
  const limit = params.get('limit')
  if (limit) out = out.slice(0, Number(limit))
  return out
}

const json = (body, status = 200, headers = {}) => new Response(body == null ? null : JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
})

async function mock(req) {
  const url = new URL(req.url)
  if (url.hostname === 'api.github.com') {
    if (!showUpdate) return json({ message: 'Not Found' }, 404)
    return json({
      tag_name: 'v0.4.0', html_url: 'https://github.com',
      assets: [{ name: 'Separador.zip', browser_download_url: 'https://ejemplo.invalid/Separador.zip' }],
      body: '## Novedades\n- Mejoras en la separación de archivos grandes.\n- Nuevas opciones en Separaciones.',
    })
  }
  if (!url.hostname.endsWith('supabase.co')) return net.fetch(req, { bypassCustomProtocolHandlers: true })

  if (url.pathname.startsWith('/auth/v1/user')) {
    return json({ id: UID, email: 'analista@cruzverde.com.co', aud: 'authenticated', role: 'authenticated' })
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return new Response(null, { status: 204 })
  const table = url.pathname.replace('/rest/v1/', '')
  const rows = DB[table]
  if (!rows) return json({ code: '42P01', message: `relation "${table}" does not exist` }, 404)

  const method = req.method
  const single = (req.headers.get('accept') || '').includes('vnd.pgrst.object')
  if (method === 'GET' || method === 'HEAD') {
    const out = filterRows(rows, url.searchParams)
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `0-0/${out.length}` } })
    if (single) return out.length ? json(out[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)
    return json(out, 200, { 'content-range': `0-${out.length}/${out.length}` })
  }
  // Escrituras: se aceptan sin guardar nada (las capturas no guardan).
  let body = null
  try { body = await req.json() } catch { /* sin cuerpo */ }
  const first = Array.isArray(body) ? body[0] : body
  return single ? json({ id: uuid(999), ...(first || {}) }, 201) : json(body ? [].concat(body) : [], 201)
}

// ------------------------------------------------------------------ ayudantes de página
const PAGE_HELPERS = `
window.__h = {
  find(spec) {
    if (!spec) return null
    let root = document
    if (spec.within) root = window.__h.find(spec.within) || document
    let els = [...root.querySelectorAll(spec.sel || '*')]
    if (spec.text) {
      const re = new RegExp(spec.text, 'i')
      const txt = (e) => (e.innerText || e.value || e.placeholder || '').trim()
      els = els.filter((e) => re.test(txt(e)))
      if (!spec.sel) els = els.filter((e) => ![...e.children].some((c) => re.test(txt(c))))
    }
    els = els.filter((e) => e.getClientRects().length)
    let el = els[spec.nth || 0] || null
    if (el && spec.closest) el = el.closest(spec.closest)
    return el
  },
  rect(specs, pad) {
    const list = Array.isArray(specs) ? specs : [specs]
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (const s of list) {
      const el = window.__h.find(s)
      if (!el) return null
      const r = el.getBoundingClientRect()
      x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom)
    }
    const p = pad == null ? 5 : pad
    return { x: Math.round(x1 - p), y: Math.round(y1 - p), w: Math.round(x2 - x1 + 2 * p), h: Math.round(y2 - y1 + 2 * p) }
  },
  click(spec) { const el = window.__h.find(spec); if (!el) return false; el.click(); return true },
  scroll(spec, offset) {
    const el = window.__h.find(spec)
    if (!el) return false
    const top = el.getBoundingClientRect().top + window.scrollY + (offset == null ? -24 : offset)
    window.scrollTo(0, Math.max(0, top))
    return true
  },
  set(spec, value) {
    const el = window.__h.find(spec)
    if (!el) return false
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    return true
  },
}
true`

let win
const shots = {}
const js = (code) => win.webContents.executeJavaScript(code)
const H_ = async (fn, ...args) => {
  await js(PAGE_HELPERS)
  return js(`window.__h.${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`)
}
const click = async (spec, wait = 500) => { const ok = await H_('click', spec); if (!ok) console.warn('  [!] no se encontró para clic:', JSON.stringify(spec)); await sleep(wait); return ok }
const set = async (spec, value, wait = 400) => { const ok = await H_('set', spec, value); if (!ok) console.warn('  [!] no se encontró campo:', JSON.stringify(spec)); await sleep(wait) }
const scroll = async (spec, offset, wait = 400) => { const ok = await H_('scroll', spec, offset); if (!ok) console.warn('  [!] no se encontró para desplazar:', JSON.stringify(spec)); await sleep(wait) }
const top = async () => { await js('window.scrollTo(0,0)'); await sleep(300) }
async function waitFor(re, ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await js(`${re}.test(document.body.innerText)`)) return true
    await sleep(400)
  }
  console.warn('  [!] tiempo agotado esperando', String(re))
  return false
}
async function setFile(file, index = 0) {
  const dbg = win.webContents.debugger
  if (!dbg.isAttached()) dbg.attach('1.3')
  const { root } = await dbg.sendCommand('DOM.getDocument', { depth: -1 })
  const { nodeIds } = await dbg.sendCommand('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type=file]' })
  await dbg.sendCommand('DOM.setFileInputFiles', { nodeId: nodeIds[index], files: [file] })
}
async function dismissToasts() {
  await js(`document.querySelectorAll('.toast').forEach((t) => t.remove()); true`)
}

// marks: [{ n, spec, arrow?: 'left'|'right'|'top'|'bottom', pad? }]
async function shot(name, marks = []) {
  await js(PAGE_HELPERS)
  await sleep(350)
  const out = []
  for (const m of marks) {
    const r = await js(`window.__h.rect(${JSON.stringify(m.spec)}, ${m.pad == null ? 'null' : m.pad})`)
    if (!r) { console.warn(`  [!] ${name}: marca ${m.n} no encontrada`, JSON.stringify(m.spec)); continue }
    const mark = { n: m.n, ...r }
    if (m.arrow) {
      const L = m.len || 70
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const to = { left: [r.x, cy], right: [r.x + r.w, cy], top: [cx, r.y], bottom: [cx, r.y + r.h] }[m.arrow]
      const from = { left: [to[0] - L, to[1]], right: [to[0] + L, to[1]], top: [to[0], to[1] - L], bottom: [to[0], to[1] + L] }[m.arrow]
      mark.arrow = { from, to }
    }
    out.push(mark)
  }
  const img = (await win.webContents.capturePage()).resize({ width: W })
  fs.writeFileSync(path.join(OUT_IMG, `${name}.jpg`), img.toJPEG(84))
  shots[name] = { w: W, h: Math.round(img.getSize().height), marks: out }
  console.log('captura', name, `(${out.length} marcas)`)
}

const nav = (label) => click({ sel: '.sb-item', text: `^${label}$` }, 900)

// ------------------------------------------------------------------ recorrido
async function run() {
  // Envío simulado (no abre Outlook): avanza despacio para poder capturar el progreso.
  ipcMain.removeHandler('outlook:send')
  ipcMain.handle('outlook:send', async (event, payload) => {
    const emails = payload.emails || []
    for (let i = 0; i < emails.length; i++) {
      event.sender.send('outlook:progress', { type: 'progress', current: i + 1, total: emails.length, provider: emails[i].provider })
      await sleep(i === 2 ? 4500 : 700)
    }
    return {
      results: emails.map((e, i) => ({ provider: e.provider, ok: i !== 1, message: i === 1 ? 'El buzón del destinatario está lleno.' : undefined })),
      cancelled: false,
    }
  })

  win.setContentSize(W, H)
  await sleep(2500)

  // ---- Inicio de sesión
  await shot('login', [
    { n: 1, spec: { sel: 'input[type=email]' } },
    { n: 2, spec: { sel: 'input[type=password]' } },
    { n: 3, spec: { sel: '.login-card button.btn-primary' } },
    { n: 4, spec: { sel: '.login-card .hint', text: 'cuenta' }, arrow: 'bottom', len: 50 },
  ])

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp })}.firma`
  const sess = { access_token: jwt, token_type: 'bearer', expires_in: 21600, expires_at: exp, refresh_token: 'x', user: { id: UID, email: 'analista@cruzverde.com.co', aud: 'authenticated', role: 'authenticated' } }
  await js(`localStorage.setItem('sb-sskajccqyrtaplmccsws-auth-token', ${JSON.stringify(JSON.stringify(sess))}); location.reload()`)
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(3500)

  // ---- Panel lateral
  await shot('panel-lateral', [
    { n: 1, spec: { sel: '.sb-nav' }, pad: 6 },
    { n: 2, spec: { sel: '.sb-collapse-btn' }, pad: 4, arrow: 'right', len: 60 },
    { n: 3, spec: { sel: '.sb-user' } },
    { n: 4, spec: { sel: '.sb-logout' } },
    { n: 5, spec: { sel: '.sb-version' }, pad: 4, arrow: 'right', len: 60 },
  ])

  // ---- Procesar: elegir tipo y cargar
  await shot('procesar-tipo', [
    { n: 1, spec: { sel: '.types' }, pad: 8 },
    { n: 2, spec: { sel: '.drop' } },
  ])
  await click({ sel: '.types .card', text: 'Descuentos' })
  await setFile(`${SAMPLES}/descuentos2.xlsx`)
  await waitFor(/proveedores en el archivo/)
  await sleep(1500)
  await scroll({ text: '^Carga el archivo$' })
  await shot('procesar-archivo', [
    { n: 1, spec: { sel: '.filecard .meta' } },
    { n: 2, spec: { sel: '.filecard .fc-actions' } },
    { n: 3, spec: { sel: '.field', text: 'Se separa por la columna' } },
    { n: 4, spec: { sel: '.field', text: 'Prefijo del archivo' } },
    { n: 5, spec: { sel: '.field', text: 'Columnas a incluir' } },
  ])
  await scroll({ text: '^Revisa antes de enviar$' })
  await shot('procesar-revision', [
    { n: 1, spec: { sel: '.dz-stats' } },
    { n: 2, spec: { sel: '.banner.warn', text: 'no tienen valor' } },
    { n: 3, spec: { sel: '.rev.good' } },
    { n: 4, spec: { sel: '.rev.warn' } },
  ])
  await scroll({ sel: '.no-participa' }, -140)
  await click({ sel: '.no-participa summary' })
  await shot('procesar-revision-2', [
    { n: 1, spec: { sel: '.banner.warn', text: 'no recibirán correo' } },
    { n: 2, spec: { sel: '.no-participa' } },
    { n: 3, spec: { sel: '.field', text: 'Plantilla del correo' } },
    { n: 4, spec: { sel: '.actions button', text: '^Descargar$' }, arrow: 'left' },
    { n: 5, spec: { sel: '.actions button', text: '^Enviar' }, arrow: 'top', len: 50 },
  ])

  // ---- Envío
  await click({ sel: '.actions button', text: '^Enviar' }, 800)
  await shot('enviar-confirmar', [
    { n: 1, spec: { sel: '.modal' } },
    { n: 2, spec: { sel: '.modal-actions .btn-primary' }, arrow: 'right', len: 60 },
  ])
  await click({ sel: '.modal-actions .btn-primary' }, 3500)
  await shot('enviar-progreso', [
    { n: 1, spec: { sel: '.send-modal .progress' } },
    { n: 2, spec: { sel: '.send-count' } },
    { n: 3, spec: { sel: '.send-current' } },
    { n: 4, spec: { sel: '.send-modal .btn-danger' }, arrow: 'right', len: 60 },
  ])
  await waitFor(/Envío completado|Envío cancelado/, 180000)
  await sleep(600)
  await shot('enviar-resumen', [
    { n: 1, spec: { sel: '.send-modal .rev.good' } },
    { n: 2, spec: { sel: '.send-modal .rev.warn' } },
    { n: 3, spec: { sel: '.send-modal .modal-actions .btn-primary' }, arrow: 'right', len: 60 },
  ])
  await click({ sel: '.send-modal .modal-actions .btn-primary' })
  await dismissToasts()

  // ---- Rotación: columnas de una corrida
  await top()
  await click({ sel: '.types .card', text: 'Rotación' })
  await click({ sel: '.fc-actions button', text: 'Eliminar' })
  await setFile(`${SAMPLES}/ROTACION2.xlsx`)
  await waitFor(/proveedores en el archivo/, 180000)
  await sleep(1500)
  await click({ sel: '.chips .chip', text: 'CanalVenta' }, 300)
  await click({ sel: '.chips .chip', text: 'MUNDO' }, 300)
  await scroll({ text: '^Archivo de origen$' })
  await shot('procesar-columnas', [
    { n: 1, spec: { sel: '.field', text: 'Columnas a incluir' } },
    { n: 2, spec: { sel: '.chips .chip', text: 'CanalVenta' }, arrow: 'bottom', len: 45 },
    { n: 3, spec: { sel: 'button.toggle', text: 'Marcar / desmarcar' } },
  ])
  await click({ sel: '.fc-actions button', text: 'Eliminar' })
  await click({ sel: '.types .card', text: 'PACOM' })
  await dismissToasts()

  // ---- Separador express
  await nav('Separador express')
  await top()
  await shot('express-vacio', [{ n: 1, spec: { sel: '.drop' } }])
  await setFile(`${SAMPLES}/PACOM SEPTIEMBRE.xlsx`)
  await waitFor(/¿Cómo se separa\?/)
  await sleep(1200)
  await scroll({ text: '^1 · ¿Cómo se separa\\?$' })
  await shot('express-separar', [
    { n: 1, spec: { sel: '.dz-opts', nth: 0 } },
    { n: 2, spec: { sel: '.field', text: '^Columna para separar' } },
    { n: 3, spec: { sel: '.dz-opts', nth: 1 } },
  ])
  await click({ sel: 'button', text: '^\\+ Filtro$' })
  await set({ sel: '.dz-line select', nth: 0 }, 'exclude')
  await set({ sel: '.dz-line input', nth: 0 }, 'ACTIVIDAD')
  await set({ sel: '.dz-line select', nth: 1 }, 'eq')
  await set({ sel: '.dz-line input', nth: 1 }, 'Descuentos de miedo')
  await click({ sel: 'button', text: '^\\+ Filtro$' })
  await set({ sel: '.dz-line select', nth: 2 }, 'include')
  await set({ sel: '.dz-line input', nth: 2 }, 'Descuento minimo')
  await set({ sel: '.dz-line select', nth: 3 }, 'gt')
  await set({ sel: '.dz-line input', nth: 3 }, '15%')
  await scroll({ text: '^2 · Filtrar filas' })
  await shot('express-filtros', [
    { n: 1, spec: { sel: 'button', text: '^\\+ Filtro$' }, arrow: 'left' },
    { n: 2, spec: { sel: '.dz-line select', nth: 0 } },
    { n: 3, spec: { sel: '.dz-line input', nth: 0 } },
    { n: 4, spec: { sel: '.dz-line select', nth: 1 } },
    { n: 5, spec: { sel: '.dz-line input', nth: 1 } },
    { n: 6, spec: { sel: '.dz-line button', nth: 0 } },
  ])
  await scroll({ text: '^3 · Hojas de cada archivo$' })
  await shot('express-hojas', [
    { n: 1, spec: [{ sel: 'button', text: '^\\+ Hoja con datos$' }, { sel: 'button', text: '^\\+ Hoja formulario$' }] },
    { n: 2, spec: { sel: '.dz-sheet-head input' } },
    { n: 3, spec: { sel: '.dz-sheet-head .dz-arrows' } },
    { n: 4, spec: { sel: '.dz-sheet .field', text: '^Toma los datos de la hoja' } },
    { n: 5, spec: [{ sel: '.dz-check', text: 'Si el archivo no trae' }, { sel: '.dz-check', text: '^Opcional' }] },
    { n: 6, spec: { sel: '.dz-sheet .fields', nth: 1 } },
  ])
  await scroll({ text: '^Resultado$', sel: '.step h2' })
  await click({ sel: '.chip', text: 'BABARIA' }, 300)
  await click({ sel: '.chip', text: 'BAYER' }, 300)
  await scroll({ text: '^Resultado$', sel: '.step h2' })
  await shot('express-resultado', [
    { n: 1, spec: { sel: '.dz-stats' } },
    { n: 2, spec: { sel: '.field label', text: 'Grupos a generar' } },
    { n: 3, spec: { sel: '.chip', text: 'BABARIA' }, arrow: 'bottom', len: 45 },
  ])
  await scroll({ sel: '.field', text: '^Prefijo del archivo' }, -300)
  await shot('express-descargar', [
    { n: 1, spec: { sel: '.field', text: '^Prefijo del archivo' } },
    { n: 2, spec: { sel: '.actions button', text: '^Descargar$' }, arrow: 'left' },
    { n: 3, spec: { sel: 'input', text: 'Nombre de la configuración' } },
    { n: 4, spec: { sel: 'button', text: '^Guardar configuración$' }, arrow: 'left' },
  ])

  // ---- Separaciones
  await nav('Separaciones')
  await top()
  await shot('separaciones-lista', [
    { n: 1, spec: { sel: '.tpl-items' } },
    { n: 2, spec: { sel: 'button', text: '^\\+ Nueva configuración$' } },
    { n: 3, spec: { sel: '.tpl-editor .row', nth: 0 } },
    { n: 4, spec: { sel: '.tpl-editor .field', text: '^Descripción' } },
    { n: 5, spec: { sel: 'button', text: '^Restablecer original$' }, arrow: 'left' },
  ])
  await setFile(`${SAMPLES}/PACOM SEPTIEMBRE.xlsx`)
  await waitFor(/Así quedaría con el ejemplo/)
  await sleep(1200)
  await scroll({ text: '^Excel de ejemplo$' })
  await shot('separaciones-ejemplo', [
    { n: 1, spec: { sel: '.filecard' } },
    { n: 2, spec: { sel: '.dz-opts', nth: 0 } },
    { n: 3, spec: { sel: '.dz-check', text: 'Usar para enviar correos' } },
  ])
  // Columnas elegidas en la primera hoja de datos
  await click({ sel: '.dz-check', text: '^Elegir columnas' })
  await set({ sel: '.dz-cols input', nth: 11 }, '% DESCUENTO MINIMO')
  await scroll({ sel: '.dz-check', text: '^Todas las que traiga' }, -60)
  await shot('separaciones-columnas', [
    { n: 1, spec: [{ sel: '.dz-check', text: '^Todas las que traiga' }, { sel: '.dz-check', text: '^Elegir columnas' }] },
    { n: 2, spec: { sel: '.dz-cols .dz-arrows', nth: 0 } },
    { n: 3, spec: { sel: '.dz-cols input', nth: 0 } },
    { n: 4, spec: { sel: '.dz-cols input', nth: 1 } },
    { n: 5, spec: { sel: '.dz-cols button.mini', nth: 0 } },
  ])
  await scroll({ sel: '.dz-cols input', nth: 11 }, -260)
  await shot('separaciones-columnas-2', [
    { n: 1, spec: { sel: '.dz-cols input', nth: 11 }, arrow: 'top', len: 40 },
    { n: 2, spec: { sel: '.dz-sheet .dz-line' } },
  ])
  // Hoja formulario: se ve en Descuentos (la de fábrica trae una)
  await click({ sel: 'button.tpl-card', text: 'Descuentos' }, 800)
  if (await js(`/Descartar cambios/.test(document.body.innerText)`)) await click({ sel: '.modal-actions .btn-danger' }, 900)
  await scroll({ sel: '.dz-sheet-head .tag.form' }, -40)
  await shot('separaciones-formulario', [
    { n: 1, spec: { sel: '.dz-sheet-head .tag.form' }, arrow: 'left', len: 50 },
    { n: 2, spec: { sel: '.dz-sheet textarea' } },
    { n: 3, spec: { sel: '.dz-sheet .dz-cols', nth: 0 } },
    { n: 4, spec: { sel: '.dz-sheet .dz-color', nth: 0 }, arrow: 'top', len: 40 },
    { n: 5, spec: { sel: 'button', text: '^\\+ Encabezado$' } },
  ])
  await scroll({ text: '^Así quedaría con el ejemplo$' })
  await shot('separaciones-vista-previa', [
    { n: 1, spec: { sel: '.dz-stats' } },
    { n: 2, spec: { sel: 'button', text: '^Descargar ejemplo' }, arrow: 'left' },
  ])
  // Historial: volver a PACOM (tiene 3 versiones de ejemplo)
  await click({ sel: 'button.tpl-card', text: 'PACOM' }, 800)
  if (await js(`/Descartar cambios/.test(document.body.innerText)`)) await click({ sel: '.modal-actions .btn-danger' }, 900)
  await scroll({ text: '^Nota de esta versión' }, -120)
  await shot('separaciones-historial', [
    { n: 1, spec: { sel: 'input', text: 'agregué la columna' } },
    { n: 2, spec: { sel: 'button', text: '^Guardar nueva versión$' }, arrow: 'left' },
    { n: 3, spec: { sel: '.tbl th', text: '^Usos$' }, arrow: 'top', len: 40 },
    { n: 4, spec: { sel: '.badge.on', text: '^actual$' } },
    { n: 5, spec: { sel: '.tbl button', text: '^Restaurar$' }, arrow: 'right', len: 50 },
  ])

  // ---- Proveedores
  await nav('Proveedores')
  await top()
  await shot('proveedores-todos', [
    { n: 1, spec: { sel: '.ptabs' } },
    { n: 2, spec: { sel: '.glass .row', nth: 0 } },
    { n: 3, spec: { sel: 'button', text: '^Descargar plantilla$' }, arrow: 'left' },
    { n: 4, spec: { sel: 'button', text: '^Subir Excel de proveedores$' } },
  ])
  await scroll({ text: '^Lista de proveedores' }, -70)
  await shot('proveedores-lista', [
    { n: 1, spec: { sel: 'input', text: '^Buscar' } },
    { n: 2, spec: { sel: 'button.mini.del', text: '^Eliminar todos$' } },
    { n: 3, spec: { sel: '.tbl tbody tr', nth: 0 } },
    { n: 4, spec: { sel: '.tbl .badge.off' }, arrow: 'left', len: 50 },
    { n: 5, spec: [{ sel: '.tbl button.mini.edit', nth: 0 }, { sel: '.tbl button.mini.del', nth: 0 }] },
  ])
  await top()
  await click({ sel: '.ptabs button', text: '^Descuentos' }, 900)
  await shot('proveedores-tipo', [
    { n: 1, spec: { sel: '.ptabs button', text: '^Descuentos' } },
    { n: 2, spec: [{ sel: 'button', text: '^Marcar todos$' }, { sel: 'button', text: '^Quitar todos$' }] },
    { n: 3, spec: { sel: '.glass .row', text: 'Asignar esa copia' } },
    { n: 4, spec: { sel: '.prov-row .cc-select', nth: 0 } },
    { n: 5, spec: { sel: '.prov-row .switch', nth: 0 }, arrow: 'left', len: 50 },
  ])

  // ---- Copias (CC)
  await nav('Copias \\(CC\\)')
  await top()
  await shot('cc', [
    { n: 1, spec: { sel: '.tpl-items' } },
    { n: 2, spec: { sel: 'button', text: '^\\+ Nueva configuración$' } },
    { n: 3, spec: [{ sel: '.tpl-editor .field', text: '^Nombre de la configuración' }, { sel: '.tpl-editor .field', text: '^Correos en copia' }] },
    { n: 4, spec: { sel: 'button', text: '^Guardar configuración$' }, arrow: 'left' },
    { n: 5, spec: { sel: '.fields', text: 'PACOM' } },
  ])

  // ---- Plantilla
  await nav('Plantilla')
  await top()
  await sleep(800)
  await shot('plantilla', [
    { n: 1, spec: { sel: '.tpl-items' } },
    { n: 2, spec: { sel: 'button', text: '^\\+ Nueva plantilla$' } },
    { n: 3, spec: [{ sel: 'button.mini.edit', text: '^Duplicar$' }, { sel: 'button.mini.del', text: '^Eliminar$' }] },
    { n: 4, spec: { sel: '.tpl-editor .field', text: '^Asunto' } },
    { n: 5, spec: { sel: '.rich-toolbar' } },
  ])
  await scroll({ sel: '.tpl-editor .hint', text: 'Insertar variable' }, -380)
  await shot('plantilla-2', [
    { n: 1, spec: { sel: '.rich-wrap' } },
    { n: 2, spec: { sel: '.tpl-editor .hint', text: 'Insertar variable' } },
    { n: 3, spec: { sel: 'button', text: '^Guardar plantilla$' }, arrow: 'left' },
  ])
  await scroll({ text: '^Vista previa$' })
  await shot('plantilla-vista-previa', [
    { n: 1, spec: { sel: '.inset', text: '^Asunto' } },
    { n: 2, spec: { sel: '.preview-body' } },
  ])

  // ---- Configuración
  await nav('Configuración')
  await top()
  await shot('configuracion-perfil', [
    { n: 1, spec: { sel: '.avatar-lg' } },
    { n: 2, spec: { sel: '.field', text: '^Nombre para mostrar' } },
    { n: 3, spec: { sel: 'button', text: '^Cambiar foto$' } },
    { n: 4, spec: { sel: 'button', text: '^Guardar perfil$' }, arrow: 'left' },
  ])
  await scroll({ sel: '.section-title', text: '^Cuenta$' })
  await shot('configuracion-cuenta', [
    { n: 1, spec: [{ sel: '.field', text: '^Nueva contraseña' }, { sel: '.field', text: '^Repite la contraseña' }] },
    { n: 2, spec: { sel: 'button', text: '^Cambiar contraseña$' }, arrow: 'left' },
    { n: 3, spec: { sel: 'button', text: '^Buscar actualización ahora$' } },
  ])

  // ---- Aviso de actualización (GitHub simulado con una versión más nueva)
  showUpdate = true
  await js('location.reload()')
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(4000)
  await top()
  await shot('actualizacion-aviso', [
    { n: 1, spec: { sel: '.app-main .glass', nth: 0 } },
    { n: 2, spec: { sel: 'button', text: '^Descargar e instalar$' }, arrow: 'bottom', len: 50 },
    { n: 3, spec: { sel: 'button', text: '^Ahora no$' } },
  ])
  await nav('Configuración')
  await click({ sel: 'button', text: '^Buscar actualización ahora$' }, 2500)
  await scroll({ sel: '.section-title', text: '^Actualizaciones$' })
  await shot('actualizacion-configuracion', [
    { n: 1, spec: { sel: 'p.muted', text: '^Versión instalada' } },
    { n: 2, spec: { sel: 'button', text: '^Buscar actualización ahora$' } },
    { n: 3, spec: { sel: '.banner.warn', text: 'nueva versión' } },
    { n: 4, spec: { sel: '.banner.warn button', text: '^Descargar e instalar$' }, arrow: 'left' },
  ])

  // Panel lateral colapsado
  await nav('Procesar archivo')
  await click({ sel: '.sb-collapse-btn' }, 900)
  await shot('panel-colapsado', [{ n: 1, spec: { sel: '.sidebar' }, pad: 0 }])
}

app.on('browser-window-created', async (_e, w) => {
  win = w
  try {
    await seedConfigs()
    session.defaultSession.protocol.handle('https', mock)
    await new Promise((r) => (w.webContents.isLoading() ? w.webContents.once('did-finish-load', r) : r()))
    await run()
    fs.writeFileSync(OUT_JSON, JSON.stringify(shots, null, 1))
    console.log(`\nListo: ${Object.keys(shots).length} capturas en src/assets/help y src/help/shots.json`)
  } catch (e) {
    console.error('ERROR', e)
  } finally {
    setTimeout(() => app.exit(0), 300)
  }
})
