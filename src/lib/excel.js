import JSZip from 'jszip'

// Utilidades de archivos. La lectura/separación de Excel vive en src/lib/splitter/.

// Descarga lo generado: un solo archivo va como .xlsx; varios, en un ZIP.
export async function downloadFiles(files, zipName) {
  if (files.length === 1) {
    downloadBlob(new Blob([files[0].buffer]), files[0].filename)
    return
  }
  const zip = new JSZip()
  files.forEach((f) => zip.file(f.filename, f.buffer))
  downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName)
}

// ArrayBuffer -> base64 (para pasar adjuntos al proceso de Electron).
export function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
