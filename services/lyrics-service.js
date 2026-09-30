const fs = require('fs');
const path = require('path');

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function scoreCandidate(item, title, artist, album, targetDurationSec) {
  let score = 0;
  if (item.syncedLyrics) score += 10000;
  else if (item.plainLyrics) score += 2000;

  const targetTitleNorm = (title || '').toLowerCase().trim();
  const itemTitleNorm = (item.trackName || '').toLowerCase().trim();
  const targetArtistNorm = (artist || '').toLowerCase().trim();
  const itemArtistNorm = (item.artistName || '').toLowerCase().trim();
  const targetAlbumNorm = (album || '').toLowerCase().trim();
  const itemAlbumNorm = (item.albumName || '').toLowerCase().trim();

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

  // 3. Album Matching (when available)
  if (targetAlbumNorm && itemAlbumNorm) {
    if (itemAlbumNorm === targetAlbumNorm) {
      score += 3500;
    } else if (itemAlbumNorm.includes(targetAlbumNorm) || targetAlbumNorm.includes(itemAlbumNorm)) {
      score += 1800;
    } else if (itemAlbumNorm === targetArtistNorm) {
      // Uploader put artist name in album field - lower quality metadata
      score -= 1000;
    }
  }

  // 4. CJK Script Alignment
  const queryHasCJK = CJK_REGEX.test(title) || CJK_REGEX.test(artist);
  const lyrics = item.syncedLyrics || item.plainLyrics || '';
  const itemHasCJK = CJK_REGEX.test(lyrics);
  const isSameArtist = itemArtistNorm === targetArtistNorm;

  if (queryHasCJK || (itemHasCJK && isSameArtist)) {
    // For native CJK tracks (including Romanized titles by CJK artists), prioritize native script over romaji uploads
    if (itemHasCJK) score += 3000;
    else score -= 2000;
  } else {
    // For non-matching artists or foreign remixes/covers, penalize CJK lyrics
    // (prevents Mandarin/Japanese covers from hijacking original songs)
    if (itemHasCJK) score -= 8000;
  }

  // 5. Duration Proximity
  if (targetDurationSec > 0 && item.duration > 0) {
    const diff = Math.abs(item.duration - targetDurationSec);
    if (diff <= 1.5) {
      score += 2500;
    } else if (diff <= 4) {
      score += 2000;
    } else if (diff <= 7) {
      score += 1000;
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

  parseLrc(lrcText, title = '', artist = '') {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const rawLines = lrcText.split(/\r?\n/);

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const queryHasCJK = CJK_REGEX.test(title || '') || CJK_REGEX.test(artist || '');

    // Step 1: Parse lines and detect passes (sections where timestamp resets backwards)
    const passes = [];
    let currentPass = [];
    let maxTimeInPass = -1;

    for (const rawLine of rawLines) {
      const match = [...rawLine.matchAll(timeRegex)];
      if (match.length > 0) {
        const text = rawLine.replace(timeRegex, '').trim();
        for (const m of match) {
          const minutes = parseInt(m[1], 10);
          const seconds = parseInt(m[2], 10);
          let ms = parseInt(m[3], 10);
          if (m[3].length === 2) ms *= 10;
          const timeMs = minutes * 60000 + seconds * 1000 + ms;

          // Detect a new pass / track repeat:
          // If timestamp drops backwards significantly (> 10s earlier than maxTime seen in current pass)
          // or resets near beginning (< 15s when pass was already > 30s)
          if (currentPass.length > 0 && (timeMs < maxTimeInPass - 10000 || (maxTimeInPass > 30000 && timeMs < 15000))) {
            passes.push(currentPass);
            currentPass = [];
            maxTimeInPass = -1;
          }

          if (text) {
            currentPass.push({ timeMs, text });
            if (timeMs > maxTimeInPass) {
              maxTimeInPass = timeMs;
            }
          }
        }
      }
    }

    if (currentPass.length > 0) {
      passes.push(currentPass);
    }

    if (passes.length === 0) return [];

    // Step 2: If multiple passes exist, select the best pass
    let chosenPass = passes[0];
    if (passes.length > 1) {
      const scorePass = (pass, idx) => {
        let score = 0;
        const total = pass.length || 1;
        const cjkCount = pass.filter(l => CJK_REGEX.test(l.text)).length;

        if (queryHasCJK) {
          // For CJK tracks, strongly prefer the pass containing native script
          if (cjkCount > 0) {
            score += 10000 + (cjkCount / total) * 5000;
          } else {
            score -= 5000;
          }
        } else {
          // For non-CJK tracks, penalize CJK passes
          if (cjkCount > 0) {
            score -= 5000;
          }
        }
        score += Math.min(total * 10, 1000);
        score -= idx * 10;
        return score;
      };

      passes.sort((a, b) => scorePass(b, passes.indexOf(b)) - scorePass(a, passes.indexOf(a)));
      chosenPass = passes[0];
    }

    // Step 3: Sort chosen pass by timeMs
    chosenPass.sort((a, b) => a.timeMs - b.timeMs);

    // Step 4: Deduplicate identical timestamps and filter interleaved romanization/translation lines
    const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    const result = [];

    for (let i = 0; i < chosenPass.length; i++) {
      const current = chosenPass[i];
      if (result.length === 0) {
        result.push(current);
        continue;
      }

      const prev = result[result.length - 1];
      const timeDiff = Math.abs(current.timeMs - prev.timeMs);

      // Lines sharing virtually identical timestamps (<= 250ms)
      if (timeDiff <= 250) {
        // A. Exact duplicate text
        if (norm(current.text) === norm(prev.text)) {
          continue;
        }

        const prevHasCJK = CJK_REGEX.test(prev.text);
        const currHasCJK = CJK_REGEX.test(current.text);

        // B. CJK track with paired Latin Romaji/Translation line at same timestamp:
        // Always preserve native CJK line and discard Latin duplicate
        if (queryHasCJK || prevHasCJK || currHasCJK) {
          if (prevHasCJK && !currHasCJK) {
            continue; // drop Latin line
          } else if (!prevHasCJK && currHasCJK) {
            result[result.length - 1] = current; // replace Latin line with native CJK
            continue;
          }
        }
      }

      result.push(current);
    }

    return result;
  }

  getCacheKey(title, artist) {
    return `${(title || '').toLowerCase().trim()}___${(artist || '').toLowerCase().trim()}`;
  }

  clearCache(title, artist) {
    if (title && artist) {
      const key = this.getCacheKey(title, artist);
      this.memoryCache.delete(key);
    }
  }

  async fetchLyrics({ title, artist, album, durationSec }) {
    if (!title || !artist) return null;
    const cacheKey = this.getCacheKey(title, artist);

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    let data = null;

    // 1. Try exact get with isolated error handling and 7s timeout
    try {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist
      });
      if (album) params.append('album_name', album);
      if (durationSec) params.append('duration', Math.round(durationSec));

      const url = `https://lrclib.net/api/get?${params.toString()}`;
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
        signal: AbortSignal.timeout(7000)
      });

      if (res.status === 200) {
        data = await res.json();
      }
    } catch (exactErr) {
      console.warn(`[LyricsService] exact get warning: ${exactErr.message}`);
    }

    // Exact get evaluation:
    const exactHasSynced = data && Boolean(data.syncedLyrics);
    const exactHasCJK = exactHasSynced && CJK_REGEX.test(data.syncedLyrics);

    // Search if:
    // 1. Exact get didn't return synced lyrics (or failed completely), OR
    // 2. Exact get only had romaji/latin lyrics, to discover if native CJK lyrics exist
    const needsSearch = !exactHasSynced || !exactHasCJK;

    if (needsSearch) {
      // Build search queries: primary query and fallback cleaned title query if applicable
      const searchQueries = [`${title} ${artist}`];
      const cleanedTitle = title.replace(/\s*[\(\[].*?[\)\]]/g, '').replace(/\s*-\s*.*$/, '').trim();
      if (cleanedTitle && cleanedTitle.toLowerCase() !== title.toLowerCase()) {
        searchQueries.push(`${cleanedTitle} ${artist}`);
      }

      for (const query of searchQueries) {
        let list = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
            const searchRes = await fetch(searchUrl, { 
              headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
              signal: AbortSignal.timeout(7000)
            });
            if (searchRes.ok) {
              list = await searchRes.json();
              break;
            }
          } catch (searchErr) {
            console.warn(`[LyricsService] search attempt ${attempt + 1} warning: ${searchErr.message}`);
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 600));
            }
          }
        }

        if (Array.isArray(list) && list.length > 0) {
          list.sort((a, b) => scoreCandidate(b, title, artist, album, durationSec) - scoreCandidate(a, title, artist, album, durationSec));

          const best = list[0];
          const isBestSameArtist = (best.artistName || '').toLowerCase().trim() === (artist || '').toLowerCase().trim();
          const bestHasCJK = CJK_REGEX.test(best.syncedLyrics || '');

          // Only replace exact get if:
          // - exact get had no synced lyrics, OR
          // - exact get had no CJK, but best candidate has native CJK lyrics by the same artist
          if (!exactHasSynced || (!exactHasCJK && bestHasCJK && isBestSameArtist)) {
            data = best;
            break; // Found strong candidate
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
          album: data.albumName || album || '',
          lines: this.parseLrc(data.syncedLyrics, title, artist),
          plainLyrics: data.plainLyrics || '',
          provider
        };
      } else if (data.plainLyrics) {
        const parsed = this.parseLrc(data.plainLyrics, title, artist);
        const lines = parsed.length > 0
          ? parsed
          : data.plainLyrics.split(/\r?\n/).map(text => ({ timeMs: 0, text: text.trim() })).filter(l => l.text.length > 0);
        payload = {
          synced: parsed.length > 0,
          album: data.albumName || album || '',
          lines,
          plainLyrics: data.plainLyrics,
          provider
        };
      }

      if (payload) {
        this.memoryCache.set(cacheKey, payload);
        return payload;
      }
    }

    return null;
  }
}

module.exports = { LyricsService };
