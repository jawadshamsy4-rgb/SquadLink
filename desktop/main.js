const { app, BrowserWindow, Menu, desktopCapturer, session, ipcMain } = require('electron')
const path = require('path')
const { getWindowsLocation } = require('./get-location')

// Determine if dev mode
const isDev = !app.isPackaged

// Enable WebRTC features and allow autoplay without manual gesture
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// IPC handler for exact Windows hardware / Wi-Fi location
let cachedLocation = null
let lastLocationTime = 0

ipcMain.handle('get-windows-location', async () => {
  if (cachedLocation && Date.now() - lastLocationTime < 15000) {
    return cachedLocation
  }
  const loc = await getWindowsLocation()
  if (loc) {
    cachedLocation = loc
    lastLocationTime = Date.now()
  }
  return loc
})

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'SquadLink',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'default',
    show: false,
  })

  // Remove default menu in production
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }

  // Append SquadLink Desktop identifier to User Agent
  const defaultUA = mainWindow.webContents.getUserAgent()
  mainWindow.webContents.setUserAgent(`${defaultUA} SquadLink-Desktop/1.0.0`)

  // Grant all permissions unconditionally on both sessions
  const grantAll = (webContents, permission, callback) => callback(true)
  mainWindow.webContents.session.setPermissionRequestHandler(grantAll)
  mainWindow.webContents.session.setPermissionCheckHandler(() => true)
  mainWindow.webContents.session.setDevicePermissionHandler(() => true)

  session.defaultSession.setPermissionRequestHandler(grantAll)
  session.defaultSession.setPermissionCheckHandler(() => true)
  session.defaultSession.setDevicePermissionHandler(() => true)

  // Handle getDisplayMedia (screensharing) in Electron
  const handleDisplayMedia = async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 1, height: 1 },
      })
      if (sources && sources.length > 0) {
        const screenSource = sources.find((s) => s.id.startsWith('screen:')) || sources[0]
        const response = { video: screenSource }
        if (request.audio) {
          response.audio = 'loopback'
        }
        callback(response)
      } else {
        const screenOnly = await desktopCapturer.getSources({ types: ['screen'] })
        if (screenOnly && screenOnly.length > 0) {
          callback({ video: screenOnly[0] })
        } else {
          callback(null)
        }
      }
    } catch (e) {
      console.error('Desktop capturer error:', e)
      try {
        const fallback = await desktopCapturer.getSources({ types: ['screen'] })
        if (fallback && fallback.length > 0) {
          callback({ video: fallback[0] })
          return
        }
      } catch (err2) {}
      callback(null)
    }
  }

  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler(handleDisplayMedia)
  }
  if (mainWindow.webContents.session.setDisplayMediaRequestHandler) {
    mainWindow.webContents.session.setDisplayMediaRequestHandler(handleDisplayMedia)
  }

  // Prevent desktop app from ever navigating to the marketing website root
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url)
      if (parsed.pathname === '/' || parsed.pathname === '') {
        event.preventDefault()
        const targetUrl = isDev ? 'http://localhost:3000/login' : 'https://squad-link-five.vercel.app/login'
        mainWindow.loadURL(targetUrl)
      }
    } catch (e) {}
  })

  mainWindow.webContents.on('will-redirect', (event, url) => {
    try {
      const parsed = new URL(url)
      if (parsed.pathname === '/' || parsed.pathname === '') {
        event.preventDefault()
        const targetUrl = isDev ? 'http://localhost:3000/login' : 'https://squad-link-five.vercel.app/login'
        mainWindow.loadURL(targetUrl)
      }
    } catch (e) {}
  })

  // Load the web app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/app')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL('https://squad-link-five.vercel.app/app')
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    app.quit()
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
