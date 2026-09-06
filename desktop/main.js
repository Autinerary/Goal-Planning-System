const { app, BrowserWindow, Tray, Menu, shell, ipcMain, screen, nativeImage } = require('electron')
const path = require('node:path')

/**
 * Autinerary desktop.
 *
 * The reason this exists rather than "just use the website": a browser tab
 * cannot draw outside itself. The floating mascot — your current task,
 * always visible, draggable anywhere, click to come back — is only possible
 * in a real desktop window, and for an executive-function tool a persistent
 * visible reminder is the feature, not decoration.
 *
 * The main window is a thin shell around the deployed web app rather than a
 * reimplementation, so there is exactly one codebase to fix bugs in.
 */

const APP_URL = process.env.AUTINERARY_URL || 'https://goal-planning-app.vercel.app'

let mainWindow = null
let mascotWindow = null
let tray = null

function createMainWindow() {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    title: 'Autinerary',
    backgroundColor: '#eef4ff',
    webPreferences: {
      // Remote content is loaded here, so the renderer gets no Node access
      // and no direct access to anything privileged.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadURL(APP_URL)

  // Anything that isn't our own app opens in the real browser instead of a
  // chromeless Electron window the user can't inspect or trust.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
  return mainWindow
}

function createMascotWindow() {
  if (mascotWindow) return mascotWindow

  const { width } = screen.getPrimaryDisplay().workAreaSize

  mascotWindow = new BrowserWindow({
    width: 190,
    height: 130,
    x: width - 220,
    y: 90,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    // Keep it out of the taskbar/dock — it is an overlay, not a second app.
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 'floating' sits above normal windows without fighting system UI.
  mascotWindow.setAlwaysOnTop(true, 'floating')
  // Without this the mascot vanishes the moment you full-screen another app
  // on macOS — which is exactly when a reminder is most useful.
  mascotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mascotWindow.loadFile(path.join(__dirname, 'renderer', 'mascot.html'))
  mascotWindow.on('closed', () => { mascotWindow = null })
  return mascotWindow
}

function createTray() {
  // A 1x1 transparent placeholder keeps the tray working before real art
  // exists — an empty image throws on some platforms.
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setToolTip('Autinerary')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Autinerary', click: () => createMainWindow() },
    {
      label: 'Show floating task',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        if (item.checked) createMascotWindow()
        else if (mascotWindow) mascotWindow.close()
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
  tray.on('click', () => createMainWindow())
}

/**
 * Load the user's actual current task for the mascot.
 *
 * Reuses the session cookies from signing in inside the main window rather
 * than building a second auth flow — /api/me/calendar authenticates by
 * cookie (see lib/supabase/server.ts), so the main process can read them
 * from Electron's session and make the request itself. The mascot renderer
 * never touches credentials.
 *
 * Returns null when there is nothing to show. The mascot then says so —
 * it never displays an invented task.
 */
async function fetchCurrentTask() {
  try {
    const { session } = require('electron')
    const cookies = await session.defaultSession.cookies.get({ url: APP_URL })
    if (cookies.length === 0) return null

    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(`${APP_URL}/api/me/calendar`, {
      headers: { Cookie: cookieHeader },
    })
    if (!res.ok) return null

    const json = await res.json()
    const tasks = Array.isArray(json?.tasks) ? json.tasks : []
    if (tasks.length === 0) return null

    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const today = new Date()
    const todayISO = today.toISOString().slice(0, 10)
    const todayName = WEEKDAYS[today.getDay()]

    // A task counts as today's if it is dated today, or is a weekly
    // recurring row falling on today's weekday — the same two-model rule the
    // calendar itself uses.
    const todays = tasks.filter(
      (t) => !t.completed && (t.scheduled_date === todayISO || (!t.scheduled_date && t.day === todayName))
    )
    if (todays.length === 0) return null

    todays.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    return { name: todays[0].name, time: todays[0].time }
  } catch {
    return null
  }
}

// The renderer asks; the main process answers. Polled rather than pushed
// because the web app is remote content we deliberately do not inject into.
ipcMain.handle('mascot:current-task', () => fetchCurrentTask())

// Clicking the mascot brings the real app forward — the whole point of it
// being visible while you are working in something else.
ipcMain.on('mascot:open-app', () => createMainWindow())

// Frameless windows have no titlebar to drag, so the renderer moves the
// window itself by reporting how far the pointer travelled.
ipcMain.on('mascot:drag', (_evt, { dx, dy }) => {
  if (!mascotWindow) return
  const [x, y] = mascotWindow.getPosition()
  mascotWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
})

app.whenReady().then(() => {
  createMainWindow()
  createMascotWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// The mascot is meant to outlive the main window, so closing the main window
// must not quit on macOS. On Windows/Linux the tray keeps the app alive.
app.on('window-all-closed', (e) => {
  e.preventDefault?.()
})
