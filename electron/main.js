const { app, BrowserWindow, globalShortcut } = require('electron');
const http = require('http');
const path = require('path');

let overlayWindow;
let clickThrough = false;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 420,
    height: 560,
    x: 50,
    y: 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true, // Hides from Windows taskbar and macOS Dock
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // OS-LEVEL SCREEN-SHARE EXCLUSION (Hidden from Zoom, Meet, Teams, OBS)
  overlayWindow.setContentProtection(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  // Panic Hide / Show Shortcut (Ctrl+Shift+H or Cmd+Shift+H)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!overlayWindow) return;
    overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
  });

  // Click-Through Toggle (Ctrl+Shift+T) so clicks pass through to apps behind it
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!overlayWindow) return;
    clickThrough = !clickThrough;
    overlayWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    overlayWindow.webContents.send('click-through-status', clickThrough);
  });
}

// Local HTTP bridge to receive JD/CV status & AI answers from your Chrome Extension
function startLocalBridge() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'POST' && req.url === '/push-prompt') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (overlayWindow) {
            overlayWindow.webContents.send('new-ai-prompt', data);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(4789, '127.0.0.1', () => {
    console.log('PitchPilot Stealth Bridge listening on http://127.0.0.1:4789');
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
  startLocalBridge();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
