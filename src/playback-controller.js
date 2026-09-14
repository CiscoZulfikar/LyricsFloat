/**
 * LyricsFloat - Media Playback & Timeline Controller
 * Manages media dock buttons, interactive timeline scrubbing, time display, spacebar shortcut, and jump-to-active chip.
 */

class PlaybackController {
  constructor({
    syncEngine,
    trackProgressBar,
    progressContainer,
    timeCurrent,
    timeDuration,
    btnPrev,
    btnPlayPause,
    btnNext,
    iconPlay,
    iconPause,
    btnJumpActive
  } = {}) {
    this.syncEngine = syncEngine;
    this.trackProgressBar = trackProgressBar || document.getElementById('track-progress-bar');
    this.progressContainer = progressContainer || document.querySelector('.track-progress-container');
    this.timeCurrent = timeCurrent || document.getElementById('time-current');
    this.timeDuration = timeDuration || document.getElementById('time-duration');
    this.btnPrev = btnPrev || document.getElementById('btn-prev');
    this.btnPlayPause = btnPlayPause || document.getElementById('btn-play-pause');
    this.btnNext = btnNext || document.getElementById('btn-next');
    this.iconPlay = iconPlay || document.getElementById('icon-play');
    this.iconPause = iconPause || document.getElementById('icon-pause');
    this.btnJumpActive = btnJumpActive || document.getElementById('btn-jump-active');

    this.currentDurationMs = 0;
    this.isScrubbing = false;

    this.bindEvents();
    this.bindJumpToActive();
  }

  formatTime(ms) {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  handleScrub(e) {
    if (!this.progressContainer || this.currentDurationMs <= 0) return;
    const rect = this.progressContainer.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetMs = Math.round(ratio * this.currentDurationMs);

    if (this.trackProgressBar) {
      this.trackProgressBar.style.width = `${ratio * 100}%`;
    }
    if (this.timeCurrent) {
      this.timeCurrent.textContent = this.formatTime(targetMs);
    }
    if (this.syncEngine) {
      this.syncEngine.scrubTo(targetMs);
    }
    return targetMs;
  }

  bindEvents() {
    // Interactive Progress Bar Scrubbing
    if (this.progressContainer) {
      this.progressContainer.addEventListener('mousedown', (e) => {
        if (this.currentDurationMs <= 0) return;
        this.isScrubbing = true;
        if (this.syncEngine) this.syncEngine.isScrubbing = true;
        this.progressContainer.classList.add('is-scrubbing');
        const targetMs = this.handleScrub(e);
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.seekPlayback && targetMs !== undefined) {
          window.lyricsFloatAPI.seekPlayback(targetMs);
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isScrubbing) return;
        this.handleScrub(e);
      });

      window.addEventListener('mouseup', (e) => {
        if (!this.isScrubbing) return;
        this.isScrubbing = false;
        this.progressContainer.classList.remove('is-scrubbing');
        const targetMs = this.handleScrub(e);
        if (this.syncEngine) {
          this.syncEngine.isScrubbing = false;
          this.syncEngine.updatePlaybackState({
            positionMs: targetMs,
            durationMs: this.currentDurationMs,
            isPlaying: true,
            isSeek: true
          });
        }
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.seekPlayback && targetMs !== undefined) {
          window.lyricsFloatAPI.seekPlayback(targetMs);
        }
      });

      window.addEventListener('blur', () => {
        if (!this.isScrubbing) return;
        this.isScrubbing = false;
        if (this.syncEngine) this.syncEngine.isScrubbing = false;
        this.progressContainer.classList.remove('is-scrubbing');
      });
    }

    // Media Buttons
    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => {
        this.btnPrev.blur();
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.controlPlayback) {
          window.lyricsFloatAPI.controlPlayback('previous');
        }
      });
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => {
        this.btnNext.blur();
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.controlPlayback) {
          window.lyricsFloatAPI.controlPlayback('next');
        }
      });
    }

    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => {
        this.btnPlayPause.blur();
        const currentlyPlaying = this.iconPause && this.iconPause.style.display !== 'none';
        const nextPlaying = !currentlyPlaying;
        if (this.iconPlay && this.iconPause) {
          this.iconPlay.style.display = nextPlaying ? 'none' : '';
          this.iconPause.style.display = nextPlaying ? '' : 'none';
          this.btnPlayPause.title = nextPlaying ? 'Pause (Space)' : 'Play (Space)';
        }
        if (this.syncEngine) {
          this.syncEngine.isPlaying = nextPlaying;
          this.syncEngine.lastStateTime = Date.now();
        }
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.controlPlayback) {
          window.lyricsFloatAPI.controlPlayback('play-pause');
        }
      });
    }

    // Dismiss focus when mouse leaves track banner so controls can collapse immediately
    const trackBanner = document.querySelector('.track-banner');
    if (trackBanner) {
      trackBanner.addEventListener('mouseleave', () => {
        const controlsRow = document.querySelector('.playback-controls-row');
        if (controlsRow && document.activeElement && controlsRow.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      });
    }

    // Spacebar Play/Pause Shortcut
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.btnPlayPause) this.btnPlayPause.click();
      }
    });
  }

  bindJumpToActive() {
    if (!this.syncEngine) return;

    this.syncEngine.onScrollDrift = (inView, direction) => {
      if (!this.btnJumpActive) return;
      if (inView) {
        this.btnJumpActive.classList.add('hidden');
        document.body.classList.remove('has-jump-active');
      } else {
        this.btnJumpActive.classList.remove('hidden');
        document.body.classList.add('has-jump-active');
        const arrow = this.btnJumpActive.querySelector('.jump-arrow');
        if (arrow) arrow.textContent = direction === 'up' ? '↑' : '↓';
      }
    };

    if (this.btnJumpActive) {
      this.btnJumpActive.addEventListener('click', () => {
        this.syncEngine.jumpToActive();
        document.body.classList.remove('has-jump-active');
      });
    }
  }

  updatePlaybackState(state) {
    if (!state) return;

    if (state.durationMs > 0) {
      this.currentDurationMs = state.durationMs;
      if (this.timeDuration) {
        this.timeDuration.textContent = this.formatTime(state.durationMs);
      }
    }

    if (this.isScrubbing) return;

    if (state.durationMs > 0) {
      const pct = Math.min(100, Math.max(0, (state.positionMs / state.durationMs) * 100));
      if (this.trackProgressBar) {
        this.trackProgressBar.style.width = `${pct}%`;
      }
    }

    if (this.timeCurrent && state.positionMs >= 0) {
      this.timeCurrent.textContent = this.formatTime(state.positionMs);
    }

    if (this.iconPlay && this.iconPause) {
      const isPlaying = Boolean(state.isPlaying);
      this.iconPlay.style.display = isPlaying ? 'none' : '';
      this.iconPause.style.display = isPlaying ? '' : 'none';
      if (this.btnPlayPause) {
        this.btnPlayPause.title = isPlaying ? 'Pause (Space)' : 'Play (Space)';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.PlaybackController = PlaybackController;
}
