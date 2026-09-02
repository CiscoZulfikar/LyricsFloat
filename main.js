const { app, BrowserWindow, ipcMain, shell } = require('electron');

const path = require('path');
const { ConfigStore } = require('./services/config-store');
const { LyricsService } = require('./services/lyrics-service');
const { LyricsEnricher } = require('./services/lyrics-enricher');
const { MediaWatcher } = require('./services/media-watcher');
const { CoverService } = require('./services/cover-service');

let mainWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}


const userDataPath = app.getPath('userData');
const configStore = new ConfigStore(path.join(userDataPath, 'config.json'));
const lyricsService = new LyricsService(path.join(userDataPath, 'cache', 'lyrics'));
const lyricsEnricher = new LyricsEnricher(path.join(userDataPath, 'cache', 'translations'));
const mediaWatcher = new MediaWatcher(800);
const coverService = new CoverService(path.join(userDataPath, 'cache', 'covers'));

let currentRawLyrics = null;
let currentTrackKey = null;
let lastEnrichedLyrics = null;
let lastPlaybackState = null;

const { exec } = require('child_process');

function applyNativeBlur(window, opacityPercent = 90) {
  if (!window || window.isDestroyed()) return;
  try {
    const hwndBuffer = window.getNativeWindowHandle();
    const hwndInt = process.arch === 'x64' ? hwndBuffer.readBigInt64LE(0) : hwndBuffer.readInt32LE(0);
    const scriptPath = path.join(__dirname, 'services', 'set-blur.ps1').replace('app.asar', 'app.asar.unpacked');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Hwnd ${hwndInt} -OpacityPercent ${Math.round(opacityPercent)}`;
    exec(cmd, (err) => {
      if (err) console.warn('Blur application warning:', err.message);
    });
  } catch (e) {
    console.warn('Native blur error:', e.message);
  }
}

function createWindow() {
  const bounds = configStore.get('bounds', { width: 440, height: 620 });
  const alwaysOnTop = configStore.get('alwaysOnTop', true);
  const opacity = configStore.get('windowOpacity', 0.80);

  mainWindow = new BrowserWindow({
    width: bounds.width || 440,
    height: bounds.height || 620,
    minWidth: 280,
    minHeight: 320,






    x: bounds.x || undefined,
    y: bounds.y || undefined,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: alwaysOnTop,
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    applyNativeBlur(mainWindow, Number(opacity) * 100);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    applyNativeBlur(mainWindow, Number(configStore.get('windowOpacity', 0.95)) * 100);
    if (lastPlaybackState && mainWindow) {
      mainWindow.webContents.send('playback-state', lastPlaybackState);
    }
    if (lastEnrichedLyrics && mainWindow) {
      mainWindow.webContents.send('lyrics-loaded', lastEnrichedLyrics);
    }
  });


  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const currentBounds = mainWindow.getBounds();
    configStore.set('bounds', currentBounds);
    applyNativeBlur(mainWindow, Number(configStore.get('windowOpacity', 0.95)) * 100);
  });


  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const currentBounds = mainWindow.getBounds();
    configStore.set('bounds', currentBounds);
  });
}

async function handleTrackChange(track) {
  const trackKey = `${track.title}___${track.artist}`;
  currentTrackKey = trackKey;
  const targetLang = configStore.get('targetLanguage', 'en');
  console.log(`[MediaWatcher] Track changed to: ${track.title} by ${track.artist}`);

  try {
    const [rawLyrics, coverUrl] = await Promise.all([
      lyricsService.fetchLyrics({
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationMs ? track.durationMs / 1000 : 0
      }),
      coverService.fetchCoverUrl(track.title, track.artist, track.album)
    ]);


    currentRawLyrics = rawLyrics;
    if (lastPlaybackState) lastPlaybackState.coverUrl = coverUrl;

    if (!rawLyrics) {
      lastEnrichedLyrics = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverUrl,
        synced: false,
        lines: [],
        isForeign: false
      };
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lyrics-loaded', lastEnrichedLyrics);
      }
      return;
    }

    const enabledLanguages = configStore.get('enabledTranslateLanguages', [
      'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
    ]);

    const enriched = await lyricsEnricher.enrichLyrics(
      track.title,
      track.artist,
      rawLyrics,
      targetLang,
      (translationUpdate) => {
        if (currentTrackKey === translationUpdate.trackKey) {
          if (lastEnrichedLyrics) {
            translationUpdate.lines.forEach((t, i) => {
              if (lastEnrichedLyrics.lines[i]) {
                lastEnrichedLyrics.lines[i].translation = t.translation;
              }
            });
          }
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('lyrics-translation-updated', translationUpdate);
          }
        }
      },
      enabledLanguages
    );



    enriched.coverUrl = coverUrl;
    lastEnrichedLyrics = enriched;

    if (currentTrackKey === trackKey && mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('lyrics-loaded', enriched);
    }
  } catch (err) {
    console.error('Error processing lyrics for track:', err);
  }
}


app.whenReady().then(async () => {
  await lyricsEnricher.init();
  createWindow();

  mediaWatcher.on('track-change', (track) => {
    handleTrackChange(track);
  });

  mediaWatcher.on('playback-state', (state) => {
    lastPlaybackState = state;
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('playback-state', state);
    }
  });

  mediaWatcher.start();
});

// IPC Handlers
ipcMain.handle('get-current-state', () => {
  return {
    playbackState: lastPlaybackState,
    lyrics: lastEnrichedLyrics,
    config: configStore.data
  };
});

ipcMain.handle('get-config', () => {
  return configStore.data;
});

ipcMain.handle('save-config', (_event, { key, value }) => {
  configStore.set(key, value);
  return true;
});

ipcMain.handle('set-target-language', async (_event, targetLang) => {
  configStore.set('targetLanguage', targetLang);
  if (currentRawLyrics && currentTrackKey && mainWindow) {
    const [title, artist] = currentTrackKey.split('___');
    const enabledLanguages = configStore.get('enabledTranslateLanguages', [
      'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
    ]);

    const enriched = await lyricsEnricher.enrichLyrics(
      title,
      artist,
      currentRawLyrics,
      targetLang,
      (translationUpdate) => {
        if (currentTrackKey === translationUpdate.trackKey && mainWindow) {
          mainWindow.webContents.send('lyrics-translation-updated', translationUpdate);
        }
      },
      enabledLanguages
    );
    lastEnrichedLyrics = enriched;
    mainWindow.webContents.send('lyrics-loaded', enriched);
  }
  return true;
});

ipcMain.handle('set-enabled-languages', async (_event, enabledLangs) => {
  configStore.set('enabledTranslateLanguages', enabledLangs);
  if (currentRawLyrics && currentTrackKey && mainWindow) {
    const [title, artist] = currentTrackKey.split('___');
    const targetLang = configStore.get('targetLanguage', 'en');
    const enriched = await lyricsEnricher.enrichLyrics(
      title,
      artist,
      currentRawLyrics,
      targetLang,
      (translationUpdate) => {
        if (currentTrackKey === translationUpdate.trackKey && mainWindow) {
          mainWindow.webContents.send('lyrics-translation-updated', translationUpdate);
        }
      },
      enabledLangs
    );
    lastEnrichedLyrics = enriched;
    mainWindow.webContents.send('lyrics-loaded', enriched);
  }
  return true;
});



ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('set-always-on-top', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    configStore.set('alwaysOnTop', flag);
  }
});

ipcMain.handle('set-opacity', (_event, val) => {
  if (mainWindow) {
    const num = Math.min(1.0, Math.max(0.80, parseFloat(val) || 0.95));
    configStore.set('windowOpacity', num);
    applyNativeBlur(mainWindow, num * 100);
  }
});

ipcMain.handle('open-external', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});




app.on('window-all-closed', () => {
  mediaWatcher.stop();
  if (process.platform !== 'darwin') app.quit();
});
