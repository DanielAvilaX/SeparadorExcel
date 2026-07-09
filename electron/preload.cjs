const { contextBridge, ipcRenderer } = require('electron')

// Puente seguro: el renderer (React) solo ve estas funciones.
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  // emails: [{ to:[], cc:[], subject, body, attachmentName, attachmentB64 }]
  sendEmails: (emails) => ipcRenderer.invoke('outlook:send', { emails }),
  onProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('outlook:progress', handler)
    return () => ipcRenderer.removeListener('outlook:progress', handler)
  },
})
