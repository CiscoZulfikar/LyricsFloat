/**
 * LyricsFloat - Main Application Orchestrator
 * Coordinates UI controllers, lyrics sync engine, IPC events, and native Spotify media state.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const lyricsContainer = document.getElementById('lyrics-stream');
  const albumAmbientBackdrop = document.getElementById('album-ambient-backdrop');
  const trackCoverImg = document.getElementById('track-cover-img');
  const trackCoverFallback = document.getElementById('track-cover-fallback');
  const btnRomaji = document.getElementById('btn-toggle-romaji');
  const btnTranslation = document.getElementById('btn-toggle-translation');

  // 1. Initialize Sub-Controllers
  const translationPill = new TranslationPillController();
  const marquee = new MarqueeManager();

  let playbackController = null;
  const syncEngine = new LyricsSyncEngine(lyricsContainer, (currentMs) => {
    if (playbackController && playbackController.isScrubbing) return;
    if (playbackController) {
      if (playbackController.timeCurrent) {
        playbackController.timeCurrent.textContent = playbackController.formatTime(currentMs);
      }
      if (playbackController.currentDurationMs > 0 && playbackController.trackProgressBar) {
        const pct = Math.min(100, Math.max(0, (currentMs / playbackController.currentDurationMs) * 100));
        playbackController.trackProgressBar.style.width = `${pct}%`;
      }
    }
  });

  playbackController = new PlaybackController({ syncEngine });

  const settingsController = new SettingsController({
    syncEngine,
    lyricsContainer,
    btnRomaji,
    btnTranslation,
    albumAmbientBackdrop,
    translationPill: translationPill.translationPill
  });

  settingsController.onTargetLangChange = (targetLang) => {
    translationPill.setLoading(true, targetLang);
  };

  settingsController.onOpen = () => {
    if (artworkModal && !artworkModal.classList.contains('hidden')) {
      closeArtworkModal();
    }
  };

  const trackCoverWrapper = document.getElementById('track-cover-wrapper');
  const artworkModal = document.getElementById('artwork-modal');
  const artworkModalImg = document.getElementById('artwork-modal-img');
  const btnCloseArtwork = document.getElementById('btn-close-artwork');
  let artworkCloseTimeout = null;

  function openArtworkModal() {
    if (!currentCoverUrl || !artworkModal || !artworkModalImg) return;
    if (settingsController) {
      settingsController.closeSettings();
    }
    if (artworkCloseTimeout) {
      clearTimeout(artworkCloseTimeout);
      artworkCloseTimeout = null;
    }
    artworkModalImg.src = currentCoverUrl;
    artworkModal.classList.remove('hidden', 'closing');
  }

  function closeArtworkModal() {
    if (!artworkModal || artworkModal.classList.contains('hidden') || artworkModal.classList.contains('closing')) return;
    artworkModal.classList.add('closing');

    if (artworkCloseTimeout) clearTimeout(artworkCloseTimeout);
    artworkCloseTimeout = setTimeout(() => {
      artworkModal.classList.add('hidden');
      artworkModal.classList.remove('closing');
      artworkCloseTimeout = null;
    }, 220);
  }

  // 2. Cover Art & Visual Ambient Tint
  function setCoverArt(url) {
    currentCoverUrl = url || null;
    if (url) {
      if (trackCoverImg) {
        trackCoverImg.src = url;
        trackCoverImg.onload = () => {
          trackCoverImg.style.display = 'block';
          if (trackCoverFallback) trackCoverFallback.style.display = 'none';
          if (trackCoverWrapper) {
            trackCoverWrapper.classList.add('has-cover');
            trackCoverWrapper.title = 'Click to view artwork';
          }
        };
        trackCoverImg.onerror = () => {
          trackCoverImg.style.display = 'none';
          if (trackCoverFallback) trackCoverFallback.style.display = 'flex';
          if (trackCoverWrapper) {
            trackCoverWrapper.classList.remove('has-cover');
            trackCoverWrapper.title = '';
          }
        };
      }
      if (albumAmbientBackdrop) {
        albumAmbientBackdrop.style.backgroundImage = `url("${url}")`;
      }
      if (artworkModal && !artworkModal.classList.contains('hidden') && artworkModalImg) {
        artworkModalImg.src = url;
      }
    } else {
      if (trackCoverImg) trackCoverImg.style.display = 'none';
      if (trackCoverFallback) trackCoverFallback.style.display = 'flex';
      if (trackCoverWrapper) {
        trackCoverWrapper.classList.remove('has-cover');
        trackCoverWrapper.title = '';
      }
      if (albumAmbientBackdrop) albumAmbientBackdrop.style.backgroundImage = 'none';
      if (artworkModal && !artworkModal.classList.contains('hidden')) {
        closeArtworkModal();
      }
    }
  }

  // Full-Size Artwork Modal Handlers (Dismissed by click, no Esc key)
  if (trackCoverWrapper && artworkModal && artworkModalImg) {
    trackCoverWrapper.addEventListener('click', () => {
      openArtworkModal();
    });

    artworkModal.addEventListener('click', () => {
      closeArtworkModal();
    });

    if (btnCloseArtwork) {
      btnCloseArtwork.addEventListener('click', (e) => {
        e.stopPropagation();
        closeArtworkModal();
      });
    }

    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        if (artworkModal && !artworkModal.classList.contains('hidden')) {
          closeArtworkModal();
        }
      });
    }
  }

  function normalizeTrackKey(title, artist) {
    const t = (title || '').trim().normalize('NFC').toLowerCase();
    const a = (artist || '').trim().normalize('NFC').toLowerCase();
    return `${t}___${a}`;
  }

  let currentTrackKey = '';
  let loadedTrackKey = '';
  let lastEnrichedData = null;

  function updateToolbarCapabilities() {
    if (!syncEngine) return;
    const hasRomaji = syncEngine.hasRomaji();
    const hasTrans = syncEngine.hasTranslation();
    const isTranslating = Boolean(lastEnrichedData && lastEnrichedData.isTranslating);

    if (btnRomaji) {
      btnRomaji.classList.toggle('disabled', !hasRomaji);
      btnRomaji.title = hasRomaji ? 'Pronunciation / Romaji (あ→a)' : 'Romaji unavailable for this track';
    }

    if (btnTranslation) {
      btnTranslation.classList.toggle('disabled', !hasTrans && !isTranslating);
      btnTranslation.title = (hasTrans || isTranslating)
        ? 'Translation (Meaning)'
        : 'Translation unavailable for this track';
    }
  }

  const badgeExplicit = document.getElementById('badge-explicit');
  let currentIsExplicit = false;

  function setExplicitBadge(isExplicit) {
    const explicit = Boolean(isExplicit);
    if (currentIsExplicit === explicit) return;
    currentIsExplicit = explicit;
    if (badgeExplicit) {
      badgeExplicit.classList.toggle('hidden', !explicit);
    }
    if (marquee) {
      marquee.refresh();
    }
  }

  function applyPlaybackState(state) {
    if (!state) return;

    const newTrackKey = normalizeTrackKey(state.title, state.artist);
    const isNewTrack = Boolean(newTrackKey && currentTrackKey && newTrackKey !== currentTrackKey);

    if (isNewTrack) {
      currentTrackKey = newTrackKey;
      if (loadedTrackKey !== newTrackKey) {
        syncEngine.showLoading(state.title, state.artist);
        translationPill.setLoading(false, '', true);
        if (!state.coverUrl) setCoverArt(null);
        if (state.isExplicit === undefined) setExplicitBadge(false);
      }
    } else if (!currentTrackKey && newTrackKey) {
      currentTrackKey = newTrackKey;
    }

    if (state.isExplicit !== undefined) {
      setExplicitBadge(state.isExplicit);
    }

    if (state.title) marquee.updateTitle(state.title);
    if (state.artist) marquee.updateArtist(state.artist);
    if (state.coverUrl) setCoverArt(state.coverUrl);

    playbackController.updatePlaybackState(state);
    syncEngine.updatePlaybackState(state);
  }

  // 3. Load Initial Configuration & Playback State
  if (window.lyricsFloatAPI) {
    const initialState = await window.lyricsFloatAPI.getCurrentState();
    if (initialState) {
      if (initialState.config) {
        settingsController.initFromConfig(initialState.config);
      }
      if (initialState.playbackState) {
        applyPlaybackState(initialState.playbackState);
      }
      if (initialState.lyrics) {
        lastEnrichedData = initialState.lyrics;
        const initialLyricsKey = normalizeTrackKey(initialState.lyrics.title, initialState.lyrics.artist);
        if (initialLyricsKey) {
          loadedTrackKey = initialLyricsKey;
          currentTrackKey = initialLyricsKey;
        }
        if (initialState.lyrics.coverUrl) {
          setCoverArt(initialState.lyrics.coverUrl);
        }
        if (initialState.lyrics.isExplicit !== undefined) {
          setExplicitBadge(initialState.lyrics.isExplicit);
        }
        syncEngine.loadLyrics(initialState.lyrics);
        updateToolbarCapabilities();
        translationPill.setLoading(Boolean(initialState.lyrics.isTranslating), initialState.lyrics.targetLang);
      }
    }

    // 4. IPC Event Subscriptions
    window.lyricsFloatAPI.onPlaybackState((state) => {
      applyPlaybackState(state);
    });

    window.lyricsFloatAPI.onLyricsLoaded((enrichedData) => {
      lastEnrichedData = enrichedData;
      const enrichedKey = normalizeTrackKey(enrichedData?.title, enrichedData?.artist);
      if (enrichedKey) {
        loadedTrackKey = enrichedKey;
        currentTrackKey = enrichedKey;
      }
      if (enrichedData && enrichedData.coverUrl) {
        setCoverArt(enrichedData.coverUrl);
      }
      if (enrichedData && enrichedData.isExplicit !== undefined) {
        setExplicitBadge(enrichedData.isExplicit);
      }
      syncEngine.loadLyrics(enrichedData);
      updateToolbarCapabilities();

      const hasTranslations = Array.isArray(enrichedData?.lines) &&
        enrichedData.lines.some(l => l.translation && l.translation.trim().length > 0);

      if (hasTranslations || !enrichedData?.isTranslating) {
        translationPill.setLoading(false, '', true);
      } else {
        translationPill.setLoading(true, enrichedData.targetLang);
      }
    });

    window.lyricsFloatAPI.onLyricsTranslationUpdated((translationUpdate) => {
      if (lastEnrichedData) {
        lastEnrichedData.isTranslating = false;
      }
      syncEngine.updateTranslations(translationUpdate);
      updateToolbarCapabilities();

      const hasAny = Array.isArray(translationUpdate.lines) &&
        translationUpdate.lines.some(l => l.translation && l.translation.trim().length > 0);

      if (hasAny) {
        translationPill.setLoading(false);
      } else {
        translationPill.setLoading(false, '', true);
      }
    });
  }
});
