/**
 * Continuous Suites & Album Transitions Engine
 * Detects seamless continuous song pairs (e.g. The Weeknd - "Baptized in Fear" -> "Open Hearts")
 * and natural consecutive album handoffs for zero-flash lyrics rendering.
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    const exported = factory();
    module.exports = {
      ContinuousSuites: exported,
      ...exported
    };
  } else {
    root.ContinuousSuites = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  const VERIFIED_SUITES = [
    // The Weeknd - Hurry Up Tomorrow
    { artist: 'the weeknd', from: 'baptized in fear', to: 'open hearts' },
    // The Weeknd - Dawn FM
    { artist: 'the weeknd', from: 'dawn fm', to: 'gasoline' },
    { artist: 'the weeknd', from: 'best friends', to: 'is there someone else?' },
    { artist: 'the weeknd', from: 'is there someone else?', to: 'starry eyes' },
    // Pink Floyd - The Dark Side of the Moon
    { artist: 'pink floyd', from: 'speak to me', to: 'breathe (in the air)' },
    { artist: 'pink floyd', from: 'brain damage', to: 'eclipse' },
    // Queen - News of the World
    { artist: 'queen', from: 'we will rock you', to: 'we are the champions' },
    // Linkin Park - Meteora
    { artist: 'linkin park', from: 'foreword', to: "don't stay" },
    // Green Day - American Idiot
    { artist: 'green day', from: 'holiday', to: 'boulevard of broken dreams' },
    // Swedish House Mafia - Paradise Again
    { artist: 'swedish house mafia', from: "jacob's groove", to: 'mafia' }
  ];

  function cleanTitle(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .replace(/\s*[\(\[].*?[\)\]]/g, '')
      .replace(/\s*-\s*.*$/, '')
      .trim();
  }

  function cleanArtist(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .split(/,|\s+(?:&|feat\.?|ft\.?|with)\s+/i)[0]
      .trim();
  }

  function isVerifiedContinuousSuite(prevTrack, nextTrack) {
    if (!prevTrack || !nextTrack) return false;
    const prevArtist = cleanArtist(prevTrack.artist);
    const nextArtist = cleanArtist(nextTrack.artist);
    const prevTitle = cleanTitle(prevTrack.title);
    const nextTitle = cleanTitle(nextTrack.title);

    if (!prevTitle || !nextTitle) return false;

    // 1. Explicit verified registry check
    const matched = VERIFIED_SUITES.some(s => {
      const suiteArtist = cleanArtist(s.artist);
      const prevArtistMatch = Boolean(prevArtist && (prevArtist.includes(suiteArtist) || suiteArtist.includes(prevArtist)));
      const nextArtistMatch = Boolean(nextArtist && (nextArtist.includes(suiteArtist) || suiteArtist.includes(nextArtist)));
      if (!prevArtistMatch || !nextArtistMatch) return false;
      return cleanTitle(s.from) === prevTitle && cleanTitle(s.to) === nextTitle;
    });

    if (matched) return true;

    // 2. Structural pattern check for same artist or album
    const isSameArtist = Boolean(prevArtist && nextArtist && (prevArtist === nextArtist || prevArtist.includes(nextArtist) || nextArtist.includes(prevArtist)));
    const prevAlbum = (prevTrack.album || '').trim().toLowerCase();
    const nextAlbum = (nextTrack.album || '').trim().toLowerCase();
    const isSameAlbum = Boolean(prevAlbum && nextAlbum && prevAlbum === nextAlbum);

    if (isSameArtist || isSameAlbum) {
      const rawPrev = (prevTrack.title || '').toLowerCase();
      const rawNext = (nextTrack.title || '').toLowerCase();

      // Intro / Prelude / Interlude -> Main track
      if (/\b(intro|prelude|interlude)\b/.test(rawPrev) && !/\b(intro|prelude|interlude)\b/.test(rawNext)) {
        return true;
      }

      // Pt. 1 / Part 1 -> Pt. 2 / Part 2
      if (/\b(pt\.?|part)\s*1\b/.test(rawPrev) && /\b(pt\.?|part)\s*2\b/.test(rawNext)) {
        return true;
      }
    }

    return false;
  }

  function isNaturalAlbumHandoff(prevTrack, nextTrack) {
    if (!prevTrack || !nextTrack) return false;

    const prevDuration = prevTrack.durationMs || 0;
    const prevPos = prevTrack.positionMs || 0;
    const nextPos = nextTrack.positionMs || 0;

    // Track A ended naturally: reached within 3.5s of its duration (or played > 92% of song if duration >= 30s)
    const endedNaturally = prevDuration > 0 && (
      prevPos >= prevDuration - 3500 || 
      (prevDuration >= 30000 && prevPos >= prevDuration * 0.92)
    );

    // Track B started naturally: within first 3.5s
    const startedNaturally = nextPos <= 3500;

    if (!endedNaturally || !startedNaturally) {
      return false;
    }

    // Check same artist or same album
    const prevArtist = cleanArtist(prevTrack.artist);
    const nextArtist = cleanArtist(nextTrack.artist);
    const isSameArtist = Boolean(prevArtist && nextArtist && (prevArtist === nextArtist || prevArtist.includes(nextArtist) || nextArtist.includes(prevArtist)));

    const prevAlbum = (prevTrack.album || '').trim().toLowerCase();
    const nextAlbum = (nextTrack.album || '').trim().toLowerCase();
    const isSameAlbum = Boolean(prevAlbum && nextAlbum && prevAlbum === nextAlbum);

    // If verified continuous suite, handoff is guaranteed
    if (isVerifiedContinuousSuite(prevTrack, nextTrack)) {
      return true;
    }

    // For general album handoff: must be same album and (same artist or consecutive track numbers)
    if (isSameAlbum) {
      if (prevTrack.trackNumber > 0 && nextTrack.trackNumber > 0) {
        return nextTrack.trackNumber === prevTrack.trackNumber + 1;
      }
      return isSameArtist;
    }

    // Same artist with consecutive tracks
    if (isSameArtist && prevTrack.trackNumber > 0 && nextTrack.trackNumber > 0) {
      return nextTrack.trackNumber === prevTrack.trackNumber + 1;
    }

    return false;
  }

  return {
    VERIFIED_SUITES,
    isVerifiedContinuousSuite,
    isNaturalAlbumHandoff,
    cleanTitle,
    cleanArtist
  };
}));
