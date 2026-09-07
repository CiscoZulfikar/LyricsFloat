document.addEventListener('DOMContentLoaded', async () => {
  const lyricsContainer = document.getElementById('lyrics-stream');
  const trackTitle = document.getElementById('track-title');
  const trackArtist = document.getElementById('track-artist');
  const trackProgressBar = document.getElementById('track-progress-bar');
  const trackCoverImg = document.getElementById('track-cover-img');
  const trackCoverFallback = document.getElementById('track-cover-fallback');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');
  const albumAmbientBackdrop = document.getElementById('album-ambient-backdrop');

  const btnRomaji = document.getElementById('btn-toggle-romaji');
  const btnTranslation = document.getElementById('btn-toggle-translation');
  const btnPin = document.getElementById('btn-pin');
  const btnSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnMin = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');

  const settingsModal = document.getElementById('settings-modal');
  const themeCards = document.querySelectorAll('.theme-card');
  const selectTargetLang = document.getElementById('select-target-lang');
  const checkShowRomaji = document.getElementById('check-show-romaji');
  const checkShowTranslation = document.getElementById('check-show-translation');
  const checkAlbumTint = document.getElementById('check-album-tint');
  const langCheckboxes = document.querySelectorAll('input[name="trans-lang"]');
  const btnLangAll = document.getElementById('btn-lang-all');
  const btnLangNone = document.getElementById('btn-lang-none');
  const rangeOpacity = document.getElementById('range-opacity');


  const opacityVal = document.getElementById('opacity-val');
  const rangeOrigSize = document.getElementById('range-orig-size');
  const origSizeVal = document.getElementById('orig-size-val');
  const rangeSubSize = document.getElementById('range-sub-size');
  const subSizeVal = document.getElementById('sub-size-val');

  const translationPill = document.getElementById('translation-status-pill');
  const pillSpinner = document.getElementById('pill-spinner');
  const pillIcon = document.getElementById('pill-icon');
  const pillText = document.getElementById('pill-text');
  let pillHideTimeout = null;
  let watchdogTimeout = null;

  function setTranslationLoading(isLoading, targetLang = '', immediate = false) {
    if (!btnTranslation) return;
    const isTranslationEnabled = !lyricsContainer.classList.contains('hide-translation');

    if (pillHideTimeout) {
      clearTimeout(pillHideTimeout);
      pillHideTimeout = null;
    }
    if (watchdogTimeout) {
      clearTimeout(watchdogTimeout);
      watchdogTimeout = null;
    }

    if (immediate || !isTranslationEnabled) {
      btnTranslation.classList.remove('translating');
      btnTranslation.title = 'Translation (Meaning)';
      if (translationPill) {
        translationPill.classList.add('hidden');
        if (pillSpinner) pillSpinner.style.display = 'none';
        if (pillIcon) pillIcon.style.display = 'none';
      }
      return;
    }

    if (isLoading) {
      btnTranslation.classList.add('translating');
      btnTranslation.title = 'Translating lyrics...';

      if (translationPill) {
        if (pillSpinner) pillSpinner.style.display = 'inline-block';
        if (pillIcon) pillIcon.style.display = 'none';
        if (pillText) {
          pillText.textContent = 'Translating lyrics...';
        }
        translationPill.classList.remove('hidden');
      }

      // Safety watchdog: emergency dead-man fallback in case of disconnected network (30s)
      watchdogTimeout = setTimeout(() => {
        setTranslationLoading(false, '', true);
      }, 30000);
    } else {
      btnTranslation.classList.remove('translating');
      btnTranslation.title = 'Translation (Meaning)';

      if (translationPill && !translationPill.classList.contains('hidden')) {
        if (pillSpinner) pillSpinner.style.display = 'none';
        if (pillIcon) pillIcon.style.display = 'inline-block';
        if (pillText) pillText.textContent = 'Translation ready';

        pillHideTimeout = setTimeout(() => {
          translationPill.classList.add('hidden');
          pillHideTimeout = null;
        }, 1200);
      }
    }
  }

  let currentDurationMs = 0;

  function formatTime(ms) {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  const syncEngine = new LyricsSyncEngine(lyricsContainer, (currentMs) => {
    if (timeCurrent) {
      timeCurrent.textContent = formatTime(currentMs);
    }
    if (currentDurationMs > 0 && trackProgressBar) {
      const pct = Math.min(100, Math.max(0, (currentMs / currentDurationMs) * 100));
      trackProgressBar.style.width = `${pct}%`;
    }
  });

  const THEMES = [
    'theme-neon-violet',
    'theme-cyberpunk-cyan',
    'theme-crimson-sunset',
    'theme-emerald-glass',
    'theme-nordic-frost'
  ];

  function applyTheme(themeName) {
    THEMES.forEach(t => document.body.classList.remove(t));
    const activeTheme = (themeName && THEMES.includes(themeName)) ? themeName : 'theme-neon-violet';
    document.body.classList.add(activeTheme);

    themeCards.forEach(card => {
      card.classList.toggle('active', card.dataset.theme === activeTheme);
    });
  }

  function setOriginalFontSize(sizePx) {
    const size = parseInt(sizePx, 10) || 22;
    document.documentElement.style.setProperty('--lyric-orig-size', `${size}px`);
    if (rangeOrigSize) rangeOrigSize.value = size;
    if (origSizeVal) origSizeVal.textContent = `${size}px`;
  }

  function setSubtextFontSize(sizePx) {
    const size = parseInt(sizePx, 10) || 12;
    document.documentElement.style.setProperty('--lyric-sub-size', `${size}px`);
    if (rangeSubSize) rangeSubSize.value = size;
    if (subSizeVal) subSizeVal.textContent = `${size}px`;
  }

  function setWindowOpacity(opacityFloat) {
    const clamped = Math.min(1.0, Math.max(0.80, Number(opacityFloat) || 0.95));
    document.documentElement.style.setProperty('--bg-alpha', clamped);
    if (rangeOpacity) {
      const pct = Math.round(clamped * 100);
      rangeOpacity.value = pct;
      if (opacityVal) opacityVal.textContent = `${pct}%`;
    }
  }


  function setCoverArt(url) {
    if (url) {
      trackCoverImg.src = url;
      trackCoverImg.onload = () => {
        trackCoverImg.style.display = 'block';
        if (trackCoverFallback) trackCoverFallback.style.display = 'none';
      };
      trackCoverImg.onerror = () => {
        trackCoverImg.style.display = 'none';
        if (trackCoverFallback) trackCoverFallback.style.display = 'flex';
      };

      if (albumAmbientBackdrop) {
        albumAmbientBackdrop.style.backgroundImage = `url("${url}")`;
      }
    } else {
      trackCoverImg.style.display = 'none';
      if (trackCoverFallback) trackCoverFallback.style.display = 'flex';
      if (albumAmbientBackdrop) {
        albumAmbientBackdrop.style.backgroundImage = 'none';
      }
    }
  }

  let currentTitle = '';

  function updateTitleMarquee(title, force = false) {
    if (!title || !trackTitle) return;
    const isSame = title === currentTitle;
    currentTitle = title;
    trackTitle.textContent = title;
    
    if (isSame && !force && trackTitle.style.animation && trackTitle.style.animation !== 'none') return;

    trackTitle.style.animation = 'none';
    trackTitle.style.transform = 'none';

    requestAnimationFrame(() => {
      const container = trackTitle.parentElement;
      if (!container) return;
      const overflow = trackTitle.scrollWidth - container.clientWidth;
      if (overflow > 4) {
        const duration = Math.max(7, Math.round((overflow / 18) + 4));
        const keyframeId = `marquee_${Math.round(overflow)}`;
        let styleTag = document.getElementById('dyn-marquee-style');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'dyn-marquee-style';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
          @keyframes ${keyframeId} {
            0%, 20% { transform: translateX(0); }
            55%, 75% { transform: translateX(-${overflow + 8}px); }
            100% { transform: translateX(0); }
          }
        `;
        trackTitle.style.animation = `${keyframeId} ${duration}s ease-in-out infinite`;
      } else {
        trackTitle.style.animation = 'none';
        trackTitle.style.transform = 'none';
      }
    });
  }

  const titleContainer = trackTitle ? trackTitle.parentElement : null;
  if (titleContainer && typeof ResizeObserver !== 'undefined') {
    const titleObserver = new ResizeObserver(() => {
      if (currentTitle) updateTitleMarquee(currentTitle, true);
    });
    titleObserver.observe(titleContainer);
  }

  window.addEventListener('resize', () => {
    if (currentTitle) updateTitleMarquee(currentTitle, true);
  });


  function applyPlaybackState(state) {
    if (!state) return;
    if (state.title) updateTitleMarquee(state.title);
    if (state.artist) trackArtist.textContent = state.artist;


    if (state.coverUrl) {
      setCoverArt(state.coverUrl);
    }

    if (state.durationMs > 0) {
      currentDurationMs = state.durationMs;
      if (timeDuration) timeDuration.textContent = formatTime(state.durationMs);
      const pct = Math.min(100, Math.max(0, (state.positionMs / state.durationMs) * 100));
      if (trackProgressBar) trackProgressBar.style.width = `${pct}%`;
    }

    if (timeCurrent && state.positionMs >= 0) {
      timeCurrent.textContent = formatTime(state.positionMs);
    }

    syncEngine.updatePlaybackState(state);
  }

  // Load initial state & configuration
  if (window.lyricsFloatAPI) {
    const initialState = await window.lyricsFloatAPI.getCurrentState();
    if (initialState) {
      const config = initialState.config;
      if (config) {
        if (config.theme) {
          applyTheme(config.theme);
        }
        if (config.originalFontSize) {
          setOriginalFontSize(config.originalFontSize);
        }
        if (config.subtextFontSize) {
          setSubtextFontSize(config.subtextFontSize);
        }
        if (config.showRomaji === false) {
          lyricsContainer.classList.add('hide-romaji');
          btnRomaji.classList.remove('active');
          checkShowRomaji.checked = false;
        }
        if (config.showTranslation === false) {
          lyricsContainer.classList.add('hide-translation');
          btnTranslation.classList.remove('active');
          checkShowTranslation.checked = false;
        }
        if (config.albumArtTint === false) {
          if (albumAmbientBackdrop) albumAmbientBackdrop.classList.add('disabled');
          if (checkAlbumTint) checkAlbumTint.checked = false;
        }
        if (Array.isArray(config.enabledTranslateLanguages)) {
          langCheckboxes.forEach(cb => {
            cb.checked = config.enabledTranslateLanguages.includes(cb.value);
          });
        }

        if (config.targetLanguage) {
          selectTargetLang.value = config.targetLanguage;
        }

        if (config.windowOpacity !== undefined) {
          setWindowOpacity(config.windowOpacity);
        }
        if (config.alwaysOnTop === false) {
          btnPin.classList.remove('active');
        }
      }

      if (initialState.playbackState) {
        applyPlaybackState(initialState.playbackState);
      }
      if (initialState.lyrics) {
        if (initialState.lyrics.coverUrl) {
          setCoverArt(initialState.lyrics.coverUrl);
        }
        syncEngine.loadLyrics(initialState.lyrics);
        setTranslationLoading(Boolean(initialState.lyrics.isTranslating), initialState.lyrics.targetLang);
      }
    }
  }

  // Theme Swatch Grid Selection
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const theme = card.dataset.theme;
      applyTheme(theme);
      if (window.lyricsFloatAPI) {
        window.lyricsFloatAPI.saveConfig('theme', theme);
      }
    });
  });

  // Font Size Sliders
  if (rangeOrigSize) {
    rangeOrigSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setOriginalFontSize(val);
      if (window.lyricsFloatAPI) {
        window.lyricsFloatAPI.saveConfig('originalFontSize', val);
      }
    });
  }

  if (rangeSubSize) {
    rangeSubSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSubtextFontSize(val);
      if (window.lyricsFloatAPI) {
        window.lyricsFloatAPI.saveConfig('subtextFontSize', val);
      }
    });
  }

  // Opacity Slider Handler
  if (rangeOpacity) {
    rangeOpacity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const opacityFloat = val / 100;
      setWindowOpacity(opacityFloat);
      if (window.lyricsFloatAPI) {
        window.lyricsFloatAPI.saveConfig('windowOpacity', opacityFloat);
      }
    });
  }

  // Album Art Background Tint Toggle
  if (checkAlbumTint) {
    checkAlbumTint.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      if (albumAmbientBackdrop) {
        albumAmbientBackdrop.classList.toggle('disabled', !isEnabled);
      }
      if (window.lyricsFloatAPI) {
        window.lyricsFloatAPI.saveConfig('albumArtTint', isEnabled);
      }
    });
  }

  // Toolbar Toggles
  btnRomaji.addEventListener('click', () => {
    const isHidden = lyricsContainer.classList.toggle('hide-romaji');
    btnRomaji.classList.toggle('active', !isHidden);
    checkShowRomaji.checked = !isHidden;
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showRomaji', !isHidden);
  });

  btnTranslation.addEventListener('click', () => {
    const isHidden = lyricsContainer.classList.toggle('hide-translation');
    btnTranslation.classList.toggle('active', !isHidden);
    checkShowTranslation.checked = !isHidden;
    if (isHidden && translationPill) {
      translationPill.classList.add('hidden');
      btnTranslation.classList.remove('translating');
    }
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showTranslation', !isHidden);
  });

  btnPin.addEventListener('click', () => {
    const isActive = btnPin.classList.toggle('active');
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.setAlwaysOnTop(isActive);
  });

  btnMin.addEventListener('click', () => {
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.minimizeWindow();
  });

  btnClose.addEventListener('click', () => {
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.closeWindow();
  });

  // Settings Modal Handlers
  btnSettings.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  selectTargetLang.addEventListener('change', (e) => {
    const targetLang = e.target.value;
    setTranslationLoading(true, targetLang);
    if (window.lyricsFloatAPI) {
      window.lyricsFloatAPI.setTargetLanguage(targetLang);
    }
  });

  checkShowRomaji.addEventListener('change', (e) => {
    const isVisible = e.target.checked;
    lyricsContainer.classList.toggle('hide-romaji', !isVisible);
    btnRomaji.classList.toggle('active', isVisible);
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showRomaji', isVisible);
  });

  checkShowTranslation.addEventListener('change', (e) => {
    const isVisible = e.target.checked;
    lyricsContainer.classList.toggle('hide-translation', !isVisible);
    btnTranslation.classList.toggle('active', isVisible);
    if (!isVisible && translationPill) {
      translationPill.classList.add('hidden');
      btnTranslation.classList.remove('translating');
    }
    if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showTranslation', isVisible);
  });

  function saveLanguageChecklist() {
    const selected = Array.from(langCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    if (window.lyricsFloatAPI) {
      window.lyricsFloatAPI.saveConfig('enabledTranslateLanguages', selected);
      window.lyricsFloatAPI.setEnabledLanguages(selected);
    }
  }

  langCheckboxes.forEach(cb => {
    cb.addEventListener('change', saveLanguageChecklist);
  });

  if (btnLangAll) {
    btnLangAll.addEventListener('click', () => {
      langCheckboxes.forEach(cb => cb.checked = true);
      saveLanguageChecklist();
    });
  }

  if (btnLangNone) {
    btnLangNone.addEventListener('click', () => {
      langCheckboxes.forEach(cb => cb.checked = false);
      saveLanguageChecklist();
    });
  }

  // In-App Changelog Toggle
  const changelogToggle = document.getElementById('changelog-toggle');
  const changelogBody = document.getElementById('changelog-body');
  const changelogArrow = document.getElementById('changelog-arrow');
  if (changelogToggle && changelogBody) {
    changelogToggle.addEventListener('click', () => {
      const isHidden = changelogBody.style.display === 'none' || !changelogBody.style.display;
      changelogBody.style.display = isHidden ? 'flex' : 'none';
      if (changelogArrow) {
        changelogArrow.textContent = isHidden ? '▲' : '▼';
      }
    });
  }

  // Collapsible Major Version Groups
  document.querySelectorAll('.group-header[data-toggle="group"]').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const arrow = header.querySelector('.group-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
    });
  });

  // Collapsible Minor Releases
  document.querySelectorAll('.release-header[data-toggle="release"]').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const arrow = header.querySelector('.release-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
    });
  });

  // IPC Event Subscriptions
  if (window.lyricsFloatAPI) {
    window.lyricsFloatAPI.onPlaybackState((state) => {
      applyPlaybackState(state);
    });

    window.lyricsFloatAPI.onLyricsLoaded((enrichedData) => {
      if (enrichedData && enrichedData.coverUrl) {
        setCoverArt(enrichedData.coverUrl);
      }
      syncEngine.loadLyrics(enrichedData);
      if (enrichedData && enrichedData.isTranslating) {
        setTranslationLoading(true, enrichedData.targetLang);
      } else {
        setTranslationLoading(false, '', true);
      }
    });

    window.lyricsFloatAPI.onLyricsTranslationUpdated((translationUpdate) => {
      syncEngine.updateTranslations(translationUpdate);
      const hasAny = Array.isArray(translationUpdate.lines) && translationUpdate.lines.some(l => l.translation && l.translation.trim().length > 0);
      if (hasAny) {
        setTranslationLoading(false);
      } else {
        setTranslationLoading(false, '', true);
      }
    });
  }
});
