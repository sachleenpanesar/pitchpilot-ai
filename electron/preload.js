const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stealthHUD', {
  onPayload: (callback) => {
    ipcRenderer.on('copilot-payload', (_event, data) => callback(data));
  },
  resizeHUD: (width, height) => {
    ipcRenderer.send('hud-resize', { width, height });
  },
  toggleVisibility: () => {
    ipcRenderer.send('hud-toggle-visibility');
  },
  quitApp: () => {
    ipcRenderer.send('hud-quit');
  },
});
