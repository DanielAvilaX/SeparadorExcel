import { useState, useEffect, useMemo } from 'react'
import TypeSelector from '../components/TypeSelector'
import Uploader from '../components/Uploader'
import Spinner from '../components/Spinner'
import HoverPreview from '../components/HoverPreview'
import TemplatePreview from '../components/TemplatePreview'
import RunPreview, { usePrepared } from '../components/RunPreview'
import { toast } from '../lib/toast'
import { confirmDialog } from '../lib/confirm'
import { buildFiles, sanitizeFileName } from '../lib/splitter/engine'
import { downloadFiles, arrayBufferToBase64 } from '../lib/excel'
import { isConfigured } from '../lib/supabase'
import { listProviders } from '../lib/providers'
import { listSettings, enviaOf, ccOf } from '../lib/participation'
import { listCcConfigs, getCcDefaults, resolveCc } from '../lib/cc'
import { registerUse } from '../lib/configs'
import { listTemplates, render, bodyToHtml, extractInlineImages, wrapEmailHtml } from '../lib/template'

const isDesktop = typeof window !== 'undefined' && window.desktop && window.desktop.isDesktop

// Cruce Excel <-> base sin depender de mayúsculas ni espacios repetidos: "Abbott  S.A.S" en el
// Excel y "ABBOTT S.A.S" en la base son el mismo proveedor.
const providerKey = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toUpperCase()

const sendsEmail = (def) => !!def?.email && def.split?.by === 'column' && def.output === 'files'

