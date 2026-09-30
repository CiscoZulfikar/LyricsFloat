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
  const artworkModalAlbum = document.getElementById('artwork-modal-album');
  const artworkModalTrack = document.getElementById('artwork-modal-track');
  const artworkModalBadgeExplicit = document.getElementById('artwork-modal-badge-explicit');
  const artworkModalAlbumBadgeExplicit = document.getElementById('artwork-modal-album-badge-explicit');
  const artworkModalTitle = document.getElementById('artwork-modal-title');
  const artworkModalDivider = document.getElementById('artwork-modal-divider');
  const artworkModalArtist = document.getElementById('artwork-modal-artist');
  const btnCloseArtwork = document.getElementById('btn-close-artwork');
  let artworkCloseTimeout = null;

  let currentCoverUrl = null;
  let currentTitle = '';
  let currentArtist = '';
  let currentAlbum = '';

  function updateArtworkModalInfo() {
    const alb = (currentAlbum || '').trim();
    const title = (currentTitle || '').trim();
    const artist = (currentArtist || '').trim();

    if (!artworkModalAlbum || !artworkModalTrack) return;

    if (alb) {
      // Line 1: Album name stands out as the prominent headline
      artworkModalAlbum.textContent = alb;
      artworkModalAlbum.title = alb;
      if (artworkModalAlbumBadgeExplicit) {
        artworkModalAlbumBadgeExplicit.classList.add('hidden');
      }

      // Line 2: Explicit badge + Song Title • Artist
      if (artworkModalBadgeExplicit) {
        artworkModalBadgeExplicit.classList.toggle('hidden', !currentIsExplicit);
      }

      if (title && artist) {
        if (artworkModalTitle) {
          artworkModalTitle.textContent = title;
          artworkModalTitle.style.display = 'inline';
        }
        if (artworkModalDivider) artworkModalDivider.style.display = 'inline';
        if (artworkModalArtist) {
          artworkModalArtist.textContent = artist;
          artworkModalArtist.style.display = 'inline';
        }
        artworkModalTrack.title = `${title} • ${artist}`;
      } else {
        const sub = title || artist;
        if (artworkModalTitle) {
          artworkModalTitle.textContent = sub;
          artworkModalTitle.style.display = 'inline';
        }
        if (artworkModalDivider) artworkModalDivider.style.display = 'none';
        if (artworkModalArtist) {
          artworkModalArtist.textContent = '';
          artworkModalArtist.style.display = 'none';
        }
        artworkModalTrack.title = sub;
      }
      artworkModalTrack.style.display = 'inline-flex';
    } else {
      // Fallback when album is unknown: Title stands out on Line 1, Artist on Line 2
      artworkModalAlbum.textContent = title || 'Unknown Title';
      artworkModalAlbum.title = title || '';
      if (artworkModalAlbumBadgeExplicit) {
        artworkModalAlbumBadgeExplicit.classList.toggle('hidden', !currentIsExplicit);
      }
      if (artworkModalBadgeExplicit) {
        artworkModalBadgeExplicit.classList.add('hidden');
      }

      if (artist) {
        if (artworkModalTitle) {
          artworkModalTitle.textContent = artist;
          artworkModalTitle.style.display = 'inline';
        }
        if (artworkModalDivider) artworkModalDivider.style.display = 'none';
        if (artworkModalArtist) {
          artworkModalArtist.textContent = '';
          artworkModalArtist.style.display = 'none';
        }
        artworkModalTrack.title = artist;
        artworkModalTrack.style.display = 'inline-flex';
      } else {
        artworkModalTrack.style.display = 'none';
      }
    }

    if (marquee && marquee.refreshArtwork) {
      requestAnimationFrame(() => {
        marquee.refreshArtwork();
      });
    }
  }

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
    updateArtworkModalInfo();
    artworkModal.classList.remove('hidden', 'closing');
    requestAnimationFrame(() => {
      if (marquee && marquee.refreshArtwork) {
        marquee.refreshArtwork();
      }
    });
    setTimeout(() => {
      if (marquee && marquee.refreshArtwork) {
        marquee.refreshArtwork();
      }
    }, 100);
    setTimeout(() => {
      if (marquee && marquee.refreshArtwork) {
        marquee.refreshArtwork();
      }
    }, 280);
  }

  function closeArtworkModal() {
    if (!artworkModal || artworkModal.classList.contains('hidden') || artworkModal.classList.contains('closing')) return;
    artworkModal.classList.add('closing');

    if (marquee && marquee.resetArtwork) {
      marquee.resetArtwork();
    }

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
        updateArtworkModalInfo();
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

  // Full-Size Artwork Modal Handlers (Dismissed by clicking backdrop, close button, or Escape key)
  if (trackCoverWrapper && artworkModal && artworkModalImg) {
    trackCoverWrapper.addEventListener('click', () => {
      openArtworkModal();
    });

    artworkModal.addEventListener('click', (e) => {
      if (e.target === artworkModal) {
        closeArtworkModal();
      }
    });

    if (btnCloseArtwork) {
      btnCloseArtwork.addEventListener('click', (e) => {
        e.stopPropagation();
        closeArtworkModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && artworkModal && !artworkModal.classList.contains('hidden')) {
        closeArtworkModal();
      }
    });

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
    const primaryArtist = a.split(/,|\s+(?:&|feat\.?|ft\.?)\s+/i)[0].trim();
    return `${t}___${primaryArtist}`;
  }

  let currentTrackKey = '';
  let loadedTrackKey = '';
  let pendingTrackKey = '';  // Track key we've already started loading (guards against double handleTrackSwitch)
  let lastEnrichedData = null;

  // State Transition Orchestration
  let isTransitioningOut = false;
  let pendingContentUpdate = null;
  let transitionOutTimer = null;
  let enterAnimationTimer = null;
  const EXIT_DURATION_MS = 180;
  const ENTER_DURATION_MS = 280;

  function triggerEntrance(enterClass) {
    if (!lyricsContainer || !lyricsContainer.classList) return;
    lyricsContainer.classList.remove('lyrics-loaded-enter', 'lyrics-loading-enter', 'lyrics-idle-enter', 'lyrics-fade-exit', 'lyrics-track-switching');
    void lyricsContainer.offsetWidth; // force reflow
    lyricsContainer.classList.add(enterClass);

    if (enterAnimationTimer) clearTimeout(enterAnimationTimer);
    enterAnimationTimer = setTimeout(() => {
      if (lyricsContainer && lyricsContainer.classList) {
        lyricsContainer.classList.remove(enterClass);
      }
      enterAnimationTimer = null;
    }, ENTER_DURATION_MS);
  }

  function executeContentTransition(updateFn, enterClass = 'lyrics-loaded-enter') {
    if (!lyricsContainer) {
      if (updateFn) updateFn();
      return;
    }

    const hasVisibleContent = Boolean(
      lyricsContainer.querySelector('.lyric-line') ||
      lyricsContainer.querySelector('.lyrics-idle-message') ||
      lyricsContainer.querySelector('.lyrics-loading-state')
    );

    // If an exit animation is already in flight, queue the newest content update
    if (isTransitioningOut) {
      pendingContentUpdate = { updateFn, enterClass };
      return;
    }

    if (!hasVisibleContent) {
      if (updateFn) updateFn();
      triggerEntrance(enterClass);
      return;
    }

    // Play smooth fade-out exit animation
    isTransitioningOut = true;
    pendingContentUpdate = { updateFn, enterClass };

    lyricsContainer.classList.remove('lyrics-loaded-enter', 'lyrics-loading-enter', 'lyrics-idle-enter');
    lyricsContainer.classList.add('lyrics-fade-exit');

    if (transitionOutTimer) clearTimeout(transitionOutTimer);
    transitionOutTimer = setTimeout(() => {
      isTransitioningOut = false;
      transitionOutTimer = null;

      lyricsContainer.classList.remove('lyrics-fade-exit', 'lyrics-track-switching');

      const target = pendingContentUpdate;
      pendingContentUpdate = null;

      if (target && target.updateFn) {
        target.updateFn();
        triggerEntrance(target.enterClass);
        updateToolbarCapabilities();
      }
    }, EXIT_DURATION_MS);
  }

  function handleTrackSwitch(newTitle, newArtist) {
    const newTrackKey = normalizeTrackKey(newTitle, newArtist);
    if (newTrackKey && (newTrackKey === loadedTrackKey || newTrackKey === pendingTrackKey)) return;

    pendingTrackKey = newTrackKey;

    if (newTitle) currentTitle = newTitle;
    if (newArtist) currentArtist = newArtist;

    executeContentTransition(() => {
      syncEngine.showLoading(newTitle, newArtist);
    }, 'lyrics-loading-enter');

    translationPill.setLoading(false, '', true);
    setExplicitBadge(false);
  }

  if (playbackController) {
    playbackController.onTrackChangeRequested = (action) => {
      if (action === 'previous') {
        // Rewinding or restarting track: keep current lyrics intact and reset sync position to beginning.
        // If an actual track change occurs, MediaWatcher will detect it and transition cleanly.
        if (syncEngine && syncEngine.syncPosition) {
          syncEngine.syncPosition(0);
        }
        return;
      }
      // For other actions (e.g. next), MediaWatcher transitions cleanly upon detecting the new track
    };
  }

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
    if (artworkModalBadgeExplicit) {
      artworkModalBadgeExplicit.classList.toggle('hidden', !explicit);
    }
    if (artworkModalAlbumBadgeExplicit) {
      artworkModalAlbumBadgeExplicit.classList.toggle('hidden', !explicit);
    }
    if (artworkModal && !artworkModal.classList.contains('hidden')) {
      updateArtworkModalInfo();
    }
    if (marquee) {
      marquee.refresh();
      if (marquee.refreshArtwork) marquee.refreshArtwork();
    }
  }

  function applyPlaybackState(state) {
    if (!state) return;

    const newTrackKey = normalizeTrackKey(state.title, state.artist);
    const isNewTrack = Boolean(newTrackKey && (!currentTrackKey || newTrackKey !== currentTrackKey));

    if (isNewTrack) {
      currentTrackKey = newTrackKey;
      // handleTrackSwitch itself checks pendingTrackKey to prevent double-fire
      if (loadedTrackKey !== newTrackKey) {
        handleTrackSwitch(state.title, state.artist);
        if (!state.coverUrl) setCoverArt(null);
      }
    } else {
      // If same track is playing but lyrics were wiped or lost (e.g. after rewind/transition),
      // restore from cached lastEnrichedData immediately instead of getting stuck in loading!
      if (newTrackKey && lastEnrichedData && normalizeTrackKey(lastEnrichedData.title, lastEnrichedData.artist) === newTrackKey) {
        if (Array.isArray(lastEnrichedData.lines) && lastEnrichedData.lines.length > 0) {
          if (!syncEngine.lines || syncEngine.lines.length === 0) {
            syncEngine.loadLyrics(lastEnrichedData);
            updateToolbarCapabilities();
            translationPill.setLoading(Boolean(lastEnrichedData.isTranslating), lastEnrichedData.targetLang);
          }
        }
      }
    }

    if (state.isExplicit !== undefined) {
      setExplicitBadge(state.isExplicit);
    }

    if (state.title) currentTitle = state.title;
    if (state.artist) currentArtist = state.artist;
    if (state.album) currentAlbum = state.album;
    if (artworkModal && !artworkModal.classList.contains('hidden')) {
      updateArtworkModalInfo();
    }

    if (state.title) marquee.updateTitle(state.title);
    if (state.artist) marquee.updateArtist(state.artist);
    if (state.coverUrl) setCoverArt(state.coverUrl);

    playbackController.updatePlaybackState(state);
    syncEngine.updatePlaybackState(state);
  }

  // Click-to-retry when lyrics are unavailable
  if (lyricsContainer) {
    lyricsContainer.addEventListener('click', (e) => {
      const idleMsg = lyricsContainer.querySelector('.lyrics-idle-message:not(.lyrics-loading-state)');
      if (idleMsg && idleMsg.contains(e.target)) {
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.retryLyrics) {
          syncEngine.showLoading(currentTitle, currentArtist, 10000);
          window.lyricsFloatAPI.retryLyrics();
        }
      }
    });
  }

  // 3. Register IPC Event Subscriptions FIRST before any await to avoid race conditions
  if (window.lyricsFloatAPI) {
    if (window.lyricsFloatAPI.onTrackChanging) {
      window.lyricsFloatAPI.onTrackChanging((track) => {
        if (track?.title) currentTitle = track.title;
        if (track?.artist) currentArtist = track.artist;
        if (track?.album) currentAlbum = track.album;
        if (artworkModal && !artworkModal.classList.contains('hidden')) {
          updateArtworkModalInfo();
        }
        const key = normalizeTrackKey(track?.title, track?.artist);
        if (key && key !== currentTrackKey) {
          currentTrackKey = key;
          handleTrackSwitch(track.title, track.artist);
        }
      });
    }

    window.lyricsFloatAPI.onPlaybackState((state) => {
      applyPlaybackState(state);
    });

    window.lyricsFloatAPI.onLyricsLoaded((enrichedData) => {
      lastEnrichedData = enrichedData;
      if (enrichedData?.title) currentTitle = enrichedData.title;
      if (enrichedData?.artist) {
        currentArtist = enrichedData.artist;
        marquee.updateArtist(enrichedData.artist);
      }
      if (enrichedData?.album) currentAlbum = enrichedData.album;
      if (artworkModal && !artworkModal.classList.contains('hidden')) {
        updateArtworkModalInfo();
      }
      const enrichedKey = normalizeTrackKey(enrichedData?.title, enrichedData?.artist);
      if (enrichedKey) {
        loadedTrackKey = enrichedKey;
        currentTrackKey = enrichedKey;
        pendingTrackKey = '';  // Loading complete; clear the guard
      }
      if (enrichedData && enrichedData.coverUrl) {
        setCoverArt(enrichedData.coverUrl);
      }
      if (enrichedData && enrichedData.isExplicit !== undefined) {
        setExplicitBadge(enrichedData.isExplicit);
      }

      executeContentTransition(() => {
        syncEngine.loadLyrics(enrichedData);
      }, 'lyrics-loaded-enter');

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
        if (Array.isArray(lastEnrichedData.lines) && Array.isArray(translationUpdate.lines)) {
          translationUpdate.lines.forEach((t, i) => {
            if (lastEnrichedData.lines[i]) {
              lastEnrichedData.lines[i].translation = t.translation;
            }
          });
        }
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

    // 4. Load Initial Configuration & Playback State
    const initialState = await window.lyricsFloatAPI.getCurrentState();
    if (initialState) {
      if (initialState.config) {
        settingsController.initFromConfig(initialState.config);
      }
      if (initialState.lyrics) {
        lastEnrichedData = initialState.lyrics;
        currentTitle = initialState.lyrics.title || '';
        currentArtist = initialState.lyrics.artist || '';
        currentAlbum = initialState.lyrics.album || '';
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
        executeContentTransition(() => {
          syncEngine.loadLyrics(initialState.lyrics);
        }, 'lyrics-loaded-enter');
        updateToolbarCapabilities();
        translationPill.setLoading(Boolean(initialState.lyrics.isTranslating), initialState.lyrics.targetLang);
      } else if (initialState.playbackState && initialState.playbackState.title) {
        currentTitle = initialState.playbackState.title || '';
        currentArtist = initialState.playbackState.artist || '';
        currentAlbum = initialState.playbackState.album || '';
        applyPlaybackState(initialState.playbackState);
      }
      if (initialState.playbackState) {
        playbackController.updatePlaybackState(initialState.playbackState);
        syncEngine.updatePlaybackState(initialState.playbackState);
      }
    }
  }
});
