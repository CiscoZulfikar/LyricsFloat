class LyricsSyncEngine {
  constructor(containerElement, onTimeUpdate = null) {
    this.container = containerElement;
    this.onTimeUpdate = onTimeUpdate;
    this.lines = [];
    this.activeIndex = -1;
    this.lastPositionMs = 0;
    this.lastStateTime = Date.now();
    this.isPlaying = false;
    this.animationFrameId = null;

    this.targetScrollTop = 0;
    this.isUserScrolling = false;
    let scrollTimeout = null;
    if (this.container && this.container.addEventListener) {
      this.container.addEventListener('wheel', () => {
        this.isUserScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.isUserScrolling = false;
        }, 2200);
      }, { passive: true });
    }

    this.startInterpolationLoop();
  }

  loadLyrics(enrichedData) {
    this.container.innerHTML = '';
    this.lines = (enrichedData && enrichedData.lines) || [];
    this.activeIndex = -1;
    this.targetScrollTop = 0;
    if (this.container) this.container.scrollTop = 0;


    if (this.lines.length === 0) {
      this.container.innerHTML = `
        <div class="lyrics-idle-message">
          <div class="idle-pulse-ring"></div>
          <span>Lyrics unavailable for this track</span>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.lines.forEach((line, idx) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'lyric-line';
      lineDiv.dataset.index = idx;
      lineDiv.dataset.timeMs = line.timeMs;

      // 1. Dominant Original Lyric
      const origDiv = document.createElement('div');
      origDiv.className = 'lyric-original';
      origDiv.textContent = line.original || line.text || '';
      lineDiv.appendChild(origDiv);

      // 2. Romaji / Pronunciation Sub-text
      if (line.romaji) {
        const romajiDiv = document.createElement('div');
        romajiDiv.className = 'lyric-sub-romaji';
        romajiDiv.textContent = line.romaji;
        lineDiv.appendChild(romajiDiv);
      }

      // 3. Translation Sub-text
      const transDiv = document.createElement('div');
      transDiv.className = 'lyric-sub-translation';
      transDiv.textContent = line.translation || '';
      if (!line.translation) transDiv.style.display = 'none';
      lineDiv.appendChild(transDiv);

      fragment.appendChild(lineDiv);
    });

    // Provider attribution note at the end of lyrics
    const provider = enrichedData && enrichedData.provider;
    const providerName = (provider && provider.name) || 'LRCLIB';
    const providerUrl = (provider && provider.url) || 'https://lrclib.net';

    const displayUrl = providerUrl.replace(/^https?:\/\//, '');
    const footer = document.createElement('div');
    footer.className = 'lyrics-provider-footer';
    footer.innerHTML = `<span>Provided by: ${providerName}<br>[<a class="provider-link" href="#" data-url="${providerUrl}" title="${providerUrl}">${displayUrl}</a>]</span>`;
    
    const link = footer.querySelector('.provider-link');



    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.lyricsFloatAPI && window.lyricsFloatAPI.openExternal) {
          window.lyricsFloatAPI.openExternal(providerUrl);
        }
      });
    }
    fragment.appendChild(footer);

    this.container.appendChild(fragment);

    // If opening mid-song, immediately jump to current line
    if (this.lines.length > 0 && this.lastPositionMs > 0) {
      let currentMs = this.lastPositionMs;
      if (this.isPlaying) {
        currentMs += (Date.now() - this.lastStateTime);
      }
      this.syncPosition(currentMs);
      if (this.activeIndex >= 0) {
        this.scrollToIndex(this.activeIndex, true);
      }
    } else {
      this.scrollToIndex(0, true);
    }
  }

  updateTranslations(translationPayload) {
    if (!translationPayload || !Array.isArray(translationPayload.lines)) return;

    translationPayload.lines.forEach((t, idx) => {
      if (this.lines[idx]) {
        this.lines[idx].translation = t.translation;
      }
      const lineElem = this.container.querySelector(`.lyric-line[data-index="${idx}"]`);
      if (lineElem) {
        let transDiv = lineElem.querySelector('.lyric-sub-translation');
        if (transDiv) {
          if (t.translation) {
            transDiv.textContent = t.translation;
            transDiv.style.display = '';
          } else {
            transDiv.style.display = 'none';
          }
        }
      }
    });
  }


  updatePlaybackState(state) {
    const now = Date.now();
    const newPos = state.positionMs || 0;
    const wasPlaying = this.isPlaying;
    this.isPlaying = Boolean(state.isPlaying);

    if (!wasPlaying && this.isPlaying) {
      // Resumed
      this.lastPositionMs = newPos;
      this.lastStateTime = now;
      return;
    }

    if (wasPlaying && !this.isPlaying) {
      // Paused
      const elapsed = now - this.lastStateTime;
      this.lastPositionMs = this.lastPositionMs + elapsed;
      this.lastStateTime = now;
      return;
    }

    if (this.isPlaying) {
      const estimatedCurrent = this.lastPositionMs + (now - this.lastStateTime);
      const delta = newPos - estimatedCurrent;

      // If user jumped (seeked/scrubbed by more than 1.5 seconds)
      if (Math.abs(delta) >= 1500) {
        this.lastPositionMs = newPos;
        this.lastStateTime = now;
      } else {
        // Minor continuous clock drift correction: apply exponential smoothing
        this.lastPositionMs = estimatedCurrent + delta * 0.2;
        this.lastStateTime = now;
      }
    } else {
      this.lastPositionMs = newPos;
      this.lastStateTime = now;
    }
  }

  startInterpolationLoop() {
    const loop = () => {
      let currentMs = this.lastPositionMs;
      if (this.isPlaying) {
        currentMs += (Date.now() - this.lastStateTime);
      }
      if (this.onTimeUpdate) {
        this.onTimeUpdate(currentMs);
      }
      if (this.lines.length > 0) {
        this.syncPosition(currentMs);
      }
      this.smoothScrollStep();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  smoothScrollStep() {
    if (this.isUserScrolling || !this.container) return;
    const current = this.container.scrollTop;
    const diff = this.targetScrollTop - current;
    if (Math.abs(diff) > 0.4) {
      this.container.scrollTop = current + (diff * 0.09);
    } else if (Math.abs(diff) > 0) {
      this.container.scrollTop = this.targetScrollTop;
    }
  }

  syncPosition(currentMs) {
    if (this.lines.length === 0) return;

    // Find the current active line based on timestamp
    let targetIndex = 0;
    for (let i = 0; i < this.lines.length; i++) {
      if (currentMs >= this.lines[i].timeMs) {
        targetIndex = i;
      } else {
        break;
      }
    }

    // Anti-flapping hysteresis:
    // If targetIndex is behind activeIndex, only regress if currentMs is well before the current line's timestamp
    if (this.activeIndex >= 0 && targetIndex < this.activeIndex) {
      const activeLineTime = this.lines[this.activeIndex].timeMs;
      if (currentMs >= activeLineTime - 1200) {
        // Retain current line, do not flap backwards
        return;
      }
    }

    if (targetIndex !== this.activeIndex) {
      this.setActiveIndex(targetIndex);
    }
  }

  setActiveIndex(index) {
    if (index === this.activeIndex) return;

    const prev = this.container.querySelector('.lyric-line.active');
    if (prev) prev.classList.remove('active');

    this.activeIndex = index;
    const current = this.container.querySelector(`.lyric-line[data-index="${index}"]`);
    if (current) {
      current.classList.add('active');
      this.scrollToElement(current);
    }
  }

  scrollToIndex(index, immediate = false) {
    const target = this.container.querySelector(`.lyric-line[data-index="${index}"]`);
    if (target) this.scrollToElement(target, immediate);
  }

  scrollToElement(elem, immediate = false) {
    if (!elem || !this.container) return;
    const containerHeight = this.container.clientHeight;
    const elemTop = elem.offsetTop;
    const elemHeight = elem.clientHeight;
    this.targetScrollTop = Math.max(0, elemTop - (containerHeight * 0.42) + (elemHeight / 2));

    if (immediate) {
      this.container.scrollTop = this.targetScrollTop;
    }
  }


}

if (typeof module !== 'undefined') module.exports = { LyricsSyncEngine };
