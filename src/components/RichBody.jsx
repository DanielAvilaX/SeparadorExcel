import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

// --- Iconos (Material, trazo simple) ---
const ICONS = {
  bold: 'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
  italic: 'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z',
  underline: 'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
  bullets: 'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
  size: 'M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z',
  color: 'M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  clear: 'M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z',
}

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

// Colores rápidos (el primero es el verde Cruz Verde)
const PRESETS = ['#00A651', '#00713A', '#000000', '#5B5B5B', '#C00000', '#0070C0', '#FF8A00', '#7030A0']

// Tamaños de execCommand('fontSize') 1..7 con su equivalente aproximado
const SIZES = [
  { v: 1, pt: '8 pt' }, { v: 2, pt: '10 pt' }, { v: 3, pt: '12 pt' },
  { v: 4, pt: '14 pt' }, { v: 5, pt: '18 pt' }, { v: 6, pt: '24 pt' }, { v: 7, pt: '36 pt' },
]

// Reduce imágenes muy grandes para que el correo no pese de más.
async function fileToDataUrl(file, maxW = 1200) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = dataUrl
    })
    if (img.width <= maxW) return dataUrl
    const scale = maxW / img.width
    const canvas = document.createElement('canvas')
    canvas.width = maxW
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const isJpeg = /^data:image\/jpe?g/i.test(dataUrl)
    return isJpeg ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png')
  } catch {
    return dataUrl
  }
}

const RichBody = forwardRef(function RichBody({ value, onChange, placeholder, onFocus }, ref) {
  const el = useRef(null)
  const fileRef = useRef(null)
  const colorRef = useRef(null)
  const lastEmitted = useRef(null)
  const savedRange = useRef(null)
  const [empty, setEmpty] = useState(true)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [color, setColor] = useState('#00A651')

  // Sincroniza solo cuando el valor viene de afuera (evita saltos del cursor al escribir)
  useEffect(() => {
    if (!el.current) return
    if (value !== lastEmitted.current) {
      el.current.innerHTML = value || ''
      lastEmitted.current = value
      setEmpty(!el.current.textContent.trim() && !el.current.querySelector('img'))
    }
  }, [value])

  // Recuerda la selección dentro del editor (para restaurarla tras usar el color)
  useEffect(() => {
    function onSelChange() {
      const s = window.getSelection()
      if (s && s.rangeCount && el.current && el.current.contains(s.anchorNode)) {
        savedRange.current = s.getRangeAt(0).cloneRange()
      }
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [])

  function restoreSel() {
    const r = savedRange.current
    if (!r || !el.current) return
    el.current.focus()
    const s = window.getSelection()
    s.removeAllRanges()
    s.addRange(r)
  }

  function emit() {
    if (!el.current) return
    const html = el.current.innerHTML
    lastEmitted.current = html
    setEmpty(!el.current.textContent.trim() && !el.current.querySelector('img'))
    onChange(html)
  }

  // styleWithCSS=false -> genera <b>, <font> ... que Outlook interpreta sin problemas
  function exec(cmd, val) {
    el.current.focus()
    document.execCommand('styleWithCSS', false, false)
    document.execCommand(cmd, false, val)
    emit()
  }

  function insertHtml(html) {
    el.current.focus()
    document.execCommand('insertHTML', false, html)
    emit()
  }

  async function insertImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = await fileToDataUrl(file)
    insertHtml(`<img src="${url}" style="max-width:100%;height:auto;" />`)
  }

  useImperativeHandle(ref, () => ({
    insertText: (text) => {
      el.current.focus()
      document.execCommand('insertText', false, text)
      emit()
    },
    focus: () => el.current && el.current.focus(),
  }))

  async function onPaste(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const images = items.filter((i) => i.type.startsWith('image/'))
    if (images.length) {
      e.preventDefault()
      for (const it of images) await insertImageFile(it.getAsFile())
      return
    }
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emit()
  }

  async function onDrop(e) {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    e.preventDefault()
    for (const f of files) await insertImageFile(f)
  }

  // No robar el foco del editor al hacer clic en la barra
  const keep = (e) => e.preventDefault()

  return (
    <>
      <div className="rich-toolbar" onMouseDown={keep}>
        <button type="button" className="icon-btn" title="Negrita" onClick={() => exec('bold')}><Icon d={ICONS.bold} /></button>
        <button type="button" className="icon-btn" title="Cursiva" onClick={() => exec('italic')}><Icon d={ICONS.italic} /></button>
        <button type="button" className="icon-btn" title="Subrayado" onClick={() => exec('underline')}><Icon d={ICONS.underline} /></button>
        <span className="tb-sep" />
        <button type="button" className="icon-btn" title="Viñetas" onClick={() => exec('insertUnorderedList')}><Icon d={ICONS.bullets} /></button>
        <span className="tb-sep" />

        <span className="tb-pop-wrap">
          <button type="button" className={'icon-btn' + (sizeOpen ? ' on' : '')} title="Tamaño de letra"
            onClick={() => setSizeOpen((v) => !v)}><Icon d={ICONS.size} /></button>
          {sizeOpen && (
            <div className="size-pop" onMouseDown={keep}>
              {SIZES.map((s) => (
                <button key={s.v} type="button" onClick={() => { exec('fontSize', s.v); setSizeOpen(false) }}>
                  {s.pt}
                </button>
              ))}
            </div>
          )}
        </span>

        <span className="tb-pop-wrap">
          <button type="button" className={'icon-btn' + (colorOpen ? ' on' : '')} title="Color de letra"
            onClick={() => setColorOpen((v) => !v)}>
            <Icon d={ICONS.color} />
            <span className="color-bar" style={{ background: color }} />
          </button>
          {colorOpen && (
            <div className="color-pop" onMouseDown={keep}>
              <div className="swatches">
                {PRESETS.map((c) => (
                  <button key={c} type="button" title={c}
                    className={'swatch' + (c.toLowerCase() === color.toLowerCase() ? ' on' : '')}
                    style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
              <div className="color-row">
                <input ref={colorRef} type="color" value={color}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setColor(e.target.value)} />
                <button type="button" className="btn btn-primary color-apply"
                  onClick={() => { restoreSel(); exec('foreColor', color); setColorOpen(false) }}>
                  Cambiar
                </button>
              </div>
            </div>
          )}
        </span>

        <span className="tb-sep" />
        <button type="button" className="icon-btn" title="Insertar imagen" onClick={() => fileRef.current.click()}>
          <Icon d={ICONS.image} />
        </button>
        <button type="button" className="icon-btn" title="Quitar formato" onClick={() => exec('removeFormat')}>
          <Icon d={ICONS.clear} />
        </button>

        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={async (e) => {
            for (const f of Array.from(e.target.files || [])) await insertImageFile(f)
            e.target.value = ''
          }} />
      </div>

      <div className="rich-wrap">
        <div
          ref={el}
          className="rich-body"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onFocus={onFocus}
          onPaste={onPaste}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        />
        {empty && <div className="rich-placeholder">{placeholder}</div>}
      </div>
    </>
  )
})

export default RichBody
