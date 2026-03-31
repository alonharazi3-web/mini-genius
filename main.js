'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    title: 'Mini Genius',
    icon: path.join(__dirname, 'www', 'img', 'icon.png'),
    backgroundColor: '#1B2A4A',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'www', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Intercept protocol links — tel, mailto, external http
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('tel:') || url.startsWith('mailto:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
    // https/http links that are NOT local files open in system browser
    if ((url.startsWith('http://') || url.startsWith('https://')) &&
        !url.startsWith('https://accounts.google.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ===== OAUTH POPUP — intercepts token from redirect hash =====
ipcMain.handle('oauth-signin', async (event, authUrl, redirectUri) => {
  return new Promise((resolve, reject) => {
    const popup = new BrowserWindow({
      width: 500,
      height: 680,
      parent: mainWindow,
      modal: true,
      title: 'Google Drive — התחברות',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    popup.setMenuBarVisibility(false);
    popup.loadURL(authUrl);

    // Watch all navigations for the redirect URI
    const checkUrl = (url) => {
      if (!url) return;
      if (url.startsWith(redirectUri) || url.includes('access_token=')) {
        try {
          let hash = '';
          if (url.includes('#')) hash = url.split('#')[1];
          else if (url.includes('?')) hash = url.split('?')[1];
          const params = new URLSearchParams(hash);
          const token = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in')) || 3600;
          if (token) {
            popup.destroy();
            resolve({ token, expiresIn });
          } else {
            popup.destroy();
            reject(new Error('No token in redirect'));
          }
        } catch (e) {
          popup.destroy();
          reject(e);
        }
      }
    };

    popup.webContents.on('will-redirect', (e, url) => checkUrl(url));
    popup.webContents.on('will-navigate', (e, url) => checkUrl(url));
    popup.webContents.on('did-navigate', (e, url) => checkUrl(url));
    popup.webContents.on('did-navigate-in-page', (e, url) => checkUrl(url));

    popup.on('closed', () => reject(new Error('Window closed by user')));
  });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
