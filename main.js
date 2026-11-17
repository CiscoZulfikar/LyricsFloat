const { app, BrowserWindow, ipcMain, shell } = require('electron');

if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001 > nul', { stdio: 'ignore' });
  } catch (error) {
    if (process.stdout.isTTY || process.stderr.isTTY) {
      console.warn('[LyricsFloat] Unable to set terminal code page to UTF-8:', error.message);
    }
  }
}

// Ensure CRLF newlines on Windows to eliminate staircase output in PowerShell and Windows terminals
if (process.platform === 'win32') {
  const normalizeCRLF = (origWrite) => (chunk, encoding, callback) => {
    if (typeof chunk === 'string') {
      chunk = chunk.replace(/(?<!\r)\n/g, '\r\n');
    } else if (Buffer.isBuffer(chunk)) {
      const enc = typeof encoding === 'string' ? encoding : 'utf8';
      const str = chunk.toString(enc);
      if (/(?<!\r)\n/.test(str)) {
        chunk = Buffer.from(str.replace(/(?<!\r)\n/g, '\r\n'), enc);
      }
    }
    return origWrite(chunk, encoding, callback);
  };

  process.stdout.write = normalizeCRLF(process.stdout.write.bind(process.stdout));
  process.stderr.write = normalizeCRLF(process.stderr.write.bind(process.stderr));
}

const path = require('path');
const { ConfigStore } = require('./services/config-store');
const { LyricsService } = require('./services/lyrics-service');
const { LyricsEnricher } = require('./services/lyrics-enricher');
const { MediaWatcher } = require('./services/media-watcher');
const { CoverService, extractFeaturedFromTitle, combineArtists } = require('./services/cover-service');

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
    // NOTE: Do NOT replay lastPlaybackState / lastEnrichedLyrics here.
    // The renderer fetches the same data via getCurrentState() in DOMContentLoaded,
    // and re-sending creates duplicate "loading lyrics" / translation pill races.
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
  const primaryArtist = a.split(/,|\s+(?:&|feat\.?|ft\.?)\s+/i)[0].trim();
  return `${t}___${primaryArtist}`;
}

let trackChangeCounter = 0;
let retryTimeout = null;
let activeLyricsAbortController = null;

function scheduleLyricsRetry(track, originalRequestId, retryCount = 0) {
  if (retryCount >= 1) return; // Cap at 1 background retry to prevent rate-limit loops
  if (retryTimeout) clearTimeout(retryTimeout);
  retryTimeout = setTimeout(async () => {
    retryTimeout = null;
    const trackKey = normalizeTrackKey(track.title, track.artist);
    if (originalRequestId === trackChangeCounter && currentTrackKey === trackKey) {
      if (!currentRawLyrics || !lastEnrichedLyrics || lastEnrichedLyrics.lines.length === 0) {
        console.log(`[MediaWatcher] Auto-retrying lyrics fetch for: ${track.title} by ${track.artist}`);
        lyricsService.clearCache(track.title, track.artist);
        handleTrackChange(track, retryCount + 1);
      }
    }
  }, 2000);
}

