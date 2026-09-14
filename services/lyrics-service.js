const fs = require('fs');
const path = require('path');

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function scoreCandidate(item, title, artist, targetDurationSec) {
  let score = 0;
  if (item.syncedLyrics) score += 10000;
  else if (item.plainLyrics) score += 2000;

  const targetTitleNorm = (title || '').toLowerCase().trim();
  const itemTitleNorm = (item.trackName || '').toLowerCase().trim();
  const targetArtistNorm = (artist || '').toLowerCase().trim();
  const itemArtistNorm = (item.artistName || '').toLowerCase().trim();

  // 1. Title Matching
  if (itemTitleNorm === targetTitleNorm) {
    score += 6000;
  } else if (itemTitleNorm.startsWith(targetTitleNorm)) {
    score += 2000;
    // Heavily penalize foreign translated versions (e.g. "Mandarin Version") or remixes if target did not request it
    const hasUnwantedExtra = /\((mandarin|chinese|japanese|korean|remix|cover|karaoke|instrumental|live|acoustic|tribute)/i.test(itemTitleNorm);
    const targetWantedExtra = /\((mandarin|chinese|japanese|korean|remix|cover|karaoke|instrumental|live|acoustic|tribute)/i.test(targetTitleNorm);
    if (hasUnwantedExtra && !targetWantedExtra) {
      score -= 8000;
    }
  } else {
    score -= 3000;
  }

  // 2. Artist Matching
  if (itemArtistNorm === targetArtistNorm) {
    score += 4000;
  } else if (itemArtistNorm.includes(targetArtistNorm)) {
    score += 1500;
  } else {
    score -= 3000;
  }

  // 3. CJK Script Alignment
  const queryHasCJK = CJK_REGEX.test(title) || CJK_REGEX.test(artist);
  const lyrics = item.syncedLyrics || item.plainLyrics || '';
  const itemHasCJK = CJK_REGEX.test(lyrics);

  if (queryHasCJK) {
    // For native CJK tracks, prioritize native script over romaji uploads
    if (itemHasCJK) score += 3000;
    else score -= 2000;
  } else {
    // For non-CJK tracks (e.g. English, Spanish), penalize CJK lyrics
    // (prevents Mandarin/Japanese covers from hijacking original songs)
    if (itemHasCJK) score -= 8000;
  }

  // 4. Duration Proximity
  if (targetDurationSec > 0 && item.duration > 0) {
    const diff = Math.abs(item.duration - targetDurationSec);
    if (diff <= 2) {
      score += 2000;
    } else {
      score -= Math.min(diff * 20, 5000);
    }
  }

  return score;
}

class LyricsService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'cache', 'lyrics');
    this.memoryCache = new Map();
  }

  parseLrc(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const lines = lrcText.split(/\r?\n/);
    const result = [];

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    for (const rawLine of lines) {
      const match = [...rawLine.matchAll(timeRegex)];
      if (match.length > 0) {
        const text = rawLine.replace(timeRegex, '').trim();
        for (const m of match) {
          const minutes = parseInt(m[1], 10);
          const seconds = parseInt(m[2], 10);
          let ms = parseInt(m[3], 10);
          if (m[3].length === 2) ms *= 10;
          const timeMs = minutes * 60000 + seconds * 1000 + ms;
          if (text) {
            result.push({ timeMs, text });
          }
        }
      }
    }

    result.sort((a, b) => a.timeMs - b.timeMs);
    return result;
  }

  getCacheKey(title, artist) {
    return `${(title || '').toLowerCase().trim()}___${(artist || '').toLowerCase().trim()}`;
  }

  async fetchLyrics({ title, artist, album, durationSec }) {
    if (!title || !artist) return null;
    const cacheKey = this.getCacheKey(title, artist);

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    try {
      // 1. Try exact get
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist
      });
      if (album) params.append('album_name', album);
      if (durationSec) params.append('duration', Math.round(durationSec));

      const url = `https://lrclib.net/api/get?${params.toString()}`;
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
        signal: AbortSignal.timeout(4500)
      });

      let data = null;
      if (res.status === 200) {
        data = await res.json();
      }

      // Exact get evaluation:
      const exactHasSynced = data && Boolean(data.syncedLyrics);
      const exactHasCJK = exactHasSynced && CJK_REGEX.test(data.syncedLyrics);
      const queryHasCJK = CJK_REGEX.test(title) || CJK_REGEX.test(artist);

      // Only search if:
      // 1. Exact get didn't return synced lyrics, OR
      // 2. The query itself has CJK characters, but exact get only had romaji/latin lyrics
      const needsSearch = !exactHasSynced || (queryHasCJK && !exactHasCJK);

      if (needsSearch) {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`;
        const searchRes = await fetch(searchUrl, { 
          headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
          signal: AbortSignal.timeout(4500)
        });
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            list.sort((a, b) => scoreCandidate(b, title, artist, durationSec) - scoreCandidate(a, title, artist, durationSec));

            const best = list[0];
            // Only replace exact get if:
            // - exact get had no synced lyrics, OR
            // - query is CJK, exact had no CJK, and best candidate DOES have CJK
            if (!exactHasSynced || (queryHasCJK && !exactHasCJK && CJK_REGEX.test(best.syncedLyrics || ''))) {
              data = best;
            }
          }
        }
      }


      if (data) {
        let payload = null;
        const trackUrl = data.id 
          ? `https://lrclib.net/tracks/${data.id}`
          : `https://lrclib.net/search/${encodeURIComponent(`${title} ${artist}`)}`;

        const provider = {
          name: 'LRCLIB',
          url: trackUrl
        };



        if (data.syncedLyrics) {
          payload = {
            synced: true,
            lines: this.parseLrc(data.syncedLyrics),
            plainLyrics: data.plainLyrics || '',
            provider
          };
        } else if (data.plainLyrics) {
          payload = {
            synced: false,
            lines: data.plainLyrics.split(/\r?\n/).map(text => ({ timeMs: 0, text: text.trim() })).filter(l => l.text.length > 0),
            plainLyrics: data.plainLyrics,
            provider
          };
        }


        if (payload) {
          this.memoryCache.set(cacheKey, payload);
          return payload;
        }
      }
    } catch (e) {
      console.error('LRCLIB fetch error:', e.message);
    }

    return null;
  }
}

module.exports = { LyricsService };
