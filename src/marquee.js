/**
 * LyricsFloat - Marquee Scrolling Manager
 * Dynamically monitors text overflow for track title & artist and animates smooth marquee scrolling.
 * Provides continuous non-resetting scrolling across controls visibility changes, unified harmonious
 * velocities across title & artist, and smooth gliding return when text fits.
 */

const MARQUEE_CONFIG = {
  SPEED: 26,             // Pixels per second (natural, comfortable reading speed)
  PAUSE_START: 2200,     // Milliseconds to pause at start (0px)
  PAUSE_END: 1800,       // Milliseconds to pause at end (maxScroll)
  FADE_WIDTH: 12,        // Gradient fade width in pixels
  RETURN_DURATION: 220   // Duration in ms for smooth glide back to origin
};

class MarqueeTrack {
  constructor(element, onNeedsLoop) {
    this.element = element;
    this.container = element ? element.parentElement : null;
    this.onNeedsLoop = onNeedsLoop;

    this.currentText = '';
    this.x = 0;
    this.state = 'IDLE'; // 'IDLE' | 'PAUSE_START' | 'SCROLL_LEFT' | 'PAUSE_END' | 'SCROLL_RIGHT' | 'RETURNING'
    this.stateTimer = 0;
    this.returnStartX = 0;
    this.isOverflowing = false;
  }

  getOverflow() {
    if (!this.element || !this.container) return 0;
    return this.element.scrollWidth - this.container.clientWidth;
  }

  updateText(text, force = false) {
    if (!this.element) return;
    const isSame = text === this.currentText;
    if (isSame && !force) return;

    if (!isSame) {
      this.currentText = text;
      this.element.textContent = text;
      this.resetImmediate();
    }

    this.checkOverflow();
  }

  checkOverflow() {
    if (!this.element || !this.container) return;
    const overflow = this.getOverflow();

    if (overflow > 4) {
      this.isOverflowing = true;
      this.container.classList.add('is-overflowing');

      if (this.state === 'IDLE') {
        this.state = 'PAUSE_START';
        this.stateTimer = 0;
        if (this.onNeedsLoop) this.onNeedsLoop();
      }
    } else {
      this.isOverflowing = false;
      if (this.state !== 'IDLE' && this.state !== 'RETURNING') {
        if (Math.abs(this.x) > 0.5) {
          this.state = 'RETURNING';
          this.returnStartX = this.x;
          this.stateTimer = 0;
          if (this.onNeedsLoop) this.onNeedsLoop();
        } else {
          this.resetImmediate();
        }
      }
    }
  }

  onResize() {
    if (this.currentText || (this.element && this.element.textContent && this.element.textContent.trim())) {
      if (!this.currentText && this.element) {
        this.currentText = this.element.textContent.trim();
      }
      this.checkOverflow();
    }
  }

  resetImmediate() {
    this.x = 0;
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.returnStartX = 0;
    this.isOverflowing = false;
    this.applyTransform(0, 0);
    if (this.container) {
      this.container.classList.remove('is-overflowing');
      this.container.style.removeProperty('--marquee-left-fade');
    }
  }

  smoothReset(onComplete) {
    if (Math.abs(this.x) <= 0.5) {
      this.resetImmediate();
      if (onComplete) onComplete();
      return;
    }

    this.state = 'RETURNING';
    this.returnStartX = this.x;
    this.stateTimer = 0;
    this.onCompleteCallback = onComplete;
    if (this.onNeedsLoop) this.onNeedsLoop();
  }

