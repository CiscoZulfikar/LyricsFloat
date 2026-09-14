function isSubtextDuplicate(subtext, original) {
  if (!subtext || !original) return false;
  const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  const s1 = norm(subtext);
  const s2 = norm(original);
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const clean = (s) => s.replace(/[\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03BF\u03C1\u03BD\u0430\u0410\u0432\u0412\u0441\u0421\u0435\u0415\u0456\u0406\u0458\u0408\u043a\u041a\u043c\u041c\u043d\u041d\u043e\u041e\u0440\u0420\u0442\u0422\u0443\u0423\u0445\u0425]/g, (ch) => {
    const map = {
      '\u0430': 'a', '\u0410': 'A', '\u0432': 'b', '\u0412': 'B', '\u0441': 'c', '\u0421': 'C',
      '\u0435': 'e', '\u0415': 'E', '\u0456': 'i', '\u0406': 'I', '\u0458': 'j', '\u0408': 'J',
      '\u043a': 'k', '\u041a': 'K', '\u043c': 'm', '\u041c': 'M', '\u043d': 'h', '\u041d': 'H',
      '\u043e': 'o', '\u041e': 'O', '\u0440': 'p', '\u0420': 'P', '\u0442': 't', '\u0422': 'T',
      '\u0443': 'y', '\u0423': 'Y', '\u0445': 'x', '\u0425': 'X',
      '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H', '\u0399': 'I',
      '\u039A': 'K', '\u039C': 'M', '\u039D': 'N', '\u039F': 'O', '\u03A1': 'P', '\u03A4': 'T',
      '\u03A5': 'Y', '\u03A7': 'X', '\u03BF': 'o', '\u03C1': 'p', '\u03BD': 'v'
    };
    return map[ch] || ch;
  });
  return norm(clean(subtext)) === norm(clean(original));
}

