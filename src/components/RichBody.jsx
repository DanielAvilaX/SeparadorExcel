import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

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
    return dataUrl // si algo falla, se usa la original
  }
}

const RichBody = forwardRef(function RichBody({ value, onChange, placeholder }, ref) {
  const el = useRef(null)
  const fileRef = useRef(null)
  const lastEmitted = useRef(null)
  const [empty, setEmpty] = useState(true)

  // Sincroniza solo cuando el valor viene de afuera (evita saltos del cursor al escribir)
  useEffect(() => {
    if (!el.current) return
    if (value !== lastEmitted.current) {
      el.current.innerHTML = value || ''
      lastEmitted.current = value
      setEmpty(!el.current.textContent.trim() && !el.current.querySelector('img'))
    }
  }, [value])

  function emit() {
    if (!el.current) return
    const html = el.current.innerHTML
    lastEmitted.current = html
    setEmpty(!el.current.textContent.trim() && !el.current.querySelector('img'))
    onChange(html)
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
    // Texto: se pega plano para no arrastrar formato raro de Word/Outlook
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

  return (
    <>
      <div className="rich-toolbar">
        <button type="button" className="toggle" onClick={() => fileRef.current.click()}>🖼️ Insertar imagen</button>
        <span className="muted">También puedes <b>pegar</b> (Ctrl+V) o arrastrar imágenes aquí.</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={async (e) => {
            for (const f of Array.from(e.target.files || [])) await insertImageFile(f)
            e.target.value = ''
          }}
        />
      </div>
      <div className="rich-wrap">
        <div
          ref={el}
          className="rich-body"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
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
