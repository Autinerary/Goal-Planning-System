const { contextBridge, ipcRenderer } = require('electron')

/**
 * In a sign-up window (a service's own page): lets the kit say a page of the
 * form is done, just before it is sent, so a page load can't lose that.
 * The only thing it can send is a page number.
 */
contextBridge.exposeInMainWorld('__autinerarySignupEvent', (e) => {
  if (e && e.type === 'page_done' && Number.isInteger(e.page)) ipcRenderer.send('signup:event', { page: e.page })
})
