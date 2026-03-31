'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Triggers native OAuth popup window, returns { token, expiresIn }
  oauthSignIn: (authUrl, redirectUri) =>
    ipcRenderer.invoke('oauth-signin', authUrl, redirectUri)
});
