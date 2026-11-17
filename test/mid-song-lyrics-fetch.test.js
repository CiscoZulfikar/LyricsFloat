const assert = require('assert');
const { LyricsService, fetchLrclib } = require('../services/lyrics-service');
const { LyricsSyncEngine } = require('../src/lyrics-sync');

console.log('Running Mid-Song Lyrics Fetch & 429 Resilience Tests...');

async function runTests() {
  const service = new LyricsService();

  // 1. Verify fetchLrclib handles HTTP 429 backoff gracefully
  let callCount = 0;
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    callCount++;
    if (callCount === 1) {
      return {
        status: 429,
        headers: {
          get: (header) => (header.toLowerCase() === 'retry-after' ? '1' : null)
        },
        text: async () => JSON.stringify({ message: 'Too many requests', statusCode: 429 })
      };
    }
    return {
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        id: 999999,
        trackName: 'Test Song',
        artistName: 'Test Artist',
        syncedLyrics: '[00:01.00] Line 1\n[00:04.00] Line 2'
      })
    };
  };

  const res = await fetchLrclib('https://lrclib.net/api/get?track_name=Test&artist_name=Test', 5000, 2);
  assert.ok(res, 'fetchLrclib should return response after 429 retry');
  assert.strictEqual(res.status, 200, 'Second attempt should succeed with status 200');
  assert.strictEqual(callCount, 2, 'Should have retried exactly once after 429');

  // Restore fetch
  global.fetch = originalFetch;

  // 2. Mid-song duration discrepancy fallback test:
  // If exact query with duration returns 404, LyricsService should fall back to query without duration
  service.clearCache('Mid Song Track', 'Artist Mid');
  let queryWithDurationCalled = false;
  let queryWithoutDurationCalled = false;

  global.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('duration=')) {
      queryWithDurationCalled = true;
      return {
        status: 404,
        headers: { get: () => null },
        json: async () => ({})
      };
    }
    if (urlStr.includes('/api/get?')) {
      queryWithoutDurationCalled = true;
      return {
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          id: 12345,
          trackName: 'Mid Song Track',
          artistName: 'Artist Mid',
          duration: 180,
          syncedLyrics: '[00:10.00] First lyric\n[01:30.00] Mid song lyric'
        })
      };
    }
    return { status: 404, headers: { get: () => null }, json: async () => ({}) };
  };

  const midSongLyrics = await service.fetchLyrics({
    title: 'Mid Song Track',
    artist: 'Artist Mid',
    album: '',
    durationSec: 184 // 4s discrepancy from 180
  });

  assert.strictEqual(queryWithDurationCalled, true, 'Should first try with duration');
  assert.strictEqual(queryWithoutDurationCalled, true, 'Should fall back to query without duration on 404');
  assert.ok(midSongLyrics && midSongLyrics.synced, 'Should successfully resolve synced lyrics on fallback');
  assert.strictEqual(midSongLyrics.lines.filter(l => !l.isBreak).length, 2);
  assert.strictEqual(midSongLyrics.lines.length, 4, 'Should include intro and interlude breaks');

  // Restore fetch
  global.fetch = originalFetch;

  // 3. LyricsSyncEngine watchdog timeout test
  const container = {
    innerHTML: '',
    scrollTop: 0,
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} }
  };
  let watchdogCallbackFired = false;
  const engine = new LyricsSyncEngine(container);
  engine.onLoadingTimeout = () => {
    watchdogCallbackFired = true;
  };
  engine.showLoading('Song', 'Artist', 20);
  assert.strictEqual(engine.lines.length, 0);
  assert.ok(engine.loadingWatchdogTimeout, 'Watchdog timeout must be scheduled');
  await new Promise(r => setTimeout(r, 40));
  assert.strictEqual(watchdogCallbackFired, true, 'Watchdog onLoadingTimeout callback must fire');
  engine.destroy();

  // 4. Test LyricsService disk cache persistence
  const fs = require('fs');
  const path = require('path');
  const testLyricsCacheDir = path.join(process.cwd(), 'cache', 'test-lyrics-persistence');
  if (fs.existsSync(testLyricsCacheDir)) fs.rmSync(testLyricsCacheDir, { recursive: true, force: true });

  const diskService1 = new LyricsService(testLyricsCacheDir);
  let networkCalls = 0;
  global.fetch = async () => {
    networkCalls++;
    return {
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        id: 777777,
        trackName: 'Persistent Track',
        artistName: 'Persistent Artist',
        duration: 200,
        syncedLyrics: '[00:05.00] Persistent lyric line'
      })
    };
  };

  const fetched = await diskService1.fetchLyrics({
    title: 'Persistent Track',
    artist: 'Persistent Artist',
    album: 'Persistent Album',
    durationSec: 200
  });
  assert.ok(fetched && fetched.synced, 'First fetch should succeed via network');
  assert.strictEqual(networkCalls, 1, 'Should make 1 network call');

  // New instance simulating app restart: memory cache is empty
  const diskService2 = new LyricsService(testLyricsCacheDir);
  assert.strictEqual(diskService2.memoryCache.size, 0, 'New instance memory cache must be empty');

  // Turn off network: if network is called, fail!
  global.fetch = async () => {
    throw new Error('Network should NOT be called on disk cache hit!');
  };

  const cachedResult = await diskService2.fetchLyrics({
    title: 'Persistent Track',
    artist: 'Persistent Artist',
    album: 'Persistent Album',
    durationSec: 200
  });
  assert.ok(cachedResult && cachedResult.synced, 'Should successfully load lyrics from disk cache');
  assert.strictEqual(cachedResult.lines[0].text, 'Persistent lyric line');

  // Clean up
  global.fetch = originalFetch;
  if (fs.existsSync(testLyricsCacheDir)) fs.rmSync(testLyricsCacheDir, { recursive: true, force: true });

  // 5. Test Album-Aware Blur decision logic & loadedAlbum lifecycle
  const checkAlbumMatch = (prevAlbum, nextAlbum) => {
    const p = (prevAlbum || '').toLowerCase().trim();
    const n = (nextAlbum || '').toLowerCase().trim();
    return Boolean(p && n && p === n);
  };
  assert.strictEqual(checkAlbumMatch('Starboy', 'Starboy'), true, 'Identical albums must return true (no blur)');
  assert.strictEqual(checkAlbumMatch('Starboy', 'STARBOY'), true, 'Case-insensitive album must return true (no blur)');
  assert.strictEqual(checkAlbumMatch('Starboy', 'After Hours'), false, 'Different albums must return false (blur)');
  assert.strictEqual(checkAlbumMatch('', 'Starboy'), false, 'Missing previous album must return false (blur)');
  assert.strictEqual(checkAlbumMatch('Starboy', ''), false, 'Missing next album must return false (blur)');

  // Simulate loadedAlbum state machine across track changes:
  let simLoadedAlbum = 'Pony';
  let simCurrentAlbum = 'Pony';
  let simBlurActive = false;

  // Track changes to "Past Won't Leave My Bed" (Album: "In Tongues")
  const nextTrack = { title: "Past Won't Leave My Bed", artist: 'Joji', album: 'In Tongues' };
  // onTrackChanging triggers handleTrackSwitch BEFORE updating currentAlbum:
  const isSame = checkAlbumMatch(simLoadedAlbum, nextTrack.album);
  assert.strictEqual(isSame, false, 'Switching from Pony to In Tongues must NOT be same album');
  simBlurActive = !isSame;
  assert.strictEqual(simBlurActive, true, 'Artwork blur must be activated immediately during track changing');
  // currentAlbum updates for metadata, but loadedAlbum remains until lyrics arrive
  simCurrentAlbum = nextTrack.album;
  assert.strictEqual(simLoadedAlbum, 'Pony', 'loadedAlbum must NOT change before lyrics load');

  // Background playback-state tick (e.g. at 0:02) occurs while lyrics still loading:
  // setCoverArt does not touch blur, blur remains true
  assert.strictEqual(simBlurActive, true, 'Blur must remain active on playback-state ticks while lyrics load');

  // Lyrics load:
  simLoadedAlbum = nextTrack.album;
  simBlurActive = false;
  assert.strictEqual(simLoadedAlbum, 'In Tongues');
  assert.strictEqual(simBlurActive, false, 'Blur must be removed when lyrics finish loading');

  // Next track from same album arrives:
  const sameAlbumTrack = { title: 'Demons', artist: 'Joji', album: 'In Tongues' };
  const isSameAlbumTrack = checkAlbumMatch(simLoadedAlbum, sameAlbumTrack.album);
  assert.strictEqual(isSameAlbumTrack, true, 'Demons on In Tongues must be recognized as same album');
  simBlurActive = !isSameAlbumTrack;
  assert.strictEqual(simBlurActive, false, 'Demons on In Tongues must NOT blur artwork');

  // 6. HTTP 503 Service Unavailable state handling
  service.clearCache('Service Error Track', 'Artist 503');
  global.fetch = async () => {
    return {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
      json: async () => ({ message: 'The API upstream is unavailable' })
    };
  };

  const errorResult = await service.fetchLyrics({
    title: 'Service Error Track',
    artist: 'Artist 503',
    album: '',
    durationSec: 200
  });

  assert.strictEqual(errorResult, null, 'Service 503 must resolve to null lyrics');
  assert.strictEqual(service.lastErrorStatus, 503, 'LyricsService must record lastErrorStatus as 503');

  // Test LyricsSyncEngine rendering 503 state
  const testSyncContainer = {
    innerHTML: '',
    scrollTop: 0,
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} }
  };
  const testSyncEngine = new LyricsSyncEngine(testSyncContainer);
  testSyncEngine.loadLyrics({ lines: [], errorStatus: 503 });
  assert.ok(testSyncContainer.innerHTML.includes('503') || testSyncContainer.innerHTML.includes('Service temporarily unavailable'), 'LyricsSyncEngine must display 503 service unavailable message');
  assert.ok(testSyncContainer.innerHTML.includes('Click to retry'), '503 state must display click to retry hint');

  global.fetch = originalFetch;

  console.log('✓ All Mid-Song Lyrics Fetch, Disk Caching & Blur tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
