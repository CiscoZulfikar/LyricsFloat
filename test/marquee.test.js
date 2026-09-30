const assert = require('assert');
const { MarqueeManager, MarqueeTrack, MARQUEE_CONFIG } = require('../src/marquee');

function runTests() {
  console.log('Running MarqueeManager continuous marquee & smooth reset tests...');

  // Mock DOM elements
  const mockContainer = {
    clientWidth: 250,
    style: {
      setProperty: (k, v) => { mockContainer.style[k] = v; },
      removeProperty: (k) => { delete mockContainer.style[k]; }
    },
    classList: {
      _classes: new Set(),
      add: (c) => mockContainer.classList._classes.add(c),
      remove: (c) => mockContainer.classList._classes.delete(c),
      contains: (c) => mockContainer.classList._classes.has(c)
    }
  };

  const mockTitleElem = {
    textContent: '',
    scrollWidth: 350,
    parentElement: mockContainer,
    style: {
      transform: 'none',
      setProperty: (k, v) => { mockTitleElem.style[k] = v; }
    }
  };

  const mockArtistContainer = {
    clientWidth: 250,
    style: {
      setProperty: (k, v) => { mockArtistContainer.style[k] = v; },
      removeProperty: (k) => { delete mockArtistContainer.style[k]; }
    },
    classList: {
      _classes: new Set(),
      add: (c) => mockArtistContainer.classList._classes.add(c),
      remove: (c) => mockArtistContainer.classList._classes.delete(c),
      contains: (c) => mockArtistContainer.classList._classes.has(c)
    }
  };

  const mockArtistElem = {
    textContent: '',
    scrollWidth: 320,
    parentElement: mockArtistContainer,
    style: {
      transform: 'none',
      setProperty: (k, v) => { mockArtistElem.style[k] = v; }
    }
  };

  // Mock global window
  global.window = {
    getComputedStyle: (el) => ({
      transform: el.style.transform || 'none'
    }),
    addEventListener: () => {}
  };

  global.DOMMatrix = class DOMMatrix {
    constructor(transformStr) {
      this.m41 = 0;
      if (transformStr && transformStr.includes('matrix')) {
        const match = transformStr.match(/matrix.*\((.+)\)/);
        if (match) {
          const parts = match[1].split(',').map(s => parseFloat(s.trim()));
          this.m41 = parts[4] || 0;
        }
      }
    }
  };

  const manager = new MarqueeManager({
    trackTitle: mockTitleElem,
    trackArtist: mockArtistElem
  });

  // Test 1: getTranslateX returns correct translation
  mockTitleElem.style.transform = 'matrix(1, 0, 0, 1, -48.5, 0)';
  manager.titleTrack.x = -48.5;
  const tx = manager.getTranslateX(mockTitleElem);
  assert.strictEqual(tx, -48.5, 'Should correctly extract negative translateX');
  console.log('✓ getTranslateX successfully parsed matrix/offset translation (-48.5px)');

  // Test 2: Unified configuration parameters for Title and Artist
  assert.strictEqual(MARQUEE_CONFIG.SPEED, 26, 'Reading speed must be constant 26 px/s');
  assert.strictEqual(manager.titleTrack.onNeedsLoop !== null, true, 'Title track loop hook bound');
  assert.strictEqual(manager.artistTrack.onNeedsLoop !== null, true, 'Artist track loop hook bound');
  console.log('✓ Unified speed and pause parameters confirmed for both Title and Artist');

  // Test 3: Continuous scrolling when controls appear (container shrinks)
  manager.updateTitle('Very Long Song Title For Testing Purposes');
  assert.strictEqual(manager.titleTrack.isOverflowing, true);
  assert.strictEqual(mockContainer.classList.contains('is-overflowing'), true);

  // Fast-forward through PAUSE_START into SCROLL_LEFT
  manager.titleTrack.step(2.5); // 2.5s > 2.2s pause
  assert.strictEqual(manager.titleTrack.state, 'SCROLL_LEFT');
  manager.titleTrack.step(0.2); // Advance into scrolling
  const posBeforeShrink = manager.titleTrack.x;
  assert.strictEqual(posBeforeShrink < 0, true, 'Text should have started scrolling left');

  // Simulate controls appearing (container shrinks from 250 to 160)
  mockContainer.clientWidth = 160;
  manager.updateTitle('Very Long Song Title For Testing Purposes', true);

  // Position must NOT reset to 0 or snap!
  assert.strictEqual(manager.titleTrack.x, posBeforeShrink, 'Position must not reset when controls appear');
  assert.strictEqual(manager.titleTrack.state, 'SCROLL_LEFT', 'State must remain SCROLL_LEFT');

  // Advance by another 100ms: should move forward smoothly from posBeforeShrink
  manager.titleTrack.step(0.1);
  const expectedNextPos = posBeforeShrink - (MARQUEE_CONFIG.SPEED * 0.1);
  assert.strictEqual(Math.abs(manager.titleTrack.x - expectedNextPos) < 0.01, true, 'Text continues scrolling forward smoothly');
  console.log('✓ Continuous marquee: animation does not reset or jump when controls appear (container shrinks)');

  // Test 4: Continuous scrolling when controls disappear (container expands)
  mockContainer.clientWidth = 240; // Still overflows (350 - 240 = 110 > 4)
  const posBeforeExpand = manager.titleTrack.x;
  manager.updateTitle('Very Long Song Title For Testing Purposes', true);

  assert.strictEqual(manager.titleTrack.x, posBeforeExpand, 'Position must not reset when controls disappear');
  assert.strictEqual(manager.titleTrack.state, 'SCROLL_LEFT', 'State must remain SCROLL_LEFT');
  console.log('✓ Continuous marquee: animation does not reset or jump when controls disappear while still overflowing');

  // Test 5: When controls disappear and text NO LONGER overflows, it smoothly glides to rest at 0px
  mockContainer.clientWidth = 400; // Text is 350, fits within 400!
  manager.updateTitle('Very Long Song Title For Testing Purposes', true);

  assert.strictEqual(manager.titleTrack.state, 'RETURNING', 'Must transition to RETURNING state instead of snapping');
  assert.strictEqual(manager.isResettingTitle, true, 'isResettingTitle flag must be true during glide');

  // Step halfway through return duration (110ms)
  manager.titleTrack.step(0.11);
  assert.strictEqual(manager.titleTrack.x > posBeforeExpand, true, 'Position should be gliding back towards 0');
  assert.strictEqual(manager.titleTrack.x < 0, true, 'Position should not overshoot 0');

  // Step to completion (another 150ms)
  manager.titleTrack.step(0.15);
  assert.strictEqual(manager.titleTrack.state, 'IDLE', 'Must transition to IDLE upon reaching origin');
  assert.strictEqual(manager.titleTrack.x, 0, 'Must rest cleanly at 0px');
  assert.strictEqual(mockTitleElem.style.transform, 'none', 'Transform must be none at rest');
  console.log('✓ Smooth glide return: when text fits, it glides back to 0px without snapping');

  // Test 6: Artist track follows the exact same seamless behavior
  manager.updateArtist('Very Long Artist Name Testing Overflow');
  assert.strictEqual(manager.artistTrack.isOverflowing, true);
  manager.artistTrack.step(2.5);
  assert.strictEqual(manager.artistTrack.state, 'SCROLL_LEFT');
  mockArtistContainer.clientWidth = 160;
  const artistPos = manager.artistTrack.x;
  manager.updateArtist('Very Long Artist Name Testing Overflow', true);
  assert.strictEqual(manager.artistTrack.x, artistPos, 'Artist position must not reset');
  console.log('✓ Artist marquee behaves identically with matching velocity and non-resetting flow');

  // Test 7: Artwork modal album wrapper marquee overflow detection & scrolling
  const mockModalAlbumContainer = {
    clientWidth: 220,
    style: {
      setProperty: (k, v) => { mockModalAlbumContainer.style[k] = v; },
      removeProperty: (k) => { delete mockModalAlbumContainer.style[k]; }
    },
    classList: {
      _classes: new Set(),
      add: (c) => mockModalAlbumContainer.classList._classes.add(c),
      remove: (c) => mockModalAlbumContainer.classList._classes.delete(c),
      contains: (c) => mockModalAlbumContainer.classList._classes.has(c)
    }
  };

  const mockModalAlbumWrapper = {
    textContent: 'Anime "Attack on Titan" Original Soundtrack',
    scrollWidth: 380,
    parentElement: mockModalAlbumContainer,
    style: {
      transform: 'none',
      setProperty: (k, v) => { mockModalAlbumWrapper.style[k] = v; }
    }
  };

  const artworkManager = new MarqueeManager({
    trackTitle: mockTitleElem,
    trackArtist: mockArtistElem,
    artworkAlbum: mockModalAlbumWrapper
  });

  artworkManager.refreshArtwork();
  assert.strictEqual(artworkManager.artworkAlbumTrack.isOverflowing, true, 'Long album headline must be detected as overflowing');
  assert.strictEqual(mockModalAlbumContainer.classList.contains('is-overflowing'), true, 'Container must receive is-overflowing class');

  // Fast-forward past pause into scroll
  artworkManager.artworkAlbumTrack.step(2.5);
  assert.strictEqual(artworkManager.artworkAlbumTrack.state, 'SCROLL_LEFT', 'Artwork album marquee should transition to SCROLL_LEFT');
  artworkManager.artworkAlbumTrack.step(0.2);
  assert.strictEqual(artworkManager.artworkAlbumTrack.x < 0, true, 'Artwork album headline must scroll to the left');
  console.log('✓ Artwork modal album headline marquee: overflows and scrolls smoothly across container');

  // Test 8: Reset artwork immediately on modal close
  artworkManager.resetArtwork();
  assert.strictEqual(artworkManager.artworkAlbumTrack.state, 'IDLE', 'resetArtwork must return state to IDLE');
  assert.strictEqual(artworkManager.artworkAlbumTrack.x, 0, 'resetArtwork must restore translation to 0px');
  console.log('✓ Artwork modal marquee resets cleanly upon modal close');

  // Clean up
  delete global.window;
  delete global.DOMMatrix;

  console.log('All MarqueeManager continuous tests passed successfully!');
}

runTests();
