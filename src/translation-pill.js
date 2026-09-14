/**
 * LyricsFloat - Translation Status Pill Controller
 * Manages translation status pill, spinners, checkmark icon, and auto-hide timeouts.
 */

class TranslationPillController {
  constructor({ translationPill, pillSpinner, pillIcon, pillText, btnTranslation, lyricsContainer } = {}) {
    this.translationPill = translationPill || document.getElementById('translation-status-pill');
    this.pillSpinner = pillSpinner || document.getElementById('pill-spinner');
    this.pillIcon = pillIcon || document.getElementById('pill-icon');
    this.pillText = pillText || document.getElementById('pill-text');
    this.btnTranslation = btnTranslation || document.getElementById('btn-toggle-translation');
    this.lyricsContainer = lyricsContainer || document.getElementById('lyrics-stream');

    this.pillHideTimeout = null;
    this.watchdogTimeout = null;
  }

  setLoading(isLoading, targetLang = '', immediate = false) {
    if (!this.btnTranslation) return;
    const isTranslationEnabled = this.lyricsContainer && !this.lyricsContainer.classList.contains('hide-translation');

    if (this.pillHideTimeout) {
      clearTimeout(this.pillHideTimeout);
      this.pillHideTimeout = null;
    }
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }

    if (immediate || !isTranslationEnabled) {
      this.btnTranslation.classList.remove('translating');
      this.btnTranslation.title = 'Translation (Meaning)';
      if (this.translationPill) {
        this.translationPill.classList.add('hidden');
        if (this.pillSpinner) this.pillSpinner.style.display = 'none';
        if (this.pillIcon) this.pillIcon.style.display = 'none';
      }
      return;
    }

    if (isLoading) {
      this.btnTranslation.classList.add('translating');
      this.btnTranslation.title = 'Translating lyrics...';

      if (this.translationPill) {
        if (this.pillSpinner) this.pillSpinner.style.display = 'inline-block';
        if (this.pillIcon) this.pillIcon.style.display = 'none';
        if (this.pillText) {
          this.pillText.textContent = 'Translating lyrics...';
        }
        this.translationPill.classList.remove('hidden');
      }

      // Safety watchdog: emergency dead-man fallback in case of disconnected network (30s)
      this.watchdogTimeout = setTimeout(() => {
        this.setLoading(false, '', true);
      }, 30000);
    } else {
      this.btnTranslation.classList.remove('translating');
      this.btnTranslation.title = 'Translation (Meaning)';

      if (this.translationPill && !this.translationPill.classList.contains('hidden')) {
        if (this.pillSpinner) this.pillSpinner.style.display = 'none';
        if (this.pillIcon) this.pillIcon.style.display = 'inline-block';
        if (this.pillText) this.pillText.textContent = 'Translation ready';

        this.pillHideTimeout = setTimeout(() => {
          if (this.translationPill) {
            this.translationPill.classList.add('hidden');
          }
          this.pillHideTimeout = null;
        }, 1200);
      }
    }
  }

  reset() {
    this.setLoading(false, '', true);
  }
}

if (typeof window !== 'undefined') {
  window.TranslationPillController = TranslationPillController;
}
