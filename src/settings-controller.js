/**
 * LyricsFloat - Settings & Preferences Controller
 * Manages preferences modal, tabs, color themes, font size sliders, lyrics alignment, language checklist, window controls, and in-app changelog.
 */

const THEMES = [
  'theme-neon-violet',
  'theme-cyberpunk-cyan',
  'theme-crimson-sunset',
  'theme-emerald-glass',
  'theme-nordic-frost'
];

class SettingsController {
  constructor({
    syncEngine,
    settingsModal,
    btnSettings,
    btnCloseSettings,
    settingsTabBtns,
    settingsTabPanes,
    themeCards,
    alignmentBtns,
    selectTargetLang,
    checkShowRomaji,
    checkShowTranslation,
    checkAlbumTint,
    albumAmbientBackdrop,
    langCheckboxes,
    btnLangAll,
    btnLangNone,
    rangeOrigSize,
    origSizeVal,
    rangeSubSize,
    subSizeVal,
    btnPin,
    btnMin,
    btnClose,
    lyricsContainer,
    btnRomaji,
    btnTranslation,
    translationPill
  } = {}) {
    this.syncEngine = syncEngine;
    this.settingsModal = settingsModal || document.getElementById('settings-modal');
    this.btnSettings = btnSettings || document.getElementById('btn-open-settings');
    this.btnCloseSettings = btnCloseSettings || document.getElementById('btn-close-settings');
    this.settingsTabBtns = settingsTabBtns || document.querySelectorAll('.settings-tab-btn');
    this.settingsTabPanes = settingsTabPanes || document.querySelectorAll('.settings-tab-pane');
    this.themeCards = themeCards || document.querySelectorAll('.theme-card');
    this.alignmentBtns = alignmentBtns || document.querySelectorAll('.alignment-btn');
    this.selectTargetLang = selectTargetLang || document.getElementById('select-target-lang');
    this.checkShowRomaji = checkShowRomaji || document.getElementById('check-show-romaji');
    this.checkShowTranslation = checkShowTranslation || document.getElementById('check-show-translation');
    this.checkAlbumTint = checkAlbumTint || document.getElementById('check-album-tint');
    this.albumAmbientBackdrop = albumAmbientBackdrop || document.getElementById('album-ambient-backdrop');
    this.langCheckboxes = langCheckboxes || document.querySelectorAll('input[name="trans-lang"]');
    this.btnLangAll = btnLangAll || document.getElementById('btn-lang-all');
    this.btnLangNone = btnLangNone || document.getElementById('btn-lang-none');
    this.rangeOrigSize = rangeOrigSize || document.getElementById('range-orig-size');
    this.origSizeVal = origSizeVal || document.getElementById('orig-size-val');
    this.rangeSubSize = rangeSubSize || document.getElementById('range-sub-size');
    this.subSizeVal = subSizeVal || document.getElementById('sub-size-val');
    this.btnPin = btnPin || document.getElementById('btn-pin');
    this.btnMin = btnMin || document.getElementById('btn-minimize');
    this.btnClose = btnClose || document.getElementById('btn-close');
    this.lyricsContainer = lyricsContainer || document.getElementById('lyrics-stream');
    this.btnRomaji = btnRomaji || document.getElementById('btn-toggle-romaji');
    this.btnTranslation = btnTranslation || document.getElementById('btn-toggle-translation');
    this.translationPill = translationPill || document.getElementById('translation-status-pill');

    this.onTargetLangChange = null;
    this.closeTimeout = null;
    this.onOpen = null;

    this.bindEvents();
    this.bindChangelog();
  }

  openSettings() {
    if (!this.settingsModal) return;
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    if (this.onOpen) this.onOpen();
    this.settingsModal.classList.remove('hidden', 'closing');
    if (this.btnSettings) this.btnSettings.classList.add('active');
  }

