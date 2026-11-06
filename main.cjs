const { app, BrowserWindow, protocol, net, shell, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const { uIOhook, UiohookKey } = require('uiohook-napi');

// Allow autoplay Web Audio without user gesture restriction
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Register custom scheme with standard web privileges
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

// ── Persistent Configuration ──────────────────────────────────────
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {
    soundPack: 'typewriter',
    volume: 1.0,
    autoStart: false,
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let settings = loadSettings();
let mainWindow = null;
let tray = null;
let isQuitting = false;
let hookRunning = false;

// ── Keycode to Sound Category & Pan Mapping ────────────────────────
const IGNORED_MODIFIERS = new Set([
  42, 54,       // Shift
  29, 3613,     // Ctrl
  56, 3640,     // Alt
  3675, 3676,   // Meta / Win
]);

const LEFT_HAND_KEYS = new Set([
  41, 2, 3, 4, 5, 6,
  16, 17, 18, 19, 20,
  30, 31, 32, 33, 34,
  44, 45, 46, 47, 48,
]);

const RIGHT_HAND_KEYS = new Set([
  7, 8, 9, 10, 11, 12, 13,
  21, 22, 23, 24, 25, 26, 27,
  35, 36, 37, 38, 39, 40,
  49, 50, 51, 52, 53,
]);

function getSoundParams(keycode) {
  if (IGNORED_MODIFIERS.has(keycode)) return null;

  if (keycode === UiohookKey.Space) {
    return { category: 'space', pan: 0 };
  }
  if (keycode === UiohookKey.Enter || keycode === 3612) {
    return { category: 'enter', pan: 0.3 };
  }
  if (keycode === UiohookKey.Backspace) {
    return { category: 'esc', pan: 0.3 };
  }
  if (keycode === UiohookKey.Tab) {
    return { category: 'tab', pan: -0.3 };
  }
  if (keycode === UiohookKey.Escape) {
    return { category: 'esc', pan: -0.3 };
  }

  if (LEFT_HAND_KEYS.has(keycode)) {
    return { category: 'default', pan: -0.3 };
  }
  if (RIGHT_HAND_KEYS.has(keycode)) {
    return { category: 'default', pan: 0.3 };
  }

  return { category: 'default', pan: 0 };
}

// ── Global Keyboard Hook Management ───────────────────────────────
function updateGlobalHook() {
  if (settings.soundPack === 'off') {
    if (hookRunning) {
      try {
        uIOhook.stop();
      } catch (err) {}
      hookRunning = false;
    }
  } else {
    if (!hookRunning) {
      try {
        uIOhook.start();
        hookRunning = true;
      } catch (err) {
        console.error('Failed to start uIOhook:', err);
      }
    }
  }
}

uIOhook.on('keydown', (e) => {
  if (settings.soundPack === 'off') return;
  // If user is typing inside Type Review window, the web app's own sound engine plays it
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return;

  const params = getSoundParams(e.keycode);
  if (!params) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('play-key', {
      category: params.category,
      pan: params.pan,
      stroke: 'press',
    });
  }
});

uIOhook.on('keyup', (e) => {
  if (settings.soundPack === 'off') return;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return;

  const params = getSoundParams(e.keycode);
  if (!params) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('play-key', {
      category: params.category,
      pan: params.pan,
      stroke: 'release',
    });
  }
});

// ── Sync IPC between Web App UI & System Tray ─────────────────────
ipcMain.on('sync-sound-settings', (_event, { soundPack, volume }) => {
  let changed = false;
  if (soundPack !== undefined && soundPack !== settings.soundPack) {
    settings.soundPack = soundPack;
    changed = true;
  }
  if (volume !== undefined && Math.abs(settings.volume - volume) > 0.01) {
    settings.volume = volume;
    changed = true;
  }
  if (changed) {
    saveSettings(settings);
    updateTrayMenu();
    updateGlobalHook();
  }
});

// ── System Tray & Context Menu ────────────────────────────────────
function createTray(iconPath) {
  if (tray) return;

  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  } else {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Type Review - 极简打字与全局机械按键音效');

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const soundPacks = [
    { id: 'typewriter', label: 'Typewriter (复古打字机)' },
    { id: 'mechvibe',   label: 'Mechvibe (机械键盘原声)' },
    { id: 'soft',       label: 'Soft (轻柔静音轴)' },
    { id: 'thock',      label: 'Thock (客制化麻将音)' },
    { id: 'clicky',     label: 'Clicky (青轴清脆段落)' },
    { id: 'laptop',     label: 'Laptop (轻薄剪刀脚)' },
    { id: 'off',        label: '关闭全局音效 (Off)' },
  ];

  const volumes = [
    { value: 1.0, label: '100% 音量' },
    { value: 0.8, label: '80% 音量' },
    { value: 0.5, label: '50% 音量' },
    { value: 0.3, label: '30% 音量' },
  ];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开练习界面',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '🔊 全局按键音效 (无处不在)',
      submenu: soundPacks.map((pack) => ({
        label: pack.label,
        type: 'radio',
        checked: settings.soundPack === pack.id,
        click: () => {
          settings.soundPack = pack.id;
          saveSettings(settings);
          updateGlobalHook();
          updateTrayMenu();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('set-sound-from-tray', { soundPack: settings.soundPack });
          }
        },
      })),
    },
    {
      label: '🎚️ 音量大小',
      submenu: volumes.map((vol) => ({
        label: vol.label,
        type: 'radio',
        checked: Math.abs(settings.volume - vol.value) < 0.05,
        click: () => {
          settings.volume = vol.value;
          saveSettings(settings);
          updateTrayMenu();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('set-sound-from-tray', { volume: settings.volume });
          }
        },
      })),
    },
    { type: 'separator' },
    {
      label: '🚀 开机自启动',
      type: 'checkbox',
      checked: settings.autoStart,
      click: (item) => {
        settings.autoStart = item.checked;
        saveSettings(settings);
        app.setLoginItemSettings({
          openAtLogin: settings.autoStart,
          openAsHidden: true,
          path: process.execPath,
          args: ['--hidden'],
        });
      },
    },
    { type: 'separator' },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ── Main Window Creation ──────────────────────────────────────────
function createWindow(shouldShow = true) {
  const iconPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'Type Review',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: shouldShow,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // Ensure audio continues playing in background
    },
  });

  mainWindow.loadURL('app://localhost/index.html');

  // Minimize to tray on close
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // External links open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  createTray(iconPath);
  updateGlobalHook();
}

// Single Instance Lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const distDir = path.join(__dirname, 'dist');

    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
      }
      let filePath = path.join(distDir, pathname);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
      }

      return net.fetch(pathToFileURL(filePath).toString());
    });

    // Check if launched at login or with --hidden flag
    const isHiddenLaunch = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;
    createWindow(!isHiddenLaunch);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(true);
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (hookRunning) {
      try {
        uIOhook.stop();
      } catch (err) {}
    }
  });

  app.on('window-all-closed', () => {
    // Keep app alive in tray when all windows closed
  });
}
