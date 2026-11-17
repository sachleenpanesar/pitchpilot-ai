const { app, BrowserWindow, globalShortcut, session, ipcMain, Tray, Menu, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');

let overlayWindow = null;
let tray = null;
let isQuitting = false;

const BRIDGE_PORT = 4789;
const BRIDGE_HOST = '127.0.0.1';

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 440,
    height: 320,
    x: 40,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlayWindow.setIgnoreMouseEvents(false);

  // Hide from screen capture / screen sharing (Windows WDA_EXCLUDEFROMCAPTURE)
  overlayWindow.setContentProtection(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Auto-approve audio & display capture permissions
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'display-capture') {
      return true;
    }
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'display-capture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Grant direct Windows system audio loopback without system picker popup
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources && sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback({});
      }
    }).catch(() => {
      callback({});
    });
  }, { useSystemPicker: false });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      overlayWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('PitchPilot Stealth HUD');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide HUD (Ctrl+Shift+H)',
      click: () => toggleOverlayVisibility(),
    },
    { type: 'separator' },
    {
      label: 'Quit PitchPilot HUD',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleOverlayVisibility());
}

function toggleOverlayVisibility() {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.showInactive();
  }
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    toggleOverlayVisibility();
  });

  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.webContents.send('hud-toggle-listening');
  });

  const step = 30;
  globalShortcut.register('CommandOrControl+Alt+Up', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x, Math.max(0, y - step));
  });
  globalShortcut.register('CommandOrControl+Alt+Down', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x, y + step);
  });
  globalShortcut.register('CommandOrControl+Alt+Left', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(Math.max(0, x - step), y);
  });
  globalShortcut.register('CommandOrControl+Alt+Right', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x + step, y);
  });
}

function startLocalBridge() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, stealth: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/push') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            if (!overlayWindow.isVisible()) {
              overlayWindow.showInactive();
            }
            overlayWindow.webContents.send('copilot-payload', payload);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
    console.log(`PitchPilot Stealth Bridge active on http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  });
}

ipcMain.on('hud-resize', (_event, { width, height }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setSize(width, height);
  }
});

ipcMain.on('hud-toggle-visibility', () => {
  toggleOverlayVisibility();
});

ipcMain.on('hud-quit', () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  createOverlayWindow();
  createTray();
  registerShortcuts();
  startLocalBridge();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
