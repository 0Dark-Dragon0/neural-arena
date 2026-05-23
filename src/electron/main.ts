import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Neural Arena',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f6',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Graceful window appearance
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-dashboard/index.html'));
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Save window bounds for restoration
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      try {
        const fs = require('fs');
        const configPath = path.join(app.getPath('userData'), 'window-state.json');
        fs.writeFileSync(configPath, JSON.stringify(bounds));
      } catch { /* ignore */ }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Restore window bounds
function restoreWindowBounds(): Partial<Electron.Rectangle> {
  try {
    const fs = require('fs');
    const configPath = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

app.whenReady().then(() => {
  createWindow();

  // Restore saved bounds
  const saved = restoreWindowBounds();
  if (saved.width && saved.height && mainWindow) {
    mainWindow.setBounds(saved as Electron.Rectangle);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Graceful shutdown
app.on('before-quit', () => {
  console.log('[Electron] Shutting down gracefully...');
});