async function handleTrackChange(track, retryCount = 0) {
  const requestId = ++trackChangeCounter;
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (activeLyricsAbortController) {
    activeLyricsAbortController.abort();
    activeLyricsAbortController = null;
  }
  const abortController = new AbortController();
  activeLyricsAbortController = abortController;
  const signal = abortController.signal;

  const feat = extractFeaturedFromTitle(track.title);
  const initialArtist = feat ? combineArtists(track.artist, feat) : track.artist;
  currentTrack = { 
    title: track.title, 
    artist: initialArtist, 
    album: track.album,
    trackNumber: track.trackNumber || 0,
    durationMs: track.durationMs 
  };
  const trackKey = normalizeTrackKey(track.title, track.artist);
  currentTrackKey = trackKey;
  const targetLang = configStore.get('targetLanguage', 'en');
  console.log(`[MediaWatcher] Track changed to: ${track.title} by ${initialArtist} (req #${requestId})`);

  try {
    let metadata = null;
    const metadataPromise = coverService.fetchTrackMetadata(track.title, initialArtist, track.album);
    metadataPromise.then((meta) => {
      metadata = meta;
      if (signal.aborted || requestId !== trackChangeCounter || !meta) return;
      if (lastPlaybackState && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === trackKey) {
        if (meta.coverUrl) lastPlaybackState.coverUrl = meta.coverUrl;
        if (meta.album) lastPlaybackState.album = meta.album;
        if (meta.artist) lastPlaybackState.artist = meta.artist;
        if (meta.isExplicit !== undefined) lastPlaybackState.isExplicit = meta.isExplicit;
      }
      if (lastEnrichedLyrics && normalizeTrackKey(lastEnrichedLyrics.title, lastEnrichedLyrics.artist) === trackKey) {
        if (meta.coverUrl) lastEnrichedLyrics.coverUrl = meta.coverUrl;
        if (meta.album) lastEnrichedLyrics.album = meta.album;
        if (meta.artist) lastEnrichedLyrics.artist = meta.artist;
        if (meta.isExplicit !== undefined) lastEnrichedLyrics.isExplicit = meta.isExplicit;
      }
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('playback-state', {
          title: track.title,
          artist: meta.artist || initialArtist,
          album: meta.album || track.album || '',
          coverUrl: meta.coverUrl || null,
          isExplicit: meta.isExplicit,
          trackNumber: track.trackNumber || 0,
          durationMs: track.durationMs || 0
        });
      }
    }).catch(() => {});

    const lyricsPromise = lyricsService.fetchLyrics({
      title: track.title,
      artist: initialArtist,
      album: track.album,
      durationSec: track.durationMs ? track.durationMs / 1000 : 0,
      signal
    });

    // Fastest delivery path: resolve lyrics as quickly as possible without blocking on external cover APIs
    let rawLyrics = await lyricsPromise;

    // If another track change occurred while fetching, discard this stale result
    if (signal.aborted || requestId !== trackChangeCounter) {
      console.log(`[MediaWatcher] Discarding stale lyrics fetch for req #${requestId}`);
      return;
    }

    // If lyrics were not found on initial pass (e.g. track.album was empty on startup / mid-song),
    // wait for metadata to see if Deezer/iTunes resolved a valid album title to retry!
    if (!rawLyrics) {
      if (!metadata) metadata = await metadataPromise;
      if (signal.aborted || requestId !== trackChangeCounter) {
        console.log(`[MediaWatcher] Discarding stale lyrics fetch for req #${requestId}`);
        return;
      }
      const albumName = (metadata && metadata.album) ? metadata.album : '';
      if (albumName && albumName.toLowerCase() !== (track.album || '').toLowerCase()) {
        console.log(`[MediaWatcher] Re-trying lyrics with resolved album "${albumName}" for: ${track.title}`);
        rawLyrics = await lyricsService.fetchLyrics({
          title: track.title,
          artist: (metadata && metadata.artist) || initialArtist,
          album: albumName,
          durationSec: track.durationMs ? track.durationMs / 1000 : 0,
          signal
        });
        if (signal.aborted || requestId !== trackChangeCounter) {
          console.log(`[MediaWatcher] Discarding stale lyrics fetch for req #${requestId}`);
          return;
        }
      }
    }

    // Check synchronous cache for instant cover art if already known
    if (!metadata && coverService.memoryCache) {
      const cached = coverService.memoryCache.get(coverService.getCacheKey(track.title, initialArtist, track.album));
      if (cached) metadata = typeof cached === 'string' ? { coverUrl: cached } : cached;
    }

    const coverUrl = (metadata && metadata.coverUrl) || null;
    let isExplicit = (metadata && metadata.isExplicit) || false;
    const albumName = (metadata && metadata.album) || track.album || '';
    const fullArtist = (metadata && metadata.artist) || initialArtist;

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
      lastPlaybackState.album = albumName;
      lastPlaybackState.artist = fullArtist;
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('playback-state', lastPlaybackState);
      }
    }

    if (!rawLyrics) {
      if (retryCount < 1) {
        // Keep the UI in the smooth "Loading lyrics..." state while doing an immediate retry
        // after a short backoff for rate limits / transient API delays
        scheduleLyricsRetry({
          ...track,
          album: albumName || track.album,
          artist: fullArtist || track.artist
        }, requestId, retryCount);
        return;
      }

      lastEnrichedLyrics = {
        title: track.title,
        artist: fullArtist,
        album: albumName,
        coverUrl,
        isExplicit,
        synced: false,
        lines: [],
        isForeign: false,
        errorStatus: lyricsService.lastErrorStatus || null
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
    enriched.album = albumName || enriched.album || '';
    enriched.artist = fullArtist;
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
        artist: (currentTrack && currentTrack.artist) || track.artist,
        album: track.album || '',
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

  let trackChangeDebounceTimer = null;

  mediaWatcher.on('track-change', (track) => {
    const feat = extractFeaturedFromTitle(track.title);
    const initialArtist = feat ? combineArtists(track.artist, feat) : track.artist;
    // Send track-changing immediately for instant visual response (cover blur, title, artist)
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('track-changing', {
        title: track.title,
        artist: initialArtist,
        album: track.album || '',
        trackNumber: track.trackNumber || 0,
        positionMs: track.positionMs || 0,
        durationMs: track.durationMs || 0
      });
    }
    if (trackChangeDebounceTimer) {
      clearTimeout(trackChangeDebounceTimer);
    }
    trackChangeDebounceTimer = setTimeout(() => {
      trackChangeDebounceTimer = null;
      handleTrackChange({ ...track, artist: initialArtist });
    }, 120);
  });

  mediaWatcher.on('playback-state', (state) => {
    state.trackNumber = state.trackNumber || (currentTrack && currentTrack.trackNumber) || 0;
    const feat = extractFeaturedFromTitle(state.title);
    if (feat) {
      state.artist = combineArtists(state.artist, feat);
    }
    const stateKey = normalizeTrackKey(state.title, state.artist);

    // Inherit enriched full artist credits if available
    if (currentTrack && normalizeTrackKey(currentTrack.title, currentTrack.artist) === stateKey) {
      if (currentTrack.artist) {
        state.artist = currentTrack.artist;
      }
    } else if (lastPlaybackState && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === stateKey) {
      if (lastPlaybackState.artist) {
        state.artist = lastPlaybackState.artist;
      }
    } else if (lastEnrichedLyrics && normalizeTrackKey(lastEnrichedLyrics.title, lastEnrichedLyrics.artist) === stateKey) {
      if (lastEnrichedLyrics.artist) {
        state.artist = lastEnrichedLyrics.artist;
      }
    }

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
    if (!state.album) {
      if (lastPlaybackState && lastPlaybackState.album && normalizeTrackKey(lastPlaybackState.title, lastPlaybackState.artist) === stateKey) {
        state.album = lastPlaybackState.album;
      } else if (lastEnrichedLyrics && lastEnrichedLyrics.album && normalizeTrackKey(lastEnrichedLyrics.title, lastEnrichedLyrics.artist) === stateKey) {
        state.album = lastEnrichedLyrics.album;
      }
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

ipcMain.handle('retry-lyrics', async () => {
  if (currentTrack && currentTrack.title) {
    console.log(`[MediaWatcher] Manual retry triggered for: ${currentTrack.title} by ${currentTrack.artist}`);
    lyricsService.clearCache(currentTrack.title, currentTrack.artist);
    handleTrackChange(currentTrack);
    return true;
  }
  return false;
});

ipcMain.handle('clear-cache', async () => {
  try {
    lyricsService.clearAllCache();
    if (lyricsEnricher && lyricsEnricher.translationService) {
      lyricsEnricher.translationService.clearAllCache();
    }
    coverService.clearAllCache();
    if (currentTrack && currentTrack.title) {
      currentRawLyrics = null;
      lastEnrichedLyrics = null;
      handleTrackChange(currentTrack);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to clear cache:', err);
    return { success: false, error: err.message };
  }
});




app.on('window-all-closed', () => {
  mediaWatcher.stop();
  if (process.platform !== 'darwin') app.quit();
});
