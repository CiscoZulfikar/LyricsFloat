const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function norm(str) {
  return (str || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function isTrackMatch(resultTitle, targetTitle) {
  const r = norm(resultTitle);
  const t = norm(targetTitle);
  if (!r || !t) return false;
  return r.includes(t) || t.includes(r);
}


function getTargetCountries(title, artist, album = '') {
  const combined = `${title} ${artist} ${album}`;
  if (/[\u3040-\u30ff]/.test(combined)) {
    return ['JP', 'US'];
  }
  if (/[\uac00-\ud7af]/.test(combined)) {
    return ['KR', 'US'];
  }
  if (/[\u4e00-\u9fff]/.test(combined)) {
    return ['JP', 'TW', 'HK', 'US'];
  }
  return ['US', 'GB', 'JP'];
}


class CoverService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'cache', 'covers');
    this.memoryCache = new Map();
  }

  getCacheKey(title, artist, album) {
    const raw = `${(title || '').toLowerCase().trim()}___${(artist || '').toLowerCase().trim()}___${(album || '').toLowerCase().trim()}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  async fetchTrackMetadata(title, artist, album = '') {
    if (!title || !artist) return null;
    const cacheKey = this.getCacheKey(title, artist, album);

    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (typeof cached === 'string') {
        return { coverUrl: cached, isExplicit: false };
      }
      return cached;
    }

    const meta = {
      coverUrl: null,
      isExplicit: false
    };

    if (/\b(explicit)\b/i.test(`${title} ${album}`)) {
      meta.isExplicit = true;
    }

    try {
      // 1. Try Deezer with title + artist + album (Best album release accuracy)
      if (album) {
        try {
          const q = encodeURIComponent(`${title} ${artist} ${album}`);
          const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const d = await res.json();
            if (d.data && d.data.length > 0) {
              const match = d.data.find(item => isTrackMatch(item.title, title) && item.album && norm(item.album.title).includes(norm(album)));
              if (match) {
                if (match.explicit_lyrics || match.explicit_content_lyrics === 1) {
                  meta.isExplicit = true;
                }
                if (match.album && match.album.cover_big) {
                  meta.coverUrl = match.album.cover_xl || match.album.cover_big;
                  this.memoryCache.set(cacheKey, meta);
                  return meta;
                }
              }
            }
          }
        } catch (e) {}
      }

      // 2. Fallback: Deezer with title + artist
      try {
        const q = encodeURIComponent(`${title} ${artist}`);
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const d = await res.json();
          if (d.data && d.data.length > 0) {
            const match = d.data.find(item => isTrackMatch(item.title, title));
            if (match) {
              if (match.explicit_lyrics || match.explicit_content_lyrics === 1) {
                meta.isExplicit = true;
              }
              if (match.album && match.album.cover_big) {
                meta.coverUrl = match.album.cover_xl || match.album.cover_big;
                this.memoryCache.set(cacheKey, meta);
                return meta;
              }
            }
          }
        }
      } catch (e) {}

      // 3. Try iTunes with regional storefronts (Prioritizing regional country based on language script)
      const countries = getTargetCountries(title, artist, album);
      for (const country of countries) {
        // 3a. iTunes with title + artist + album
        if (album) {
          try {
            const q = encodeURIComponent(`${title} ${artist} ${album}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${q}&country=${country}&entity=song&limit=5`, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
              const d = await res.json();
              if (d.results && d.results.length > 0) {
                const match = d.results.find(item => isTrackMatch(item.trackName, title) && norm(item.collectionName).includes(norm(album)));
                if (match) {
                  if (match.trackExplicitness === 'explicit' || match.collectionExplicitness === 'explicit') {
                    meta.isExplicit = true;
                  }
                  if (match.artworkUrl100) {
                    meta.coverUrl = match.artworkUrl100.replace('100x100bb', '512x512bb');
                    this.memoryCache.set(cacheKey, meta);
                    return meta;
                  }
                }
              }
            }
          } catch (e) {}
        }

        // 3b. iTunes with title + artist
        try {
          const q = encodeURIComponent(`${title} ${artist}`);
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&country=${country}&entity=song&limit=5`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const d = await res.json();
            if (d.results && d.results.length > 0) {
              const match = d.results.find(item => isTrackMatch(item.trackName, title));
              if (match) {
                if (match.trackExplicitness === 'explicit' || match.collectionExplicitness === 'explicit') {
                  meta.isExplicit = true;
                }
                if (match.artworkUrl100) {
                  meta.coverUrl = match.artworkUrl100.replace('100x100bb', '512x512bb');
                  this.memoryCache.set(cacheKey, meta);
                  return meta;
                }
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Metadata fetch error:', e.message);
    }

    this.memoryCache.set(cacheKey, meta);
    return meta;
  }

  async fetchCoverUrl(title, artist, album = '') {
    const meta = await this.fetchTrackMetadata(title, artist, album);
    return meta ? meta.coverUrl : null;
  }
}

module.exports = { CoverService };
