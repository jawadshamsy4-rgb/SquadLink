const { app, BrowserWindow, Menu, desktopCapturer } = require('electron')
const path = require('path')

// Determine if dev mode
const isDev = !app.isPackaged

// Enable WebRTC features and allow autoplay without manual gesture
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

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

  // Grant all WebRTC media and display capture permissions unconditionally
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true)
  })

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return true
  })

  mainWindow.webContents.session.setDevicePermissionHandler(() => true)

  // Handle getDisplayMedia (screensharing) in Electron 33+
  if (mainWindow.webContents.session.setDisplayMediaRequestHandler) {
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        if (sources.length > 0) {
          const response = { video: sources[0] }
          if (request.audio) {
            response.audio = 'loopback'
          }
          callback(response)
        } else {
          callback({})
        }
      }).catch((e) => {
        console.error('Desktop capturer error:', e)
        callback({})
      })
    })
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