  step(dt) {
    if (!this.element || !this.container) return false;

    const overflow = this.getOverflow();
    const maxScroll = -(overflow + 8);

    // If text no longer overflows while moving, smoothly return to 0
    if (overflow <= 4) {
      if (this.state !== 'IDLE' && this.state !== 'RETURNING') {
        if (Math.abs(this.x) > 0.5) {
          this.state = 'RETURNING';
          this.returnStartX = this.x;
          this.stateTimer = 0;
        } else {
          this.resetImmediate();
          return false;
        }
      }
    } else {
      this.container.classList.add('is-overflowing');
      if (this.state === 'IDLE') {
        this.state = 'PAUSE_START';
        this.stateTimer = 0;
      }
    }

    if (this.state === 'IDLE') {
      return false;
    }

    if (this.state === 'RETURNING') {
      this.stateTimer += dt * 1000;
      const progress = Math.min(1, this.stateTimer / MARQUEE_CONFIG.RETURN_DURATION);
      // Snappy cubic ease-out: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      this.x = this.returnStartX * (1 - ease);

      const leftFade = Math.min(MARQUEE_CONFIG.FADE_WIDTH, Math.abs(this.x));
      this.applyTransform(this.x, leftFade);

      if (progress >= 1) {
        const cb = this.onCompleteCallback;
        this.onCompleteCallback = null;
        this.resetImmediate();
        if (cb) cb();
        return false;
      }
      return true;
    }

    if (this.state === 'PAUSE_START') {
      this.x = 0;
      this.stateTimer += dt * 1000;
      this.applyTransform(0, 0);
      if (this.stateTimer >= MARQUEE_CONFIG.PAUSE_START) {
        this.state = 'SCROLL_LEFT';
        this.stateTimer = 0;
      }
      return true;
    }

    if (this.state === 'SCROLL_LEFT') {
      this.x -= MARQUEE_CONFIG.SPEED * dt;
      if (this.x <= maxScroll) {
        this.x = maxScroll;
        this.state = 'PAUSE_END';
        this.stateTimer = 0;
      }
      const leftFade = Math.min(MARQUEE_CONFIG.FADE_WIDTH, Math.abs(this.x));
      this.applyTransform(this.x, leftFade);
      return true;
    }

    if (this.state === 'PAUSE_END') {
      // Keep clamped to current maxScroll if container resized
      this.x = maxScroll;
      this.stateTimer += dt * 1000;
      const leftFade = Math.min(MARQUEE_CONFIG.FADE_WIDTH, Math.abs(this.x));
      this.applyTransform(this.x, leftFade);

      if (this.stateTimer >= MARQUEE_CONFIG.PAUSE_END) {
        this.state = 'SCROLL_RIGHT';
        this.stateTimer = 0;
      }
      return true;
    }

    if (this.state === 'SCROLL_RIGHT') {
      this.x += MARQUEE_CONFIG.SPEED * dt;
      if (this.x >= 0) {
        this.x = 0;
        this.state = 'PAUSE_START';
        this.stateTimer = 0;
      }
      const leftFade = Math.min(MARQUEE_CONFIG.FADE_WIDTH, Math.abs(this.x));
      this.applyTransform(this.x, leftFade);
      return true;
    }

    return true;
  }

  applyTransform(x, leftFade) {
    if (!this.element) return;
    this.element.style.transform = (Math.abs(x) < 0.01) ? 'none' : `translateX(${x.toFixed(2)}px)`;
    if (this.container) {
      this.container.style.setProperty('--marquee-left-fade', `${Math.round(leftFade)}px`);
    }
  }
}

class MarqueeManager {
  constructor({ trackTitle, trackArtist, artworkAlbum, artworkTrack } = {}) {
    this.trackTitle = trackTitle || (typeof document !== 'undefined' ? document.getElementById('track-title') : null);
    this.trackArtist = trackArtist || (typeof document !== 'undefined' ? document.getElementById('track-artist') : null);
    this.artworkAlbum = artworkAlbum || (typeof document !== 'undefined' ? (document.getElementById('artwork-modal-album-wrapper') || document.getElementById('artwork-modal-album')) : null);
    this.artworkTrack = artworkTrack || (typeof document !== 'undefined' ? document.getElementById('artwork-modal-track') : null);

    this.rafId = null;
    this.lastTime = 0;

    const requestLoop = () => this.requestLoop();
    this.titleTrack = new MarqueeTrack(this.trackTitle, requestLoop);
    this.artistTrack = new MarqueeTrack(this.trackArtist, requestLoop);
    this.artworkAlbumTrack = this.artworkAlbum ? new MarqueeTrack(this.artworkAlbum, requestLoop) : null;
    this.artworkTrackTrack = this.artworkTrack ? new MarqueeTrack(this.artworkTrack, requestLoop) : null;

    this.titleObserver = null;
    this.artistObserver = null;
    this.modalAlbumObserver = null;
    this.modalTrackObserver = null;

    this.initObservers();
  }

  get currentTitle() {
    return this.titleTrack.currentText;
  }

  set currentTitle(v) {
    this.titleTrack.currentText = v;
  }

  get currentArtist() {
    return this.artistTrack.currentText;
  }

  set currentArtist(v) {
    this.artistTrack.currentText = v;
  }

  get isResettingTitle() {
    return this.titleTrack.state === 'RETURNING';
  }

  get isResettingArtist() {
    return this.artistTrack.state === 'RETURNING';
  }

