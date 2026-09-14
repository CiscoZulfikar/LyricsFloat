/**
 * LyricsFloat - Marquee Scrolling Manager
 * Dynamically monitors text overflow for track title & artist and animates smooth marquee scrolling.
 */

class MarqueeManager {
  constructor({ trackTitle, trackArtist } = {}) {
    this.trackTitle = trackTitle || document.getElementById('track-title');
    this.trackArtist = trackArtist || document.getElementById('track-artist');

    this.currentTitle = '';
    this.currentArtist = '';
    this.titleObserver = null;
    this.artistObserver = null;

    this.initObservers();
  }

  updateTitle(title, force = false) {
    if (!title || !this.trackTitle) return;
    const isSame = title === this.currentTitle;
    this.currentTitle = title;
    this.trackTitle.textContent = title;

    if (isSame && !force && this.trackTitle.style.animation && this.trackTitle.style.animation !== 'none') return;

    this.trackTitle.style.animation = 'none';
    this.trackTitle.style.transform = 'none';
    if (this.trackTitle.parentElement) {
      this.trackTitle.parentElement.style.animation = 'none';
    }

    requestAnimationFrame(() => {
      if (!this.trackTitle) return;
      const container = this.trackTitle.parentElement;
      if (!container) return;
      const overflow = this.trackTitle.scrollWidth - container.clientWidth;
      if (overflow > 4) {
        container.classList.add('is-overflowing');
        const duration = Math.max(7, Math.round((overflow / 18) + 4));
        const keyframeId = `marquee_${Math.round(overflow)}`;
        const maskKeyframeId = `mask_${Math.round(overflow)}`;
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
          @keyframes ${maskKeyframeId} {
            0%, 20% { --marquee-left-fade: 0px; }
            26%, 93% { --marquee-left-fade: 12px; }
            99%, 100% { --marquee-left-fade: 0px; }
          }
        `;
        this.trackTitle.style.animation = `${keyframeId} ${duration}s ease-in-out infinite`;
        container.style.animation = `${maskKeyframeId} ${duration}s ease-in-out infinite`;
      } else {
        container.classList.remove('is-overflowing');
        container.style.animation = 'none';
        this.trackTitle.style.animation = 'none';
        this.trackTitle.style.transform = 'none';
      }
    });
  }

  updateArtist(artist, force = false) {
    if (!artist || !this.trackArtist) return;
    const isSame = artist === this.currentArtist;
    this.currentArtist = artist;
    this.trackArtist.textContent = artist;

    if (isSame && !force && this.trackArtist.style.animation && this.trackArtist.style.animation !== 'none') return;

    this.trackArtist.style.animation = 'none';
    this.trackArtist.style.transform = 'none';
    if (this.trackArtist.parentElement) {
      this.trackArtist.parentElement.style.animation = 'none';
    }

    requestAnimationFrame(() => {
      if (!this.trackArtist) return;
      const container = this.trackArtist.parentElement;
      if (!container) return;
      const overflow = this.trackArtist.scrollWidth - container.clientWidth;
      if (overflow > 4) {
        container.classList.add('is-overflowing');
        const duration = Math.max(7, Math.round((overflow / 16) + 4));
        const keyframeId = `marquee_artist_${Math.round(overflow)}`;
        const maskKeyframeId = `mask_artist_${Math.round(overflow)}`;
        let styleTag = document.getElementById('dyn-marquee-artist-style');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'dyn-marquee-artist-style';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
          @keyframes ${keyframeId} {
            0%, 20% { transform: translateX(0); }
            55%, 75% { transform: translateX(-${overflow + 8}px); }
            100% { transform: translateX(0); }
          }
          @keyframes ${maskKeyframeId} {
            0%, 20% { --marquee-left-fade: 0px; }
            26%, 93% { --marquee-left-fade: 12px; }
            99%, 100% { --marquee-left-fade: 0px; }
          }
        `;
        this.trackArtist.style.animation = `${keyframeId} ${duration}s ease-in-out infinite`;
        container.style.animation = `${maskKeyframeId} ${duration}s ease-in-out infinite`;
      } else {
        container.classList.remove('is-overflowing');
        container.style.animation = 'none';
        this.trackArtist.style.animation = 'none';
        this.trackArtist.style.transform = 'none';
      }
    });
  }

  refresh() {
    if (this.currentTitle) this.updateTitle(this.currentTitle, true);
    if (this.currentArtist) this.updateArtist(this.currentArtist, true);
  }

  initObservers() {
    const titleContainer = this.trackTitle ? this.trackTitle.parentElement : null;
    if (titleContainer && typeof ResizeObserver !== 'undefined') {
      this.titleObserver = new ResizeObserver(() => {
        if (this.currentTitle) this.updateTitle(this.currentTitle, true);
      });
      this.titleObserver.observe(titleContainer);
    }

    const artistContainer = this.trackArtist ? this.trackArtist.parentElement : null;
    if (artistContainer && typeof ResizeObserver !== 'undefined') {
      this.artistObserver = new ResizeObserver(() => {
        if (this.currentArtist) this.updateArtist(this.currentArtist, true);
      });
      this.artistObserver.observe(artistContainer);
    }

    window.addEventListener('resize', () => {
      this.refresh();
    });
  }
}

if (typeof window !== 'undefined') {
  window.MarqueeManager = MarqueeManager;
}
