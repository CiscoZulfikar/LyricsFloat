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

  // 4. Studio Album Preference when target album is unspecified
  if (!normTargetAlbum && normItemAlbum && normItemTitle && normItemAlbum !== normItemTitle) {
    score += 2000;
  }

  // 5. Official Store Catalog Bonus (iTunes strict label curation)
  if (item.source === 'itunes' || item.collectionId || item.trackId) {
    score += 800;
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

const KNOWN_EXPLICIT_TITLES = new Set(['rapgod', 'saopaulo', 'sãopaulo']);
const EXPLICIT_KEYWORDS = /(fuck|fucking|shit|bitch|pussy|dick|ass|nigga|nigger|slut|hoe|sex|damn|hell|crap|smut|horny)/i;

function detectExplicitnessFallback(title, artist, album = '', extraText = '') {
  const haystack = `${title || ''} ${artist || ''} ${album || ''} ${extraText || ''}`.toLowerCase();
  if (!haystack.trim()) return false;

  const normalizedTitle = norm(title || '');
  if (KNOWN_EXPLICIT_TITLES.has(normalizedTitle)) return true;
  if (EXPLICIT_KEYWORDS.test(haystack)) return true;

  return false;
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

  clearCache(title, artist, album = '') {
    const key = this.getCacheKey(title, artist, album);
    this.memoryCache.delete(key);
  }

  clearAllCache() {
    this.memoryCache.clear();
    if (this.cacheDir && fs.existsSync(this.cacheDir)) {
      try {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
          } catch (e) {}
        }
      } catch (e) {}
    }
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
      const searchPromises = [];
      const countries = getTargetCountries(title, artist, album);

      // 1. Deezer with title + artist + album
      if (album) {
        searchPromises.push(
          fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${cleanedSearchTitle} ${artist} ${album}`)}&limit=8`, { signal: AbortSignal.timeout(3500) })
            .then(r => r.ok ? r.json() : null)
            .then(d => (d && Array.isArray(d.data)) ? d.data.map(item => ({ ...item, source: 'deezer' })) : [])
            .catch(() => [])
        );
      }

      // 2. Deezer with title + artist
      searchPromises.push(
        fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${cleanedSearchTitle} ${artist}`)}&limit=8`, { signal: AbortSignal.timeout(3500) })
          .then(r => r.ok ? r.json() : null)
          .then(d => (d && Array.isArray(d.data)) ? d.data.map(item => ({ ...item, source: 'deezer' })) : [])
          .catch(() => [])
      );

      // 3. iTunes searches across regional storefronts
      for (const country of countries) {
        if (album) {
          searchPromises.push(
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${cleanedSearchTitle} ${artist} ${album}`)}&country=${country}&entity=song&limit=8`, { signal: AbortSignal.timeout(3500) })
              .then(r => r.ok ? r.json() : null)
              .then(d => (d && Array.isArray(d.results)) ? d.results.map(item => ({ ...item, source: 'itunes' })) : [])
              .catch(() => [])
          );
        }
        searchPromises.push(
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${cleanedSearchTitle} ${artist}`)}&country=${country}&entity=song&limit=8`, { signal: AbortSignal.timeout(3500) })
            .then(r => r.ok ? r.json() : null)
            .then(d => (d && Array.isArray(d.results)) ? d.results.map(item => ({ ...item, source: 'itunes' })) : [])
            .catch(() => [])
        );
      }

      const resultsLists = await Promise.all(searchPromises);
      const allCandidates = resultsLists.flat();

      const validCandidates = allCandidates.filter(item => {
        const itemTitle = item.title || item.trackName;
        return isTrackMatch(itemTitle, title);
      });

      if (validCandidates.length > 0) {
        validCandidates.sort((a, b) => scoreTrackCandidate(b, title, artist, album) - scoreTrackCandidate(a, title, artist, album));
        const winner = validCandidates[0];

        // Find best candidate with coverUrl (prioritizing highest-scoring candidate with an image)
        const coverCandidate = validCandidates.find(c => {
          if (c.source === 'itunes' && c.artworkUrl100) return true;
          if (c.source === 'deezer' && c.album && (c.album.cover_xl || c.album.cover_big)) return true;
          return false;
        }) || winner;

        if (coverCandidate.source === 'itunes' && coverCandidate.artworkUrl100) {
          meta.coverUrl = coverCandidate.artworkUrl100.replace('100x100bb', '512x512bb');
        } else if (coverCandidate.source === 'deezer' && coverCandidate.album) {
          meta.coverUrl = coverCandidate.album.cover_xl || coverCandidate.album.cover_big || null;
        }

        // Set album
        if (winner.source === 'itunes' && winner.collectionName && !meta.album) {
          meta.album = winner.collectionName;
        } else if (winner.source === 'deezer' && winner.album && winner.album.title && !meta.album) {
          meta.album = winner.album.title;
        }

        // Check track-level explicitness across candidates matching the target artist
        const targetArtistNorm = norm(artist);
        const artistMatchingCandidates = validCandidates.filter(cand => {
          const candArtist = (cand.artist && cand.artist.name) || cand.artistName || '';
          const candNorm = norm(candArtist);
          return candNorm && (candNorm.includes(targetArtistNorm) || targetArtistNorm.includes(candNorm));
        });

        const explicitPool = artistMatchingCandidates.length > 0 ? artistMatchingCandidates : [winner];
        for (const cand of explicitPool) {
          if (cand.explicit_lyrics || cand.explicit_content_lyrics === 1 || cand.trackExplicitness === 'explicit') {
            meta.isExplicit = true;
            break;
          }
        }

        if (!meta.isExplicit) {
          const candidateText = validCandidates.slice(0, 5).map(c => `${c.title || c.trackName || ''} ${c.album && c.album.title ? c.album.title : ''} ${c.artist && c.artist.name ? c.artist.name : c.artistName || ''}`).join(' ');
          meta.isExplicit = detectExplicitnessFallback(title, artist, album, candidateText);
        }

        // Initial artist credit resolution from winner
        if (winner.source === 'itunes') {
          if (winner.artistName && (winner.artistName.includes('&') || winner.artistName.includes(','))) {
            meta.artist = winner.artistName.replace(/\s*&\s*/g, ', ');
          } else {
            const feat = extractFeaturedFromTitle(winner.trackName);
            if (feat) {
              meta.artist = combineArtists(winner.artistName || artist, feat);
            }
          }
        }

        // Contributor enrichment via Deezer track endpoint (e.g. Daft Punk on Starboy / I Feel It Coming)
        const deezerMatch = validCandidates.find(c => c.source === 'deezer' && c.id);
        if (deezerMatch && deezerMatch.id) {
          try {
            const trackRes = await fetch(`https://api.deezer.com/track/${deezerMatch.id}`, { signal: AbortSignal.timeout(2500) });
            if (trackRes.ok) {
              const trackData = await trackRes.json();
              if (trackData.contributors && trackData.contributors.length > 0) {
                const names = trackData.contributors.map(c => c.name.trim()).filter(Boolean);
                meta.artist = mergeContributors(meta.artist || artist, names);
              }
            }
          } catch (e) {}
        }
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
