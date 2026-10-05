const fs = require('fs');
const path = require('path');

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

const SPANISH_MARKERS = /\b(estoy|estás|está|estamos|están|quiero|tengo|tienes|tiene|nadie|cuando|tiempo|siempre|corazón|noche|nada|vida|aqui|aquí|puedo|puedes|puede|tenerte|olvidarme|respirar|cuesta|entonces|despacito|cuello|deja|diga|cosas|oído|olha|yo|tú|él|ella|ellos|ellas|nosotros|usted|ustedes|nuestro|nuestra|pero|más|muy|bueno|buena|después|quién|decir|dice|dijo|hola|amigo|amiga|señor|señora|por favor|gracias)\b/i;

function normalizePunctuation(text, isSpanishContext = false) {
  if (!text || typeof text !== 'string') return text;
  if (isSpanishContext) return text;
  if (SPANISH_MARKERS.test(text)) return text;
  return text.replace(/¡\s*/g, '').replace(/¿\s*/g, '');
}


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
  } else if (itemArtistNorm.includes(targetArtistNorm) || targetArtistNorm.includes(itemArtistNorm)) {
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

  parseLrc(lrcText, title = '', artist = '', durationSec = 0) {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const rawLines = lrcText.split(/\r?\n/);

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const queryHasCJK = CJK_REGEX.test(title || '') || CJK_REGEX.test(artist || '');
    const isSpanishTrack = SPANISH_MARKERS.test(title || '') || SPANISH_MARKERS.test(artist || '') || SPANISH_MARKERS.test(lrcText || '');

    // Step 1: Parse lines and detect passes (sections where timestamp resets backwards)
    const passes = [];
    let currentPass = [];
    let maxTimeInPass = -1;

    for (const rawLine of rawLines) {
      const match = [...rawLine.matchAll(timeRegex)];
      if (match.length > 0) {
        const rawText = rawLine.replace(timeRegex, '').trim();
        const isInstrumental = !rawText || /^[\s♪♫🎵\-~…\.]+$/u.test(rawText);
        const cleanText = isInstrumental ? '' : normalizePunctuation(rawText, isSpanishTrack);

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

          if (isInstrumental) {
            const prev = currentPass[currentPass.length - 1];
            if (!prev || !prev.isBreak) {
              currentPass.push({ timeMs, text: '', isBreak: true });
              if (timeMs > maxTimeInPass) {
                maxTimeInPass = timeMs;
              }
            }
          } else {
            currentPass.push({ timeMs, text: cleanText, isBreak: false });
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
        // If one is break and the other has text, always prioritize the real lyric text
        if (prev.isBreak && !current.isBreak) {
          result[result.length - 1] = current;
          continue;
        } else if (!prev.isBreak && current.isBreak) {
          continue;
        } else if (prev.isBreak && current.isBreak) {
          continue;
        }

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

    // Step 4b: Filter out transient micro-breaks (< 6000ms)
    // Transcribers frequently add empty timestamps right after lines to clear the line,
    // or brief 1-2s pauses between consecutive vocal phrases.
    // Real instrumental interludes and solos are substantial breaks (>= 6s).
    const filteredResult = [];
    for (let i = 0; i < result.length; i++) {
      const line = result[i];
      if (line.isBreak) {
        if (i < result.length - 1) {
          const next = result[i + 1];
          const breakDurationMs = next.timeMs - line.timeMs;
          // If the break lasts less than 6 seconds before the next lyric, ignore it as a brief micro-pause
          if (breakDurationMs < 6000) {
            continue;
          }
        } else {
          // Final line break (outro)
          if (durationSec > 0) {
            const trackEndMs = durationSec * 1000;
            if (trackEndMs - line.timeMs < 6000) {
              continue;
            }
          } else if (filteredResult.length > 0 && (line.timeMs - filteredResult[filteredResult.length - 1].timeMs < 6000)) {
            continue;
          }
        }
      }
      filteredResult.push(line);
    }

    // Step 5: Intro Break & Long Gap Interlude Injection
    const processed = [];
    if (filteredResult.length > 0 && filteredResult[0].timeMs >= 8000 && !filteredResult[0].isBreak) {
      processed.push({ timeMs: 0, text: '', isBreak: true });
    }

    for (let i = 0; i < filteredResult.length; i++) {
      processed.push(filteredResult[i]);
      if (i < filteredResult.length - 1) {
        const curr = filteredResult[i];
        const next = filteredResult[i + 1];
        if (!curr.isBreak && !next.isBreak) {
          const gapMs = next.timeMs - curr.timeMs;
          if (gapMs >= 15000) {
            const words = (curr.text || '').trim().split(/\s+/).filter(Boolean).length;
            const vocalHoldMs = Math.min(10000, Math.max(5000, words * 650));
            const breakStartMs = curr.timeMs + vocalHoldMs;
            if (next.timeMs - breakStartMs >= 6000) {
              processed.push({ timeMs: breakStartMs, text: '', isBreak: true, isSynthetic: true });
            }
          }
        }
      }
    }

    return processed;
  }

  getCacheKey(title, artist) {
    return `${(title || '').toLowerCase().trim()}___${(artist || '').toLowerCase().trim()}`;
  }

  splitCompoundTitle(title) {
    if (!title || typeof title !== 'string') return [];
    // Only split on explicit delimiters: slash, backslash, en-dash, em-dash, or hyphen surrounded by spaces
    const parts = title.split(/\s*[/\\–—]\s*|\s+-\s+/).map(p => p.trim()).filter(p => p.length >= 2);
    if (parts.length >= 2) {
      return parts;
    }
    return [];
  }

  async queryTrackLyrics(trackTitle, trackArtist, trackAlbum, durationSec = 0) {
    if (!trackTitle || !trackArtist) return null;
    try {
      const params = new URLSearchParams({
        track_name: trackTitle,
        artist_name: trackArtist
      });
      if (trackAlbum) params.append('album_name', trackAlbum);
      if (durationSec) params.append('duration', Math.round(durationSec));

      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.status === 200) {
        const exact = await res.json();
        if (exact && exact.syncedLyrics) return exact;
      } else if (res.status === 404) {
        const primaryArtist = trackArtist.split(/,|\s+(?:&|feat\.?|ft\.?)\s+/i)[0].trim();
        if (primaryArtist && primaryArtist.toLowerCase() !== trackArtist.toLowerCase()) {
          const fallbackParams = new URLSearchParams({
            track_name: trackTitle,
            artist_name: primaryArtist
          });
          if (trackAlbum) fallbackParams.append('album_name', trackAlbum);
          if (durationSec) fallbackParams.append('duration', Math.round(durationSec));
          const fallbackRes = await fetch(`https://lrclib.net/api/get?${fallbackParams.toString()}`, {
            headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
            signal: AbortSignal.timeout(5000)
          });
          if (fallbackRes.status === 200) {
            const fallbackExact = await fallbackRes.json();
            if (fallbackExact && fallbackExact.syncedLyrics) return fallbackExact;
          }
        }
      }
    } catch (e) {}

    try {
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${trackTitle} ${trackArtist}`)}`, {
        headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (searchRes.ok) {
        const list = await searchRes.json();
        if (Array.isArray(list) && list.length > 0) {
          list.sort((a, b) => scoreCandidate(b, trackTitle, trackArtist, trackAlbum, durationSec) - scoreCandidate(a, trackTitle, trackArtist, trackAlbum, durationSec));
          const best = list[0];
          if (best && (best.syncedLyrics || best.plainLyrics)) return best;
        }
      }
    } catch (e) {}

    return null;
  }

  stitchMedley(part1Data, part2Data, fullTitle, artist, album, totalDurationSec = 0) {
    if (!part1Data || !part2Data) return null;

    let offsetMs = 0;
    if (part1Data.duration && part1Data.duration > 30) {
      offsetMs = Math.round(part1Data.duration * 1000);
    } else {
      const part1Lines = this.parseLrc(part1Data.syncedLyrics || '', fullTitle, artist);
      const maxTime = part1Lines.length > 0 ? part1Lines[part1Lines.length - 1].timeMs : 0;
      if (maxTime > 20000) {
        offsetMs = maxTime + 6000;
      } else if (totalDurationSec > 60) {
        offsetMs = Math.round((totalDurationSec / 2) * 1000);
      } else {
        offsetMs = 210000;
      }
    }

    const part1Lines = this.parseLrc(part1Data.syncedLyrics || '', fullTitle, artist);
    const part2Lines = this.parseLrc(part2Data.syncedLyrics || '', fullTitle, artist);

    const shiftedPart2 = part2Lines.map(line => ({
      ...line,
      timeMs: line.timeMs + offsetMs
    }));

    const combinedLines = [...part1Lines, ...shiftedPart2];
    combinedLines.sort((a, b) => a.timeMs - b.timeMs);

    const providerUrl = part1Data.id
      ? `https://lrclib.net/tracks/${part1Data.id}`
      : `https://lrclib.net/search/${encodeURIComponent(`${fullTitle} ${artist}`)}`;

    return {
      synced: true,
      album: album || part1Data.albumName || '',
      lines: combinedLines,
      plainLyrics: `${part1Data.plainLyrics || ''}\n\n---\n\n${part2Data.plainLyrics || ''}`.trim(),
      provider: {
        name: 'LRCLIB (Medley Stitched)',
        url: providerUrl
      }
    };
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
      } else if (res.status === 404) {
        const primaryArtist = artist.split(/,|\s+(?:&|feat\.?|ft\.?)\s+/i)[0].trim();
        if (primaryArtist && primaryArtist.toLowerCase() !== artist.toLowerCase()) {
          const fallbackParams = new URLSearchParams({
            track_name: title,
            artist_name: primaryArtist
          });
          if (album) fallbackParams.append('album_name', album);
          if (durationSec) fallbackParams.append('duration', Math.round(durationSec));
          const fallbackRes = await fetch(`https://lrclib.net/api/get?${fallbackParams.toString()}`, {
            headers: { 'User-Agent': 'LyricsFloat-Windows/1.0' },
            signal: AbortSignal.timeout(5000)
          });
          if (fallbackRes.status === 200) {
            data = await fallbackRes.json();
          }
        }
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
      const primaryArtist = artist.split(/,|\s+(?:&|feat\.?|ft\.?)\s+/i)[0].trim();
      const searchQueries = [`${title} ${artist}`];
      if (primaryArtist && primaryArtist.toLowerCase() !== artist.toLowerCase()) {
        searchQueries.push(`${title} ${primaryArtist}`);
      }
      const cleanedTitle = title.replace(/\s*[\(\[].*?[\)\]]/g, '').replace(/\s*-\s*.*$/, '').trim();
      if (cleanedTitle && cleanedTitle.toLowerCase() !== title.toLowerCase()) {
        searchQueries.push(`${cleanedTitle} ${artist}`);
        if (primaryArtist && primaryArtist.toLowerCase() !== artist.toLowerCase()) {
          searchQueries.push(`${cleanedTitle} ${primaryArtist}`);
        }
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

    // Medley / Compound Title Fallback:
    // If unsplit compound title (e.g. "Baptized in Fear / Open Hearts") returned no synced lyrics,
    // split into individual parts and stitch them together with duration offset
    if (!data || !data.syncedLyrics) {
      const parts = this.splitCompoundTitle(title);
      if (parts.length >= 2) {
        try {
          const part1Data = await this.queryTrackLyrics(parts[0], artist, album);
          const part2Data = await this.queryTrackLyrics(parts[1], artist, album);

          if (part1Data && part1Data.syncedLyrics && part2Data && part2Data.syncedLyrics) {
            const stitched = this.stitchMedley(part1Data, part2Data, title, artist, album, durationSec);
            if (stitched) {
              this.memoryCache.set(cacheKey, stitched);
              return stitched;
            }
          }
        } catch (medleyErr) {
          console.warn(`[LyricsService] medley stitching error: ${medleyErr.message}`);
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
          lines: this.parseLrc(data.syncedLyrics, title, artist, durationSec),
          plainLyrics: data.plainLyrics || '',
          provider
        };
      } else if (data.plainLyrics) {
        const parsed = this.parseLrc(data.plainLyrics, title, artist, durationSec);
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

module.exports = { LyricsService, normalizePunctuation, SPANISH_MARKERS };
