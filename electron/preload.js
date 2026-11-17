const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stealthAPI', {
  onNewPrompt: (cb) => ipcRenderer.on('new-ai-prompt', (_e, data) => cb(data)),
  onSyncContext: (cb) => ipcRenderer.on('sync-context', (_e, data) => cb(data)),
  onClickThrough: (cb) => ipcRenderer.on('click-through-status', (_e, state) => cb(state)),
  quitApp: () => ipcRenderer.send('quit-stealth-app'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-stealth-window', { width, height }),
});
