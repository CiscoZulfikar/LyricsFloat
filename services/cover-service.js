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


class CoverService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'cache', 'covers');
    this.memoryCache = new Map();
  }

  getCacheKey(title, artist, album) {
    const raw = `${(title || '').toLowerCase().trim()}___${(artist || '').toLowerCase().trim()}___${(album || '').toLowerCase().trim()}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  async fetchCoverUrl(title, artist, album = '') {
    if (!title || !artist) return null;
    const cacheKey = this.getCacheKey(title, artist, album);

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    try {
      // 1. Try Deezer with title + artist + album (Best album release accuracy)
      if (album) {
        try {
          const q = encodeURIComponent(`${title} ${artist} ${album}`);
          const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`);
          if (res.ok) {
            const d = await res.json();
            if (d.data && d.data.length > 0) {
              const match = d.data.find(item => isTrackMatch(item.title, title) && item.album && norm(item.album.title).includes(norm(album)));
              if (match && match.album && match.album.cover_big) {
                const cover = match.album.cover_xl || match.album.cover_big;
                this.memoryCache.set(cacheKey, cover);
                return cover;
              }
            }
          }
        } catch (e) {}
      }

      // 2. Try iTunes with title + artist + album (Strict Track Match)
      if (album) {
        try {
          const q = encodeURIComponent(`${title} ${artist} ${album}`);
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`);
          if (res.ok) {
            const d = await res.json();
            if (d.results && d.results.length > 0) {
              const match = d.results.find(item => isTrackMatch(item.trackName, title) && norm(item.collectionName).includes(norm(album)));
              if (match && match.artworkUrl100) {
                const highRes = match.artworkUrl100.replace('100x100bb', '512x512bb');
                this.memoryCache.set(cacheKey, highRes);
                return highRes;
              }
            }
          }
        } catch (e) {}
      }

      // 3. Fallback: Deezer with title + artist (Validating track name match)
      try {
        const q = encodeURIComponent(`${title} ${artist}`);
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`);
        if (res.ok) {
          const d = await res.json();
          if (d.data && d.data.length > 0) {
            const match = d.data.find(item => isTrackMatch(item.title, title));
            if (match && match.album && match.album.cover_big) {
              const cover = match.album.cover_xl || match.album.cover_big;
              this.memoryCache.set(cacheKey, cover);
              return cover;
            }
          }
        }
      } catch (e) {}

      // 4. Fallback: iTunes with title + artist (Validating track name match)
      try {
        const q = encodeURIComponent(`${title} ${artist}`);
        const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`);
        if (res.ok) {
          const d = await res.json();
          if (d.results && d.results.length > 0) {
            const match = d.results.find(item => isTrackMatch(item.trackName, title));
            if (match && match.artworkUrl100) {
              const highRes = match.artworkUrl100.replace('100x100bb', '512x512bb');
              this.memoryCache.set(cacheKey, highRes);
              return highRes;
            }
          }
        }
      } catch (e) {}
    } catch (e) {
      console.warn('Cover fetch error:', e.message);
    }

    return null;
  }
}

module.exports = { CoverService };