class LyricsSyncEngine {
  constructor(containerElement, onTimeUpdate = null) {
    this.container = containerElement;
    this.onTimeUpdate = onTimeUpdate;
    this.lines = [];
    this.activeIndex = -1;
    this.lastPositionMs = 0;
    this.durationMs = 0;
    this.lastStateTime = Date.now();
    this.isPlaying = false;
    this.animationFrameId = null;

    this.targetScrollTop = 0;
    this.isUserScrolling = false;
    this.isScrubbing = false;
    this.onScrollDrift = null;
    this.scrollTimeout = null;
    this.hasScrolledToCredits = false;
    this.loadingWatchdogTimeout = null;

    if (this.container && this.container.addEventListener) {
      this.container.addEventListener('wheel', () => {
        this.isUserScrolling = true;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
          this.isUserScrolling = false;
          this.notifyScrollDrift();
          // After scrolling stops, return camera back to active singing line
          if (this.activeIndex >= 0) {
            this.scrollToIndex(this.activeIndex, false);
          }
        }, 2500);
        setTimeout(() => this.notifyScrollDrift(), 35);
      }, { passive: true });
    }

    this.startInterpolationLoop();
  }

  getElementScrollTop(elem) {
    if (!elem || !this.container) return 0;
    if (typeof elem.getBoundingClientRect === 'function' && typeof this.container.getBoundingClientRect === 'function') {
      const containerRect = this.container.getBoundingClientRect();
      const elemRect = elem.getBoundingClientRect();
      return elemRect.top - containerRect.top + this.container.scrollTop;
    }
    return elem.offsetTop || 0;
  }

  checkActiveInView() {
    if (this.activeIndex < 0 || !this.container || this.lines.length === 0) {
      return { inView: true, direction: 'down' };
    }
    const activeElem = this.container.querySelector(`.lyric-line[data-index="${this.activeIndex}"]`);
    if (!activeElem) return { inView: true, direction: 'down' };

    const containerTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const elemTop = this.getElementScrollTop(activeElem);
    const elemHeight = activeElem.clientHeight;

    if (elemTop + elemHeight < containerTop + 24) {
      return { inView: false, direction: 'up' };
    }
    if (elemTop > containerTop + containerHeight - 24) {
      return { inView: false, direction: 'down' };
    }
    return { inView: true, direction: 'down' };
  }

  notifyScrollDrift() {
    if (!this.onScrollDrift) return;
    if (!this.isUserScrolling) {
      this.onScrollDrift(true, 'down');
      return;
    }
    const status = this.checkActiveInView();
    this.onScrollDrift(status.inView, status.direction);
  }

  jumpToActive() {
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = null;
    this.isUserScrolling = false;
    if (this.onScrollDrift) {
      this.onScrollDrift(true, 'down');
    }
    if (this.activeIndex >= 0) {
      this.scrollToIndex(this.activeIndex, false);
    }
  }

  showLoading(title = '', artist = '', timeoutMs = 7000) {
    if (this.loadingWatchdogTimeout) {
      clearTimeout(this.loadingWatchdogTimeout);
      this.loadingWatchdogTimeout = null;
    }
    this.lines = [];
    this.activeIndex = -1;
    this.targetScrollTop = 0;
    this.isUserScrolling = false;
    if (this.onScrollDrift) this.onScrollDrift(true, 'down');
    if (this.container) {
      this.container.scrollTop = 0;
      this.container.innerHTML = `
        <div class="lyrics-idle-message lyrics-loading-state">
          <div class="idle-pulse-ring"></div>
          <span>Loading lyrics...</span>
        </div>`;
    }

    if (timeoutMs > 0) {
      this.loadingWatchdogTimeout = setTimeout(() => {
        if (this.lines.length === 0 && this.container) {
          this.container.innerHTML = `
            <div class="lyrics-idle-message">
              <div class="idle-pulse-ring"></div>
              <span>Lyrics unavailable for this track</span>
            </div>`;
        }
        this.loadingWatchdogTimeout = null;
      }, timeoutMs);
    }
  }

  hasRomaji() {
    return Array.isArray(this.lines) && this.lines.some(l => Boolean(l.romaji && l.romaji.trim()));
  }

  hasTranslation() {
    return Array.isArray(this.lines) && this.lines.some(l => Boolean(l.translation && l.translation.trim()));
  }

  loadLyrics(enrichedData) {
    if (this.loadingWatchdogTimeout) {
      clearTimeout(this.loadingWatchdogTimeout);
      this.loadingWatchdogTimeout = null;
    }
    this.container.innerHTML = '';
    this.lines = (enrichedData && enrichedData.lines) || [];
    this.activeIndex = -1;
    this.targetScrollTop = 0;
    this.isUserScrolling = false;
    if (this.onScrollDrift) this.onScrollDrift(true, 'down');
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
      const origText = line.original || line.text || '';
      const origDiv = document.createElement('div');
      origDiv.className = 'lyric-original';
      origDiv.textContent = origText;
      lineDiv.appendChild(origDiv);

      // 2. Romaji / Pronunciation Sub-text
      if (line.romaji && !isSubtextDuplicate(line.romaji, origText)) {
        const romajiDiv = document.createElement('div');
        romajiDiv.className = 'lyric-sub-romaji';
        romajiDiv.textContent = line.romaji;
        lineDiv.appendChild(romajiDiv);
      }

      // 3. Translation Sub-text
      const transDiv = document.createElement('div');
      transDiv.className = 'lyric-sub-translation';
      const showTrans = Boolean(line.translation && !isSubtextDuplicate(line.translation, origText));
      transDiv.textContent = showTrans ? line.translation : '';
      if (!showTrans) transDiv.style.display = 'none';
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
      const origText = (this.lines[idx] && (this.lines[idx].original || this.lines[idx].text)) || '';
      const isDuplicate = isSubtextDuplicate(t.translation, origText);
      const finalTrans = isDuplicate ? '' : (t.translation || '');

      if (this.lines[idx]) {
        this.lines[idx].translation = finalTrans;
      }
      const lineElem = this.container.querySelector(`.lyric-line[data-index="${idx}"]`);
      if (lineElem) {
        let transDiv = lineElem.querySelector('.lyric-sub-translation');
        if (transDiv) {
          if (finalTrans) {
            transDiv.textContent = finalTrans;
            transDiv.style.display = '';
          } else {
            transDiv.style.display = 'none';
          }
        }
      }
    });

    // Re-align camera to current active line because content heights expanded
    if (this.activeIndex >= 0 && !this.isUserScrolling) {
      this.scrollToIndex(this.activeIndex, false);
    }
  }


  updatePlaybackState(state) {
    if (state && state.durationMs > 0) {
      this.durationMs = state.durationMs;
    }
    const now = Date.now();
    const newPos = state.positionMs || 0;
    const wasPlaying = this.isPlaying;
    this.isPlaying = Boolean(state.isPlaying);

    // Reset credits trigger if scrubbed or jumped backwards away from end
    if (this.durationMs > 0 && newPos < this.durationMs - 2500) {
      this.hasScrolledToCredits = false;
    }

    if (state && state.isSeek) {
      this.lastPositionMs = newPos;
      this.lastStateTime = now;
      this.hasScrolledToCredits = false;
      return;
    }

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
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = () => {
      if (!this.isScrubbing) {
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
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  smoothScrollStep() {
    if (this.isUserScrolling || this.isScrubbing || !this.container) return;
    const current = this.container.scrollTop;
    const diff = this.targetScrollTop - current;
    if (Math.abs(diff) > 0.4) {
      this.container.scrollTop = current + (diff * 0.09);
    } else if (Math.abs(diff) > 0) {
      this.container.scrollTop = this.targetScrollTop;
    }
  }

  scrubTo(targetMs) {
    this.isScrubbing = true;
    this.isUserScrolling = false;
    this.hasScrolledToCredits = false;
    this.lastPositionMs = targetMs;
    this.lastStateTime = Date.now();

    if (this.lines.length === 0) return;

    let targetIndex = 0;
    for (let i = 0; i < this.lines.length; i++) {
      if (targetMs >= this.lines[i].timeMs) {
        targetIndex = i;
      } else {
        break;
      }
    }

    if (targetIndex !== this.activeIndex) {
      const prev = this.container.querySelector('.lyric-line.active');
      if (prev) prev.classList.remove('active');
      this.activeIndex = targetIndex;
      const current = this.container.querySelector(`.lyric-line[data-index="${targetIndex}"]`);
      if (current) {
        current.classList.add('active');
        // While scrubbing, scroll immediately and directly to follow mouse with zero lag/jitter
        this.scrollToElement(current, true);
      }
      if (this.onScrollDrift) this.onScrollDrift(true, 'down');
    }

    const isSongNearEnd = this.durationMs > 0 && 
      (this.durationMs - targetMs) <= 2000 && 
      (this.durationMs - targetMs) >= 0;
    const isPastLastLine = this.lines.length > 0 && 
      targetMs >= this.lines[this.lines.length - 1].timeMs;

    if (isSongNearEnd && isPastLastLine) {
      this.hasScrolledToCredits = true;
      this.scrollToCredits(true);
    }
  }

  syncPosition(currentMs) {
    if (this.isScrubbing || this.lines.length === 0) return;

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
    if (this.activeIndex >= 0 && this.activeIndex < this.lines.length && targetIndex < this.activeIndex) {
      const activeLineTime = this.lines[this.activeIndex].timeMs;
      if (currentMs >= activeLineTime - 1200) {
        // Retain current line, do not flap backwards
        return;
      }
    }

    if (targetIndex !== this.activeIndex) {
      if (this.isUserScrolling) {
        this.activeIndex = targetIndex;
        const prev = this.container.querySelector('.lyric-line.active');
        if (prev) prev.classList.remove('active');
        const current = this.container.querySelector(`.lyric-line[data-index="${targetIndex}"]`);
        if (current) current.classList.add('active');
        this.notifyScrollDrift();
        return;
      }
      this.setActiveIndex(targetIndex);
    }

    // End-of-song credits transition:
    // Smoothly glide down to credits ONLY within 1.5 - 2 seconds before the audio ends,
    // and after the final lyric line has already started/passed.
    const isSongNearEnd = this.durationMs > 0 && 
      (this.durationMs - currentMs) <= 2000 && 
      (this.durationMs - currentMs) >= -2000;
    const isPastLastLine = this.lines.length > 0 && 
      currentMs >= this.lines[this.lines.length - 1].timeMs;

    if (isSongNearEnd && isPastLastLine && !this.isUserScrolling && !this.hasScrolledToCredits) {
      this.hasScrolledToCredits = true;
      this.scrollToCredits(false);
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

  scrollToCredits(immediate = false) {
    if (!this.container) return;
    const footer = this.container.querySelector('.lyrics-provider-footer');
    if (!footer) return;
    const containerHeight = this.container.clientHeight;
    const footerTop = this.getElementScrollTop(footer);
    const footerHeight = footer.clientHeight;
    const maxScroll = Math.max(0, this.container.scrollHeight - containerHeight);
    this.targetScrollTop = Math.min(maxScroll, Math.max(0, footerTop + footerHeight - containerHeight + 24));
    if (immediate) {
      this.container.scrollTop = this.targetScrollTop;
    }
  }

  scrollToElement(elem, immediate = false) {
    if (!elem || !this.container) return;
    const containerHeight = this.container.clientHeight;
    const elemTop = this.getElementScrollTop(elem);
    const elemHeight = elem.clientHeight;

    const maxScroll = Math.max(0, this.container.scrollHeight - containerHeight);
    this.targetScrollTop = Math.min(maxScroll, Math.max(0, elemTop - (containerHeight * 0.42) + (elemHeight / 2)));

    if (immediate) {
      this.container.scrollTop = this.targetScrollTop;
    }
  }

  destroy() {
    if (this.loadingWatchdogTimeout) {
      clearTimeout(this.loadingWatchdogTimeout);
      this.loadingWatchdogTimeout = null;
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
    if (this.animationFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = null;
    }
  }
}

if (typeof module !== 'undefined') module.exports = { LyricsSyncEngine, isSubtextDuplicate };
