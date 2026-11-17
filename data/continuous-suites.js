/**
 * LyricsFloat - Verified Continuous Song Suites Registry
 * Pairs of tracks designed for zero-gap, continuous playback transitions.
 */

(function(root) {
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VERIFIED_SUITES };
  }
  if (root) {
    root.VERIFIED_SUITES = VERIFIED_SUITES;
  }
})(typeof self !== 'undefined' ? self : this);