  requestLoop() {
    if (this.rafId !== null) return;
    if (typeof requestAnimationFrame === 'undefined') return;

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    const tick = (now) => {
      const currentTime = now || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
      const dt = Math.min(0.1, Math.max(0.001, (currentTime - this.lastTime) / 1000));
      this.lastTime = currentTime;

      const titleActive = this.titleTrack.step(dt);
      const artistActive = this.artistTrack.step(dt);
      const modalAlbumActive = this.artworkAlbumTrack ? this.artworkAlbumTrack.step(dt) : false;
      const modalTrackActive = this.artworkTrackTrack ? this.artworkTrackTrack.step(dt) : false;

      if (titleActive || artistActive || modalAlbumActive || modalTrackActive) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  updateTitle(title, force = false) {
    this.titleTrack.updateText(title, force);
  }

  updateArtist(artist, force = false) {
    this.artistTrack.updateText(artist, force);
  }

  refresh() {
    this.titleTrack.onResize();
    this.artistTrack.onResize();
  }

  refreshArtwork() {
    if (this.artworkAlbumTrack && this.artworkAlbum) {
      const newAlbumText = this.artworkAlbum.textContent || '';
      if (newAlbumText !== this.artworkAlbumTrack.currentText) {
        this.artworkAlbumTrack.currentText = newAlbumText;
        this.artworkAlbumTrack.resetImmediate();
      }
      this.artworkAlbumTrack.checkOverflow();
    }
    if (this.artworkTrackTrack && this.artworkTrack) {
      const newTrackText = this.artworkTrack.textContent || '';
      if (newTrackText !== this.artworkTrackTrack.currentText) {
        this.artworkTrackTrack.currentText = newTrackText;
        this.artworkTrackTrack.resetImmediate();
      }
      this.artworkTrackTrack.checkOverflow();
    }
  }

  resetArtwork() {
    if (this.artworkAlbumTrack) this.artworkAlbumTrack.resetImmediate();
    if (this.artworkTrackTrack) this.artworkTrackTrack.resetImmediate();
  }

  getTranslateX(element) {
    if (!element) return 0;
    if (element === this.trackTitle) return this.titleTrack.x;
    if (element === this.trackArtist) return this.artistTrack.x;
    if (element === this.artworkAlbum) return this.artworkAlbumTrack ? this.artworkAlbumTrack.x : 0;
    if (element === this.artworkTrack) return this.artworkTrackTrack ? this.artworkTrackTrack.x : 0;

    try {
      if (typeof window === 'undefined') return 0;
      const style = window.getComputedStyle(element);
      const transform = style.transform;
      if (!transform || transform === 'none') return 0;
      if (typeof DOMMatrix !== 'undefined') {
        const matrix = new DOMMatrix(transform);
        return matrix.m41 || 0;
      }
      const match = transform.match(/matrix.*\((.+)\)/);
      if (match) {
        const parts = match[1].split(',');
        return parseFloat(parts[4]) || 0;
      }
    } catch (e) {
      return 0;
    }
    return 0;
  }

  smoothReset(element, container, onComplete) {
    if (!element) {
      if (onComplete) onComplete();
      return;
    }

    if (element === this.trackTitle) {
      this.titleTrack.smoothReset(onComplete);
      return;
    }
    if (element === this.trackArtist) {
      this.artistTrack.smoothReset(onComplete);
      return;
    }
    if (element === this.artworkAlbum && this.artworkAlbumTrack) {
      this.artworkAlbumTrack.smoothReset(onComplete);
      return;
    }
    if (element === this.artworkTrack && this.artworkTrackTrack) {
      this.artworkTrackTrack.smoothReset(onComplete);
      return;
    }

    if (onComplete) onComplete();
  }

  initObservers() {
    const titleContainer = this.trackTitle ? this.trackTitle.parentElement : null;
    if (titleContainer && typeof ResizeObserver !== 'undefined') {
      this.titleObserver = new ResizeObserver(() => {
        this.titleTrack.onResize();
      });
      this.titleObserver.observe(titleContainer);
    }

    const artistContainer = this.trackArtist ? this.trackArtist.parentElement : null;
    if (artistContainer && typeof ResizeObserver !== 'undefined') {
      this.artistObserver = new ResizeObserver(() => {
        this.artistTrack.onResize();
      });
      this.artistObserver.observe(artistContainer);
    }

    const modalAlbumContainer = this.artworkAlbum ? this.artworkAlbum.parentElement : null;
    if (modalAlbumContainer && typeof ResizeObserver !== 'undefined') {
      this.modalAlbumObserver = new ResizeObserver(() => {
        if (this.artworkAlbumTrack) {
          if (this.artworkAlbum) {
            this.artworkAlbumTrack.currentText = this.artworkAlbum.textContent || '';
          }
          this.artworkAlbumTrack.checkOverflow();
        }
      });
      this.modalAlbumObserver.observe(modalAlbumContainer);
    }

    const modalTrackContainer = this.artworkTrack ? this.artworkTrack.parentElement : null;
    if (modalTrackContainer && typeof ResizeObserver !== 'undefined') {
      this.modalTrackObserver = new ResizeObserver(() => {
        if (this.artworkTrackTrack) {
          if (this.artworkTrack) {
            this.artworkTrackTrack.currentText = this.artworkTrack.textContent || '';
          }
          this.artworkTrackTrack.checkOverflow();
        }
      });
      this.modalTrackObserver.observe(modalTrackContainer);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.refresh();
        this.refreshArtwork();
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.MarqueeManager = MarqueeManager;
  window.MarqueeTrack = MarqueeTrack;
}

if (typeof module !== 'undefined') {
  module.exports = { MarqueeManager, MarqueeTrack, MARQUEE_CONFIG };
}
