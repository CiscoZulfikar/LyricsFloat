const fs = require('fs');
const path = require('path');

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function scoreCandidate(item, targetDurationSec, anyResultHasCJK) {
  let score = 0;
  if (item.syncedLyrics) score += 10000;
  const lyrics = item.syncedLyrics || item.plainLyrics || '';
  const itemHasCJK = CJK_REGEX.test(lyrics);

  // If any candidate has native CJK characters, heavily prioritize native script over romaji uploads
  if (anyResultHasCJK) {
    if (itemHasCJK) {
      score += 5000;
    } else {
      score -= 3000;
    }
  }

  // Duration proximity
  if (targetDurationSec > 0 && item.duration > 0) {
    const diff = Math.abs(item.duration - targetDurationSec);
    score -= diff * 10;
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
      const res = await fetch(url, { headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' } });

      let data = null;
      if (res.status === 200) {
        data = await res.json();
      }

      // If exact get has no synced lyrics OR lacks native CJK script when available:
      const exactHasSynced = data && Boolean(data.syncedLyrics);
      const exactHasCJK = exactHasSynced && CJK_REGEX.test(data.syncedLyrics);

      if (!exactHasSynced || !exactHasCJK) {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`;
        const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' } });
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            const anyResultHasCJK = list.some(item => CJK_REGEX.test(item.syncedLyrics || item.plainLyrics || ''));
            list.sort((a, b) => scoreCandidate(b, durationSec, anyResultHasCJK) - scoreCandidate(a, durationSec, anyResultHasCJK));

            const best = list[0];
            if (!exactHasSynced || (anyResultHasCJK && !exactHasCJK && CJK_REGEX.test(best.syncedLyrics || ''))) {
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
