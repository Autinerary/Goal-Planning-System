const { contextBridge, ipcRenderer } = require('electron')

/**
 * The only bridge between the mascot renderer and the main process.
 *
 * Deliberately three named, argument-checked functions rather than exposing
 * ipcRenderer — the renderer should never be able to send arbitrary IPC.
 */
contextBridge.exposeInMainWorld('autinerary', {
  openApp: () => ipcRenderer.send('mascot:open-app'),
  currentTask: () => ipcRenderer.invoke('mascot:current-task'),
  drag: (dx, dy) => {
    if (typeof dx === 'number' && typeof dy === 'number') {
      ipcRenderer.send('mascot:drag', { dx, dy })
    }
  },
})
