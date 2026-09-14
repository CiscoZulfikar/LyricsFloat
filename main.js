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
let currentTrack = null;
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
    applyNativeBlur(mainWindow, 90);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    applyNativeBlur(mainWindow, 90);
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
    applyNativeBlur(mainWindow, 90);
  });


  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const currentBounds = mainWindow.getBounds();
    configStore.set('bounds', currentBounds);
  });
}

function normalizeTrackKey(title, artist) {
  if (!artist && typeof title === 'string' && title.includes('___')) {
    const parts = title.split('___');
    return normalizeTrackKey(parts[0], parts.slice(1).join('___'));
  }
  const t = (title || '').trim().normalize('NFC').toLowerCase();
  const a = (artist || '').trim().normalize('NFC').toLowerCase();
  return `${t}___${a}`;
}

let trackChangeCounter = 0;

async function handleTrackChange(track) {
  const requestId = ++trackChangeCounter;
  currentTrack = { title: track.title, artist: track.artist, album: track.album };
  const trackKey = normalizeTrackKey(track.title, track.artist);
  currentTrackKey = trackKey;
  const targetLang = configStore.get('targetLanguage', 'en');
  console.log(`[MediaWatcher] Track changed to: ${track.title} by ${track.artist} (req #${requestId})`);

  try {
    const [rawLyrics, metadata] = await Promise.all([
      lyricsService.fetchLyrics({
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationMs ? track.durationMs / 1000 : 0
      }),
      coverService.fetchTrackMetadata(track.title, track.artist, track.album)
    ]);

    // If another track change occurred while fetching, discard this stale result
    if (requestId !== trackChangeCounter) {
      console.log(`[MediaWatcher] Discarding stale lyrics fetch for req #${requestId}`);
      return;
    }

    const coverUrl = metadata ? metadata.coverUrl : null;
    let isExplicit = metadata ? Boolean(metadata.isExplicit) : false;

    // Secondary explicitness detection
    if (!isExplicit) {
      if (/\b(explicit)\b/i.test(`${track.title} ${track.album || ''}`)) {
        isExplicit = true;
      }
    }
    if (!isExplicit && rawLyrics) {
      const explicitWords = /\b(fuck|fucking|fucked|motherfucker|shit|bitch|bitches|pussy|nigga|niggas|asshole|cunt|dick|cock|fode|fodendo|caralho|puta|merda|chupa|buceta|pepequinha|larissinha|arrombado)\b/i;
      const lyricsSample = (rawLyrics.syncedLyrics || rawLyrics.plainLyrics || '');
      if (explicitWords.test(lyricsSample)) {
        isExplicit = true;
      }
    }

    currentRawLyrics = rawLyrics;
    if (lastPlaybackState && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === trackKey) {
      lastPlaybackState.coverUrl = coverUrl;
      lastPlaybackState.isExplicit = isExplicit;
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('playback-state', lastPlaybackState);
      }
    }

    if (!rawLyrics) {
      lastEnrichedLyrics = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverUrl,
        isExplicit,
        synced: false,
        lines: [],
        isForeign: false
      };
      if (mainWindow && mainWindow.webContents && requestId === trackChangeCounter) {
        mainWindow.webContents.send('lyrics-loaded', lastEnrichedLyrics);
      }
      return;
    }

    const enabledLanguages = configStore.get('enabledTranslateLanguages', [
      'en', 'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
    ]);

    const enriched = await lyricsEnricher.enrichLyrics(
      track.title,
      track.artist,
      rawLyrics,
      targetLang,
      (translationUpdate) => {
        if (normalizeTrackKey(currentTrackKey) === normalizeTrackKey(translationUpdate.trackKey)) {
          if (lastEnrichedLyrics) {
            lastEnrichedLyrics.isTranslating = false;
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

    // Re-check request ID after async enrichment
    if (requestId !== trackChangeCounter) {
      console.log(`[MediaWatcher] Discarding stale enrichment for req #${requestId}`);
      return;
    }

    enriched.coverUrl = coverUrl;
    enriched.isExplicit = isExplicit;
    if (enriched.lines && enriched.lines.some(l => l.translation && l.translation.trim().length > 0)) {
      enriched.isTranslating = false;
    }
    lastEnrichedLyrics = enriched;

    if (mainWindow && mainWindow.webContents && requestId === trackChangeCounter) {
      mainWindow.webContents.send('lyrics-loaded', enriched);
    }
  } catch (err) {
    console.error('Error processing lyrics for track:', err);
    // Never leave the UI indefinitely stuck in "Loading lyrics..." on error
    if (mainWindow && mainWindow.webContents && requestId === trackChangeCounter) {
      lastEnrichedLyrics = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverUrl: null,
        isExplicit: false,
        synced: false,
        lines: [],
        isForeign: false
      };
      mainWindow.webContents.send('lyrics-loaded', lastEnrichedLyrics);
    }
  }
}


app.whenReady().then(async () => {
  await lyricsEnricher.init();
  createWindow();

  mediaWatcher.on('track-change', (track) => {
    handleTrackChange(track);
  });

  mediaWatcher.on('playback-state', (state) => {
    const stateKey = normalizeTrackKey(state.title, state.artist);
    if (lastPlaybackState && lastPlaybackState.coverUrl && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === stateKey) {
      state.coverUrl = lastPlaybackState.coverUrl;
    } else if (lastEnrichedLyrics && lastEnrichedLyrics.coverUrl && normalizeTrackKey(lastEnrichedLyrics.title, lastEnrichedLyrics.artist) === stateKey) {
      state.coverUrl = lastEnrichedLyrics.coverUrl;
    }
    if (lastPlaybackState && lastPlaybackState.isExplicit !== undefined && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === stateKey) {
      state.isExplicit = lastPlaybackState.isExplicit;
    } else if (lastEnrichedLyrics && lastEnrichedLyrics.isExplicit !== undefined && normalizeTrackKey(lastEnrichedLyrics.title, lastEnrichedLyrics.artist) === stateKey) {
      state.isExplicit = lastEnrichedLyrics.isExplicit;
    }
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
  if (currentRawLyrics && currentTrack && mainWindow) {
    const title = currentTrack.title;
    const artist = currentTrack.artist;
    const enabledLanguages = configStore.get('enabledTranslateLanguages', [
      'en', 'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
    ]);

    const enriched = await lyricsEnricher.enrichLyrics(
      title,
      artist,
      currentRawLyrics,
      targetLang,
      (translationUpdate) => {
        if (normalizeTrackKey(currentTrackKey) === normalizeTrackKey(translationUpdate.trackKey) && mainWindow) {
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
  if (currentRawLyrics && currentTrack && mainWindow) {
    const title = currentTrack.title;
    const artist = currentTrack.artist;
    const targetLang = configStore.get('targetLanguage', 'en');
    const enriched = await lyricsEnricher.enrichLyrics(
      title,
      artist,
      currentRawLyrics,
      targetLang,
      (translationUpdate) => {
        if (normalizeTrackKey(currentTrackKey) === normalizeTrackKey(translationUpdate.trackKey) && mainWindow) {
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

ipcMain.handle('seek-playback', async (_event, positionMs) => {
  return await mediaWatcher.seek(positionMs);
});

ipcMain.handle('control-playback', async (_event, action) => {
  return await mediaWatcher.control(action);
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