export default function ProcesarView({ state, setState, runSend, sendActive, configs }) {
  const { typeKey, wb, file, prefix, selectedCols, selectedGroups, templateId } = state
  const patch = (p) => setState((s) => ({ ...s, ...p }))

  const [db, setDb] = useState([])
  const [settings, setSettings] = useState(new Map())
  const [dbLoaded, setDbLoaded] = useState(false)
  const [templates, setTemplates] = useState([])
  const [ccConfigs, setCcConfigs] = useState([])
  const [ccDefaults, setCcDefaults] = useState({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [preparing, setPreparing] = useState(false)

  const cfg = configs.find((c) => c.key === typeKey) || configs[0]
  const { prepared, error } = usePrepared(wb, cfg?.definition, 0)
  const emailMode = sendsEmail(cfg?.definition)

  // Se ejecuta en cada montaje (incluido al volver a la pestaña) → refresca la base
  // para reflejar proveedores/plantillas/CC sin re-subir el archivo.
  useEffect(() => {
    if (!isConfigured()) { setDbLoaded(true); return }
    Promise.all([listProviders(), listSettings()])
      .then(([rows, s]) => { setDb(rows); setSettings(s) })
      .catch((e) => console.error('No se pudo cargar proveedores:', e.message))
      .finally(() => setDbLoaded(true))
    listTemplates()
      .then((rows) => {
        setTemplates(rows)
        if (rows.length && !rows.some((r) => r.id === templateId)) patch({ templateId: rows[0].id })
      })
      .catch((e) => console.error('No se pudieron cargar plantillas:', e.message))
    listCcConfigs().then(setCcConfigs).catch((e) => console.error('CC configs:', e.message))
    getCcDefaults().then(setCcDefaults).catch((e) => console.error('CC defaults:', e.message))
  }, [])

  const dbIndex = useMemo(() => {
    const m = new Map()
    db.forEach((p) => m.set(providerKey(p.nombre), p))
    return m
  }, [db])
  const findDb = (name) => dbIndex.get(providerKey(name))

  const columnChoices = prepared?.columnChoices || null
  // Columnas de una corrida (solo configuraciones de una hoja con "todas las columnas", ej. Rotación).
  const columnsOverride = columnChoices && selectedCols ? columnChoices.filter((c) => selectedCols.includes(c)) : null

  const match = useMemo(() => {
    if (!prepared || !emailMode) return null
    const conCorreo = []
    const sinCorreo = []
    const noParticipa = []
    for (const name of prepared.groupKeys) {
      const p = findDb(name)
      if (!p) { sinCorreo.push({ name, reason: 'no está en la base' }); continue }
      if (!enviaOf(p, cfg, settings)) { noParticipa.push({ name }); continue }
      if (p.activo && (p.emails || []).length > 0) conCorreo.push({ name, emails: p.emails })
      else sinCorreo.push({ name, reason: !p.activo ? 'inactivo' : 'sin correo' })
    }
    return { conCorreo, sinCorreo, noParticipa }
  }, [prepared, dbIndex, cfg, settings, emailMode])

  function selectType(key) { patch({ typeKey: key, selectedCols: null, selectedGroups: null }) }
  function onLoaded(book, f) { patch({ wb: book, file: f, selectedCols: null, selectedGroups: null }) }
  function clearFile() { patch({ wb: null, file: null, selectedCols: null, selectedGroups: null }) }
  function toggleCol(c) {
    const current = selectedCols || columnChoices
    patch({ selectedCols: current.includes(c) ? current.filter((x) => x !== c) : [...current, c] })
  }
  function toggleAll() {
    const current = selectedCols || columnChoices
    patch({ selectedCols: current.length === columnChoices.length ? [] : null })
  }

  const zipName = `${cfg?.builtin ? cfg.key : sanitizeFileName(cfg?.label || 'separado')}_DOCUMENTOS_SEPARADOS.zip`

  async function handleGenerate() {
    if (!prepared) return
    setBusy(true)
    setProgress(null)
    try {
      const only = !emailMode && selectedGroups ? [...selectedGroups] : null
      if (only && !only.length) { toast.error('No hay grupos marcados para generar.'); return }
      const files = await buildFiles(prepared, {
        prefix, columnsOverride, onlyGroups: only, baseName: cfg.label,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      await downloadFiles(files, zipName)
      registerUse(cfg)
      toast.success(`Listo · ${files.length} archivo${files.length === 1 ? '' : 's'}.`)
      if (files.skippedRows > 0) {
        toast.error(`⚠ ${files.skippedRows} fila${files.skippedRows === 1 ? '' : 's'} sin valor en "${cfg.definition.split.column}" no se incluyeron en ningún archivo.`)
      }
    } catch (e) {
      console.error(e); toast.error('Error generando los archivos: ' + (e.message || e))
    } finally { setBusy(false); setProgress(null) }
  }

  async function handleSend() {
    const targets = match ? match.conCorreo : []
    if (!targets.length) return
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return toast.error('Elige una plantilla antes de enviar.')
    const ok = await confirmDialog({
      title: 'Enviar correos',
      message: `Se enviarán ${targets.length} correos desde tu Outlook usando la plantilla "${tpl.nombre}", uno por proveedor con su archivo adjunto. ¿Continuar?`,
      confirmText: `Enviar ${targets.length}`,
    })
    if (!ok) return

    setPreparing(true)
    try {
      // Configuraciones de CC frescas (cascada: excepción del proveedor → default del tipo → General)
      const [freshConfigs, freshDefaults] = await Promise.all([listCcConfigs(), getCcDefaults()])
      const mes = new Date().toLocaleDateString('es', { month: 'long' })

      const files = await buildFiles(prepared, { prefix, columnsOverride, onlyGroups: targets.map((t) => t.name) })
      const fileMap = new Map(files.map((f) => [f.group, f]))

      const emails = targets.map((t) => {
        const f = fileMap.get(t.name)
        const vars = { proveedor: t.name, correos: t.emails.join(', '), mes }
        // El cuerpo es HTML (puede traer imágenes pegadas): se extraen como imágenes
        // en línea (CID) porque Outlook no renderiza base64 embebido.
        const { html, images } = extractInlineImages(render(bodyToHtml(tpl.cuerpo), vars))
        const ccConfig = resolveCc(ccOf(findDb(t.name), cfg, settings), cfg.key, freshConfigs, freshDefaults)
        return {
          provider: t.name,
          to: t.emails,
          cc: ccConfig ? ccConfig.emails : [],
          subject: render(tpl.asunto, vars),
          bodyHtml: wrapEmailHtml(html),
          inlineImages: images,
          attachmentName: f ? f.filename : `${t.name}.xlsx`,
          attachmentB64: f ? arrayBufferToBase64(f.buffer) : '',
        }
      })

      registerUse(cfg)
      // El envío y su modal de progreso se manejan a nivel App (sobreviven cambios de pestaña)
      runSend(emails)
    } catch (e) {
      console.error(e); toast.error('Error al preparar el envío: ' + e.message)
    } finally {
      setPreparing(false)
    }
  }

  if (!cfg) return null
  const crossing = isConfigured() && !dbLoaded
  const def = cfg.definition
  const sheetNames = def.sheets.map((s) => `"${s.name}"`).join(' + ')

  return (
    <>
      {/* Paso 1 */}
      <div className="step">
        <span className="n">1</span><h2>¿Qué archivo vas a procesar?</h2><span className="sub">· elige el tipo (se crean y editan en Separaciones)</span>
      </div>
      <TypeSelector configs={configs} selected={cfg.key} onSelect={selectType} />

      {/* Paso 2 */}
      <div className="step"><span className="n">2</span><h2>Carga el archivo</h2></div>
      <div className="glass">
        <div className="glass-head">
          <h2>Archivo de origen</h2>
          <span className="pill-type">Tipo: {cfg.label}</span>
        </div>

        <Uploader file={file} onLoaded={onLoaded} onClear={clearFile} label={cfg.label}
          hint={`Hojas de salida: ${sheetNames} · .xlsx, .xls`} />

        {wb && (
          <>
            <div className="fields">
              <div className="field">
                <label>{def.split?.by === 'column' ? 'Se separa por la columna' : 'Separación'}</label>
                <div className="inset">
                  {def.split?.by === 'column' ? def.split.column : def.split?.by === 'rows' ? `Cada ${def.split.size} filas` : 'Sin separar'}
                  <span className="tag">{cfg.version ? `v${cfg.version}` : 'original'}</span>
                </div>
              </div>
              <div className="field">
                <label>Prefijo del archivo (opcional)</label>
                <div className="inset">
                  <input value={prefix} onChange={(e) => patch({ prefix: e.target.value })} placeholder="Ej: PACOM_Agosto_" />
                </div>
              </div>
            </div>

            {error && <div className="banner bad" style={{ marginTop: 16 }}>{error}</div>}

            {columnChoices && (
              <>
                <div className="spacer" />
                <div className="field">
                  <label>Columnas a incluir en cada archivo</label>
                  <div className="chips" style={{ maxHeight: 'none' }}>
                    {columnChoices.map((c) => {
                      const on = !selectedCols || selectedCols.includes(c)
                      return (
                        <button key={c} type="button" className={'chip ' + (on ? 'g' : 'w')} onClick={() => toggleCol(c)}>
                          {on ? '✓ ' : '＋ '}{c}
                        </button>
                      )
                    })}
                  </div>
                  <div className="hint">
                    <button className="toggle" type="button" onClick={toggleAll}>Marcar / desmarcar todas</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Paso 3 */}
      {prepared && (
        <>
          <div className="step">
            <span className="n">3</span><h2>{emailMode ? 'Revisa antes de enviar' : 'Resultado'}</h2>
            {prepared.def.split?.by !== 'none' && <span className="sub">· {prepared.groupKeys.length} {emailMode ? 'proveedores' : 'grupos'} en el archivo</span>}
          </div>
          <div className="glass">
            <RunPreview
              prepared={prepared}
              hideGroups={emailMode}
              selected={selectedGroups}
              onSelectedChange={emailMode ? undefined : (s) => patch({ selectedGroups: s })}
            />

            {emailMode && (crossing ? (
              <div className="loader-row"><Spinner /> Cruzando con la base de proveedores…</div>
            ) : (
              <>
                {!isConfigured() && (
                  <div className="banner warn">Supabase no está configurado; no se puede cruzar contra la base.</div>
                )}
                {isConfigured() && db.length === 0 && (
                  <div className="banner warn">
                    La base de proveedores está vacía. Ve a <b>Proveedores</b> y carga la lista para saber quién recibe correo.
                  </div>
                )}

                <div className="review-grid">
                  <div className="rev good">
                    <h4><span className="dot" /> Recibirán correo <span className="count">{match.conCorreo.length}</span></h4>
                    {match.conCorreo.length === 0
                      ? <p className="muted">Ninguno coincide con la base todavía.</p>
                      : (
                        <div className="chips">
                          {match.conCorreo.map((p) => {
                            const cc = resolveCc(ccOf(findDb(p.name), cfg, settings), cfg.key, ccConfigs, ccDefaults)
                            const tip = `Para: ${p.emails.join(', ')}\nCC (${cc ? cc.nombre : 'sin copia'}): ${cc && cc.emails.length ? cc.emails.join(', ') : '—'}`
                            return <span key={p.name} className="chip g" title={tip}>{p.name}</span>
                          })}
                        </div>
                      )}
                  </div>
                  <div className="rev warn">
                    <h4><span className="dot" /> Sin correo en la base <span className="count">{match.sinCorreo.length}</span></h4>
                    {match.sinCorreo.length === 0
                      ? <p className="muted">Todos los proveedores tienen correo. 🎉</p>
                      : <div className="chips">{match.sinCorreo.map((p) => <span key={p.name} className="chip w" title={p.reason}>{p.name}</span>)}</div>}
                  </div>
                </div>

                {match.sinCorreo.length > 0 && (
                  <div className="banner warn" style={{ marginTop: 16 }}>
                    Los de la derecha <b>no recibirán correo</b>. Agrégalos en <b>Proveedores</b> y al volver a esta
                    pestaña se recalcula solo (sin re-subir el archivo). No bloquea la descarga.
                  </div>
                )}

                {match.noParticipa.length > 0 && (
                  <details className="no-participa">
                    <summary>
                      <span className="dot" /> No participan en <b>{cfg.label}</b>
                      <span className="count">{match.noParticipa.length}</span>
                      <span className="muted"> · excluidos a propósito</span>
                    </summary>
                    <div className="chips" style={{ marginTop: 12 }}>
                      {match.noParticipa.map((p) => <span key={p.name} className="chip gray">{p.name}</span>)}
                    </div>
                    <p className="hint" style={{ marginTop: 10 }}>
                      Están en el archivo pero los apagaste para {cfg.label} en <b>Proveedores</b>. Si alguno debería
                      recibir, enciéndelo allí y vuelve aquí.
                    </p>
                  </details>
                )}

                {isDesktop && match.conCorreo.length > 0 && (
                  <div className="field" style={{ marginTop: 18 }}>
                    <label>Plantilla del correo</label>
                    {templates.length === 0 ? (
                      <p className="hint" style={{ marginTop: 0 }}>No hay plantillas. Crea una en la pestaña <b>Plantilla</b>.</p>
                    ) : (
                      <>
                        <div className="chips" style={{ maxHeight: 'none' }}>
                          {templates.map((t) => (
                            <HoverPreview key={t.id} content={<TemplatePreview tpl={t} />}>
                              <button type="button" className={'chip ' + (t.id === templateId ? 'g' : 'w')}
                                disabled={sendActive} onClick={() => patch({ templateId: t.id })}>
                                {t.id === templateId ? '● ' : ''}{t.nombre}
                              </button>
                            </HoverPreview>
                          ))}
                        </div>
                        <p className="hint" style={{ marginTop: 6 }}>Pasa el mouse sobre una plantilla para ver su contenido.</p>
                      </>
                    )}
                  </div>
                )}

                {isDesktop ? (
                  <p className="hint">
                    Cada proveedor recibirá su archivo adjunto por correo, desde tu Outlook, con la plantilla elegida y
                    su <b>copia (CC)</b> según lo configurado (pasa el mouse sobre un proveedor en verde para ver a quién va y con qué copia).
                  </p>
                ) : (
                  <p className="hint">El envío por correo está disponible en la <b>app de escritorio</b>. Aquí (web) puedes descargar el ZIP con un Excel por proveedor.</p>
                )}
              </>
            ))}

            <div className="actions">
              <button
                className={'btn ' + (emailMode && isDesktop ? 'btn-ghost' : 'btn-primary')}
                disabled={busy || preparing || sendActive || (columnsOverride && !columnsOverride.length)}
                onClick={handleGenerate}
              >
                {busy ? <><Spinner /> {progress ? `Generando ${progress.done}/${progress.total}…` : 'Generando…'}</> : 'Descargar'}
              </button>
              {emailMode && isDesktop && match && match.conCorreo.length > 0 && (
                <button className="btn btn-primary" disabled={preparing || sendActive || busy} onClick={handleSend}>
                  {preparing
                    ? <><Spinner light /> Preparando…</>
                    : `Enviar ${match.conCorreo.length} correo${match.conCorreo.length === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
