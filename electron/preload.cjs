const { contextBridge, ipcRenderer } = require('electron')

// Puente seguro: el renderer (React) solo ve estas funciones.
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  // emails: [{ to:[], cc:[], subject, body, attachmentName, attachmentB64 }]
  sendEmails: (emails) => ipcRenderer.invoke('outlook:send', { emails }),
  cancelSend: () => ipcRenderer.invoke('outlook:cancel'),
  onProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('outlook:progress', handler)
    return () => ipcRenderer.removeListener('outlook:progress', handler)
  },
  // Descarga + prepara una actualización (ver electron/updater.cjs). Devuelve cuando ya quedó
  // lista para instalarse -- no cierra la app sola, eso lo decide confirmCloseForUpdate().
  downloadUpdate: (url) => ipcRenderer.invoke('update:download', { url }),
  onUpdateProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },
  confirmCloseForUpdate: () => ipcRenderer.invoke('update:confirm-close'),
})
