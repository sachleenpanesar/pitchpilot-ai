const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stealthAPI', {
  onNewPrompt: (cb) => ipcRenderer.on('new-ai-prompt', (_e, data) => cb(data)),
  onClickThrough: (cb) => ipcRenderer.on('click-through-status', (_e, state) => cb(state)),
});
