const { app, BrowserWindow, globalShortcut, session, ipcMain, Tray, Menu, nativeImage } = require('electron');
const http = require('http');
const path = require('path');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('pitchpilot', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('pitchpilot');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let overlayWindow;
let tray = null;
let clickThrough = false;

function handleDeepLink(urlStr) {
  if (!urlStr || !overlayWindow) return;
  try {
    const parsed = new URL(urlStr);
    const token = parsed.searchParams.get('token');
    const origin = parsed.searchParams.get('origin');
    const mode = parsed.searchParams.get('mode');
    if (token || origin || mode) {
      overlayWindow.webContents.send('sync-context', {
        ...(token ? { apiToken: token } : {}),
        ...(origin ? { apiOrigin: origin } : {}),
        ...(mode ? { mode } : {}),
      });
    }
    if (!overlayWindow.isVisible()) overlayWindow.show();
    overlayWindow.focus();
  } catch {
    if (overlayWindow && !overlayWindow.isVisible()) overlayWindow.show();
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (overlayWindow) {
    if (!overlayWindow.isVisible()) overlayWindow.show();
    overlayWindow.focus();
    const deepLink = commandLine.find((arg) => arg.startsWith('pitchpilot://'));
    if (deepLink) handleDeepLink(deepLink);
  }
});

app.on('open-url', (event, urlStr) => {
  event.preventDefault();
  handleDeepLink(urlStr);
});

function toggleVisibility() {
  if (!overlayWindow) return;
  overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
}

function toggleClickThrough() {
  if (!overlayWindow) return;
  clickThrough = !clickThrough;
  overlayWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
  overlayWindow.webContents.send('click-through-status', clickThrough);
}

function createTray() {
  const iconDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAW0lEQVR4nGNgGAWjABbw////fwYGBgYGRkZGBhQxRkZGBgZGJBoFjI2N/7Nj4////w9mI5sJ0Q9iIxuAzQZ083BpwGYDuhno5uHSgM0GdPPQzcOlAZsN6OaNggEPAL1+F8f0W5/YAAAAAElFTkSuQmCC';
  const icon = nativeImage.createFromDataURL(iconDataUrl);
  tray = new Tray(icon);
  tray.setToolTip('PitchPilot Stealth HUD');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show / Hide HUD (Ctrl+Shift+H)', click: toggleVisibility },
    { label: 'Toggle Click-Through (Ctrl+Shift+T)', click: toggleClickThrough },
    { type: 'separator' },
    { label: 'Quit PitchPilot Stealth HUD', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleVisibility);
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 440,
    height: 580,
    minWidth: 340,
    minHeight: 320,
    x: 40,
    y: 40,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setContentProtection(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWindow.webContents.once('did-finish-load', () => {
    const initialLink = process.argv.find((arg) => arg.startsWith('pitchpilot://'));
    if (initialLink) handleDeepLink(initialLink);
  });

  globalShortcut.register('CommandOrControl+Shift+H', toggleVisibility);
  globalShortcut.register('CommandOrControl+Shift+T', toggleClickThrough);

  const nudgeStep = 35;
  globalShortcut.register('CommandOrControl+Alt+Up', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x, Math.max(0, y - nudgeStep));
  });
  globalShortcut.register('CommandOrControl+Alt+Down', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x, y + nudgeStep);
  });
  globalShortcut.register('CommandOrControl+Alt+Left', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(Math.max(0, x - nudgeStep), y);
  });
  globalShortcut.register('CommandOrControl+Alt+Right', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    overlayWindow.setPosition(x + nudgeStep, y);
  });
}

function startLocalBridge() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
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
          if (!overlayWindow.isVisible()) overlayWindow.show();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Stealth Bridge port 4789 already active; exiting duplicate.');
      app.quit();
    } else {
      console.error('Bridge server error:', err);
    }
  });

  server.listen(4789, '127.0.0.1', () => {
    console.log('PitchPilot Stealth Bridge active on http://127.0.0.1:4789');
  });
}

ipcMain.on('quit-stealth-app', () => {
  app.quit();
});

ipcMain.on('resize-stealth-window', (_event, { width, height }) => {
  if (!overlayWindow) return;
  overlayWindow.setSize(width, height, true);
});

app.whenReady().then(() => {
  createTray();
  createOverlayWindow();
  startLocalBridge();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
