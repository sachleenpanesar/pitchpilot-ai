const { app, BrowserWindow, globalShortcut, session } = require('electron');
const http = require('http');
const path = require('path');

let overlayWindow;
let clickThrough = false;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 440,
    height: 580,
    x: 40,
    y: 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // OS-LEVEL SCREEN-SHARE EXCLUSION (Invisible on Teams, Zoom, Meet, OBS)
  overlayWindow.setContentProtection(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Auto-grant microphone permission inside the Stealth HUD
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  // Global Panic Hide / Show (Ctrl+Shift+H)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!overlayWindow) return;
    overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
  });

  // Global Click-Through Toggle (Ctrl+Shift+T)
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!overlayWindow) return;
    clickThrough = !clickThrough;
    overlayWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    overlayWindow.webContents.send('click-through-status', clickThrough);
  });
}

function startLocalBridge() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (req.url === '/push-prompt' && overlayWindow) {
          overlayWindow.webContents.send('new-ai-prompt', data);
        } else if (req.url === '/sync-context' && overlayWindow) {
          overlayWindow.webContents.send('sync-context', data);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  });

  server.listen(4789, '127.0.0.1', () => {
    console.log('PitchPilot Stealth Bridge active on http://127.0.0.1:4789');
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
  startLocalBridge();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
