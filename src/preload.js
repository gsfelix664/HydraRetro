/**
 * HydraRetro — Electron Preload Script
 * Exposes secure IPC bridge for Hydra OAuth flow and system events
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hydraAuth', {
  isElectron: true,
  openAuthWindow: () => ipcRenderer.invoke('open-auth-window'),
  onProfileUpdated: (callback) => {
    ipcRenderer.on('on-profile-updated', (_event, data) => {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  }
});
