const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function norm(str) {
  return (str || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function extractFeaturedFromTitle(title) {
  if (!title) return null;
  const match = title.match(/[\(\[](?:feat\.?|ft\.?|with)\s+([^()\[\]]+)[\)\]]/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

function cleanTitle(title) {
  if (!title) return '';
  return title.replace(/\s*[\(\[](?:feat\.?|ft\.?|with)\s+[^()\[\]]+[\)\]]/gi, '').trim();
}

function combineArtists(primaryArtist, featured) {
  if (!featured) return primaryArtist;
  const normPrimary = norm(primaryArtist);
  const normFeatured = norm(featured);
  if (normPrimary.includes(normFeatured)) return primaryArtist;
  return `${primaryArtist}, ${featured.replace(/\s*&\s*/g, ', ')}`;
}

function mergeContributors(originalArtist, contributors) {
  if (!contributors || contributors.length <= 1) return originalArtist;
  
  if (originalArtist.includes(',') || originalArtist.includes('&') || /\b(feat\.?|ft\.?)\b/i.test(originalArtist)) {
    return originalArtist;
  }
  
  const normOrig = norm(originalArtist);
  const hasMatch = contributors.some(c => {
    const nc = norm(c);
    return nc.includes(normOrig) || normOrig.includes(nc);
  });
  
  if (!hasMatch) {
    return originalArtist;
  }

  const extraContributors = [];
  for (const c of contributors) {
    const nc = norm(c);
    if (!nc.includes(normOrig) && !normOrig.includes(nc)) {
      if (!extraContributors.some(ec => norm(ec) === nc)) {
        extraContributors.push(c);
      }
    }
  }

  if (extraContributors.length === 0) {
    return originalArtist;
  }

  return `${originalArtist}, ${extraContributors.join(', ')}`;
}

function isTrackMatch(resultTitle, targetTitle) {
  const r = norm(resultTitle);
  const t = norm(targetTitle);
  const ct = norm(cleanTitle(targetTitle));
  const cr = norm(cleanTitle(resultTitle));
  if (!r || (!t && !ct)) return false;
  return r.includes(t) || t.includes(r) || r.includes(ct) || ct.includes(r) || cr.includes(ct) || ct.includes(cr);
}


function scoreTrackCandidate(item, targetTitle, targetArtist, targetAlbum) {
  let score = 0;
  const itemTitle = (item.title || item.trackName || '').toLowerCase().trim();
  const targetTitleLower = (targetTitle || '').toLowerCase().trim();
  const itemAlbum = ((item.album && item.album.title) || item.collectionName || '').toLowerCase().trim();
  const targetAlbumLower = (targetAlbum || '').toLowerCase().trim();
  const itemArtist = ((item.artist && item.artist.name) || item.artistName || '').toLowerCase().trim();
  const targetArtistLower = (targetArtist || '').toLowerCase().trim();

  const normTargetTitle = norm(targetTitleLower);
  const normItemTitle = norm(itemTitle);
  const normTargetClean = norm(cleanTitle(targetTitleLower));
  const normItemClean = norm(cleanTitle(itemTitle));

  const normTargetAlbum = norm(targetAlbumLower);
  const normItemAlbum = norm(itemAlbum);

  // 1. Album Matching
  if (normTargetAlbum && normItemAlbum) {
    if (normItemAlbum === normTargetAlbum) {
      score += 6000;
    } else if (normItemAlbum.startsWith(normTargetAlbum) || normItemAlbum.includes(normTargetAlbum)) {
      score += 1500;
      const targetHasDeluxe = /\b(deluxe|bonus|edition|repack|lana)\b/i.test(targetAlbumLower);
      const itemHasDeluxe = /\b(deluxe|bonus|edition|repack|lana)\b/i.test(itemAlbum);
      if (itemHasDeluxe && !targetHasDeluxe) {
        score -= 4000;
      }
    } else {
      score -= 3000;
    }
  }

  // 2. Title Matching
  if (normItemTitle === normTargetTitle) {
    score += 7000;
  } else if (normItemClean === normTargetClean) {
    score += 4000;
    const targetFeat = extractFeaturedFromTitle(targetTitle);
    const itemFeat = extractFeaturedFromTitle(itemTitle);
    if (targetFeat && itemFeat && norm(targetFeat) === norm(itemFeat)) {
      score += 2500;
    } else if (targetFeat && !itemFeat) {
      score -= 2000;
    }
  } else if (normItemTitle.includes(normTargetClean)) {
    score += 1000;
  }

  // Heavily penalize unwanted variations (e.g. "just SZA", "solo", "instrumental", "acoustic", "remix")
  const unwantedExtra = /\((just\s+\w+|solo|acoustic|instrumental|karaoke|remix|live)/i.test(itemTitle);
  const targetWanted = /\((just\s+\w+|solo|acoustic|instrumental|karaoke|remix|live)/i.test(targetTitleLower);
  if (unwantedExtra && !targetWanted) {
    score -= 8000;
  }

  // 3. Artist Matching
  if (norm(itemArtist) === norm(targetArtistLower)) {
    score += 3000;
  } else if (norm(itemArtist).includes(norm(targetArtistLower)) || norm(targetArtistLower).includes(norm(itemArtist))) {
    score += 1500;
  }

  return score;
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

  finalizeMeta(meta, title, artist) {
    if (!meta) return null;
    const feat = extractFeaturedFromTitle(title);
    if (feat) {
      meta.artist = combineArtists(meta.artist || artist, feat);
    }
    meta.artist = meta.artist || artist;
    return meta;
  }

  async fetchTrackMetadata(title, artist, album = '') {
    if (!title || !artist) return null;
    const cacheKey = this.getCacheKey(title, artist, album);

    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (typeof cached === 'string') {
        return this.finalizeMeta({ coverUrl: cached, isExplicit: false, artist, album: album || '' }, title, artist);
      }
      return this.finalizeMeta(cached, title, artist);
    }

    const meta = {
      coverUrl: null,
      isExplicit: false,
      album: album || '',
      artist: artist || ''
    };

    if (/\b(explicit)\b/i.test(`${title} ${album}`)) {
      meta.isExplicit = true;
    }

    const cleanedSearchTitle = cleanTitle(title) || title;

    try {
      // 1. Try Deezer with title + artist + album (Best album release accuracy)
      if (album) {
        try {
          const q = encodeURIComponent(`${cleanedSearchTitle} ${artist} ${album}`);
          const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=8`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const d = await res.json();
            if (d.data && d.data.length > 0) {
              const matches = d.data
                .filter(item => isTrackMatch(item.title, title) && item.album && norm(item.album.title).includes(norm(album)))
                .sort((a, b) => scoreTrackCandidate(b, title, artist, album) - scoreTrackCandidate(a, title, artist, album));
              const match = matches[0];
              if (match) {
                if (match.explicit_lyrics || match.explicit_content_lyrics === 1) {
                  meta.isExplicit = true;
                }
                if (match.album && match.album.title) {
                  meta.album = match.album.title;
                }
                if (match.album && match.album.cover_big) {
                  meta.coverUrl = match.album.cover_xl || match.album.cover_big;
                }
                if (match.id) {
                  try {
                    const trackRes = await fetch(`https://api.deezer.com/track/${match.id}`, { signal: AbortSignal.timeout(2500) });
                    if (trackRes.ok) {
                      const trackData = await trackRes.json();
                      if (trackData.contributors && trackData.contributors.length > 0) {
                        const names = trackData.contributors.map(c => c.name.trim()).filter(Boolean);
                        meta.artist = mergeContributors(artist, names);
                      }
                    }
                  } catch (e) {}
                }
                if (meta.coverUrl) {
                  const finalized = this.finalizeMeta(meta, title, artist);
                  this.memoryCache.set(cacheKey, finalized);
                  return finalized;
                }
              }
            }
          }
        } catch (e) {}
      }

      // 2. Fallback: Deezer with title + artist
      try {
        const q = encodeURIComponent(`${cleanedSearchTitle} ${artist}`);
        const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=8`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const d = await res.json();
          if (d.data && d.data.length > 0) {
            const matches = d.data
              .filter(item => isTrackMatch(item.title, title))
              .sort((a, b) => scoreTrackCandidate(b, title, artist, album) - scoreTrackCandidate(a, title, artist, album));
            const match = matches[0];
            if (match) {
              if (match.explicit_lyrics || match.explicit_content_lyrics === 1) {
                meta.isExplicit = true;
              }
              if (match.album && match.album.title && !meta.album) {
                meta.album = match.album.title;
              }
              if (match.album && match.album.cover_big) {
                meta.coverUrl = match.album.cover_xl || match.album.cover_big;
              }
              if (match.id) {
                try {
                  const trackRes = await fetch(`https://api.deezer.com/track/${match.id}`, { signal: AbortSignal.timeout(2500) });
                  if (trackRes.ok) {
                    const trackData = await trackRes.json();
                    if (trackData.contributors && trackData.contributors.length > 0) {
                      const names = trackData.contributors.map(c => c.name.trim()).filter(Boolean);
                      meta.artist = mergeContributors(artist, names);
                    }
                  }
                } catch (e) {}
              }
              if (meta.coverUrl) {
                const finalized = this.finalizeMeta(meta, title, artist);
                this.memoryCache.set(cacheKey, finalized);
                return finalized;
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
            const q = encodeURIComponent(`${cleanedSearchTitle} ${artist} ${album}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${q}&country=${country}&entity=song&limit=8`, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
              const d = await res.json();
              if (d.results && d.results.length > 0) {
                const matches = d.results
                  .filter(item => isTrackMatch(item.trackName, title) && norm(item.collectionName).includes(norm(album)))
                  .sort((a, b) => scoreTrackCandidate(b, title, artist, album) - scoreTrackCandidate(a, title, artist, album));
                const match = matches[0];
                if (match) {
                  if (match.trackExplicitness === 'explicit' || match.collectionExplicitness === 'explicit') {
                    meta.isExplicit = true;
                  }
                  if (match.collectionName) {
                    meta.album = match.collectionName;
                  }
                  if (match.artworkUrl100) {
                    meta.coverUrl = match.artworkUrl100.replace('100x100bb', '512x512bb');
                  }
                  if (!meta.artist || meta.artist === artist) {
                    if (match.artistName && (match.artistName.includes('&') || match.artistName.includes(','))) {
                      meta.artist = match.artistName.replace(/\s*&\s*/g, ', ');
                    } else {
                      const feat = extractFeaturedFromTitle(match.trackName);
                      if (feat) {
                        meta.artist = combineArtists(match.artistName || artist, feat);
                      }
                    }
                  }
                  if (meta.coverUrl) {
                    const finalized = this.finalizeMeta(meta, title, artist);
                    this.memoryCache.set(cacheKey, finalized);
                    return finalized;
                  }
                }
              }
            }
          } catch (e) {}
        }

        // 3b. iTunes with title + artist
        try {
          const q = encodeURIComponent(`${cleanedSearchTitle} ${artist}`);
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&country=${country}&entity=song&limit=8`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const d = await res.json();
            if (d.results && d.results.length > 0) {
              const matches = d.results
                .filter(item => isTrackMatch(item.trackName, title))
                .sort((a, b) => scoreTrackCandidate(b, title, artist, album) - scoreTrackCandidate(a, title, artist, album));
              const match = matches[0];
              if (match) {
                if (match.trackExplicitness === 'explicit' || match.collectionExplicitness === 'explicit') {
                  meta.isExplicit = true;
                }
                if (match.collectionName && !meta.album) {
                  meta.album = match.collectionName;
                }
                if (match.artworkUrl100) {
                  meta.coverUrl = match.artworkUrl100.replace('100x100bb', '512x512bb');
                }
                if (!meta.artist || meta.artist === artist) {
                  if (match.artistName && (match.artistName.includes('&') || match.artistName.includes(','))) {
                    meta.artist = match.artistName.replace(/\s*&\s*/g, ', ');
                  } else {
                    const feat = extractFeaturedFromTitle(match.trackName);
                    if (feat) {
                      meta.artist = combineArtists(match.artistName || artist, feat);
                    }
                  }
                }
                if (meta.coverUrl) {
                  const finalized = this.finalizeMeta(meta, title, artist);
                  this.memoryCache.set(cacheKey, finalized);
                  return finalized;
                }
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Metadata fetch error:', e.message);
    }

    const finalized = this.finalizeMeta(meta, title, artist);
    this.memoryCache.set(cacheKey, finalized);
    return finalized;
  }

  async fetchCoverUrl(title, artist, album = '') {
    const meta = await this.fetchTrackMetadata(title, artist, album);
    return meta ? meta.coverUrl : null;
  }
}

module.exports = {
  CoverService,
  extractFeaturedFromTitle,
  cleanTitle,
  combineArtists,
  mergeContributors,
  scoreTrackCandidate,
  norm
};
