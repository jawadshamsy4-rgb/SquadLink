const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('squadlinkDesktop', {
  isDesktop: true,
  getExactLocation: () => ipcRenderer.invoke('get-windows-location'),
})
