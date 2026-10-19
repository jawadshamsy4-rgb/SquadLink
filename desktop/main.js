const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

// Determine if dev mode
const isDev = !app.isPackaged

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

  // Load the web app
  if (isDev) {
    // In dev mode, connect to the Next.js dev server
    mainWindow.loadURL('http://localhost:3000/app')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from the live deployed SquadLink app URL
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
