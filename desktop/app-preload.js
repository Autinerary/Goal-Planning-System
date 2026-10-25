const { contextBridge, ipcRenderer } = require('electron')

/**
 * The main window's only bridge (the web app is remote content): one-click
 * sign-up (main.js, signup:*). Two named, argument-checked functions; the
 * main process also checks the call comes from the Autinerary app itself.
 */
contextBridge.exposeInMainWorld('autineraryDesktop', {
  signupInfo: () => ipcRenderer.invoke('signup:info'),
  // After a hand-over (needs_you): how the sign-up ended once the person finished the step.
  onSignupUpdate: (callback) => {
    if (typeof callback !== 'function') return
    ipcRenderer.on('signup:update', (_e, update) => callback(update))
  },
  signUp: (service, person) => {
    if (typeof service !== 'string' || !person || typeof person !== 'object') return Promise.resolve({ status: 'failed', detail: 'bad request' })
    const clean = { firstName: String(person.firstName || ''), lastName: String(person.lastName || ''), email: String(person.email || '') }
    return ipcRenderer.invoke('signup:start', { service, person: clean })
  },
})