  closeSettings() {
    if (!this.settingsModal || this.settingsModal.classList.contains('hidden') || this.settingsModal.classList.contains('closing')) return;
    this.settingsModal.classList.add('closing');
    if (this.btnSettings) this.btnSettings.classList.remove('active');

    if (this.closeTimeout) clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => {
      this.settingsModal.classList.add('hidden');
      this.settingsModal.classList.remove('closing');
      this.closeTimeout = null;
    }, 200);
  }

  toggleSettings() {
    if (!this.settingsModal) return;
    if (this.settingsModal.classList.contains('hidden') || this.settingsModal.classList.contains('closing')) {
      this.openSettings();
    } else {
      this.closeSettings();
    }
  }

  applyTheme(themeName) {
    THEMES.forEach(t => document.body.classList.remove(t));
    const activeTheme = (themeName && THEMES.includes(themeName)) ? themeName : 'theme-neon-violet';
    document.body.classList.add(activeTheme);

    this.themeCards.forEach(card => {
      card.classList.toggle('active', card.dataset.theme === activeTheme);
    });
  }

  setOriginalFontSize(sizePx) {
    const size = parseInt(sizePx, 10) || 22;
    document.documentElement.style.setProperty('--lyric-orig-size', `${size}px`);
    if (this.rangeOrigSize) this.rangeOrigSize.value = size;
    if (this.origSizeVal) this.origSizeVal.textContent = `${size}px`;
  }

  setSubtextFontSize(sizePx) {
    const size = parseInt(sizePx, 10) || 12;
    document.documentElement.style.setProperty('--lyric-sub-size', `${size}px`);
    if (this.rangeSubSize) this.rangeSubSize.value = size;
    if (this.subSizeVal) this.subSizeVal.textContent = `${size}px`;
  }

  setLyricsAlignment(align) {
    const validAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';
    if (this.lyricsContainer) {
      this.lyricsContainer.classList.remove('align-left', 'align-center', 'align-right');
      this.lyricsContainer.classList.add(`align-${validAlign}`);
    }
    this.alignmentBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === validAlign);
    });
    if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
      this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
    }
  }

  saveLanguageChecklist() {
    const selected = Array.from(this.langCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    if (window.lyricsFloatAPI) {
      window.lyricsFloatAPI.saveConfig('enabledTranslateLanguages', selected);
      window.lyricsFloatAPI.setEnabledLanguages(selected);
    }
  }

  bindEvents() {
    // Modal Open/Close
    if (this.btnSettings && this.settingsModal) {
      this.btnSettings.addEventListener('click', () => {
        this.toggleSettings();
      });
    }

    if (this.btnCloseSettings && this.settingsModal) {
      this.btnCloseSettings.addEventListener('click', () => {
        this.closeSettings();
      });
    }

    if (this.settingsModal) {
      this.settingsModal.addEventListener('click', (e) => {
        if (e.target === this.settingsModal) {
          this.closeSettings();
        }
      });
    }

    // Tab Switching
    this.settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this.settingsTabBtns.forEach(b => b.classList.toggle('active', b === btn));
        this.settingsTabPanes.forEach(pane => {
          pane.classList.toggle('active', pane.id === `tab-pane-${targetTab}`);
        });
      });
    });

    // Theme Selection
    this.themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        this.applyTheme(theme);
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.saveConfig('theme', theme);
        }
      });
    });

    // Font Size Sliders
    if (this.rangeOrigSize) {
      this.rangeOrigSize.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setOriginalFontSize(val);
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.saveConfig('originalFontSize', val);
        }
      });
    }

    if (this.rangeSubSize) {
      this.rangeSubSize.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setSubtextFontSize(val);
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.saveConfig('subtextFontSize', val);
        }
      });
    }

    // Alignment Buttons
    this.alignmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        this.setLyricsAlignment(align);
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.saveConfig('lyricsAlignment', align);
        }
      });
    });

    // Target Language Selection
    if (this.selectTargetLang) {
      this.selectTargetLang.addEventListener('change', (e) => {
        const targetLang = e.target.value;
        if (typeof this.onTargetLangChange === 'function') {
          this.onTargetLangChange(targetLang);
        }
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.setTargetLanguage(targetLang);
        }
      });
    }

    // Show Romaji Toggle (Settings & Toolbar)
    if (this.checkShowRomaji) {
      this.checkShowRomaji.addEventListener('change', (e) => {
        const isVisible = e.target.checked;
        if (this.lyricsContainer) this.lyricsContainer.classList.toggle('hide-romaji', !isVisible);
        if (this.btnRomaji) this.btnRomaji.classList.toggle('active', isVisible);
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showRomaji', isVisible);
      });
    }

    if (this.btnRomaji) {
      this.btnRomaji.addEventListener('click', () => {
        if (this.btnRomaji.classList.contains('disabled')) return;
        const isHidden = this.lyricsContainer ? this.lyricsContainer.classList.toggle('hide-romaji') : false;
        this.btnRomaji.classList.toggle('active', !isHidden);
        if (this.checkShowRomaji) this.checkShowRomaji.checked = !isHidden;
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showRomaji', !isHidden);
      });
    }

    // Show Translation Toggle (Settings & Toolbar)
    if (this.checkShowTranslation) {
      this.checkShowTranslation.addEventListener('change', (e) => {
        const isVisible = e.target.checked;
        if (this.lyricsContainer) this.lyricsContainer.classList.toggle('hide-translation', !isVisible);
        if (this.btnTranslation) this.btnTranslation.classList.toggle('active', isVisible);
        if (!isVisible && this.translationPill) {
          this.translationPill.classList.add('hidden');
          if (this.btnTranslation) this.btnTranslation.classList.remove('translating');
        }
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showTranslation', isVisible);
      });
    }

    if (this.btnTranslation) {
      this.btnTranslation.addEventListener('click', () => {
        if (this.btnTranslation.classList.contains('disabled')) return;
        const isHidden = this.lyricsContainer ? this.lyricsContainer.classList.toggle('hide-translation') : false;
        this.btnTranslation.classList.toggle('active', !isHidden);
        if (this.checkShowTranslation) this.checkShowTranslation.checked = !isHidden;
        if (isHidden && this.translationPill) {
          this.translationPill.classList.add('hidden');
          this.btnTranslation.classList.remove('translating');
        }
        if (this.syncEngine && this.syncEngine.activeIndex >= 0 && !this.syncEngine.isUserScrolling) {
          this.syncEngine.scrollToIndex(this.syncEngine.activeIndex, false);
        }
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.saveConfig('showTranslation', !isHidden);
      });
    }

    // Album Art Tint Toggle
    if (this.checkAlbumTint) {
      this.checkAlbumTint.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        if (this.albumAmbientBackdrop) {
          this.albumAmbientBackdrop.classList.toggle('disabled', !isEnabled);
        }
        if (window.lyricsFloatAPI) {
          window.lyricsFloatAPI.saveConfig('albumArtTint', isEnabled);
        }
      });
    }

    // Language Checklist
    this.langCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => this.saveLanguageChecklist());
    });

    if (this.btnLangAll) {
      this.btnLangAll.addEventListener('click', () => {
        this.langCheckboxes.forEach(cb => cb.checked = true);
        this.saveLanguageChecklist();
      });
    }

    if (this.btnLangNone) {
      this.btnLangNone.addEventListener('click', () => {
        this.langCheckboxes.forEach(cb => cb.checked = false);
        this.saveLanguageChecklist();
      });
    }

    // Window Controls
    if (this.btnPin) {
      this.btnPin.addEventListener('click', () => {
        const isActive = this.btnPin.classList.toggle('active');
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.setAlwaysOnTop(isActive);
      });
    }

    if (this.btnMin) {
      this.btnMin.addEventListener('click', () => {
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.minimizeWindow();
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        if (window.lyricsFloatAPI) window.lyricsFloatAPI.closeWindow();
      });
    }
  }

  bindChangelog() {
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
  }

  initFromConfig(config) {
    if (!config) return;

    if (config.theme) {
      this.applyTheme(config.theme);
    }
    if (config.originalFontSize) {
      this.setOriginalFontSize(config.originalFontSize);
    }
    if (config.subtextFontSize) {
      this.setSubtextFontSize(config.subtextFontSize);
    }
    if (config.showRomaji === false) {
      if (this.lyricsContainer) this.lyricsContainer.classList.add('hide-romaji');
      if (this.btnRomaji) this.btnRomaji.classList.remove('active');
      if (this.checkShowRomaji) this.checkShowRomaji.checked = false;
    }
    if (config.showTranslation === false) {
      if (this.lyricsContainer) this.lyricsContainer.classList.add('hide-translation');
      if (this.btnTranslation) this.btnTranslation.classList.remove('active');
      if (this.checkShowTranslation) this.checkShowTranslation.checked = false;
    }
    if (config.lyricsAlignment) {
      this.setLyricsAlignment(config.lyricsAlignment);
    } else {
      this.setLyricsAlignment('center');
    }
    if (config.albumArtTint === false) {
      if (this.albumAmbientBackdrop) this.albumAmbientBackdrop.classList.add('disabled');
      if (this.checkAlbumTint) this.checkAlbumTint.checked = false;
    }
    if (Array.isArray(config.enabledTranslateLanguages)) {
      this.langCheckboxes.forEach(cb => {
        cb.checked = config.enabledTranslateLanguages.includes(cb.value);
      });
    }
    if (config.targetLanguage && this.selectTargetLang) {
      this.selectTargetLang.value = config.targetLanguage;
    }
    if (config.alwaysOnTop === false && this.btnPin) {
      this.btnPin.classList.remove('active');
    }
  }
}

if (typeof window !== 'undefined') {
  window.SettingsController = SettingsController;
}
