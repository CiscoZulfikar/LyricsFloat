const assert = require('assert');
const { LyricsService } = require('../services/lyrics-service');
const { LyricsEnricher } = require('../services/lyrics-enricher');
const { ConfigStore } = require('../services/config-store');
const path = require('path');
const fs = require('fs');

async function runIntegration() {
  const testCacheDir = path.join(__dirname, 'test-int-cache');
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });

  const lyricsService = new LyricsService(testCacheDir);
  const enricher = new LyricsEnricher(testCacheDir);
  await enricher.init();

  // 1. Simulate Japanese track
  const japaneseLrc = `[00:01.00]君の声を聴かせて
[00:04.00]消えない温もりを抱きしめて`;

  const parsed = lyricsService.parseLrc(japaneseLrc);
  assert.strictEqual(parsed.length, 2);

  let translationCallbackCalled = false;
  const enriched = await enricher.enrichLyrics('Kimi no Koe', 'Test Artist', {
    synced: true,
    lines: parsed
  }, 'en', (translationData) => {
    translationCallbackCalled = true;
    assert.strictEqual(translationData.lines.length, 2);
  });

  assert.strictEqual(enriched.isForeign, true);
  assert.strictEqual(enriched.detectedScript, 'japanese');
  assert.strictEqual(enriched.lines[0].original, '君の声を聴かせて');
  assert.ok(enriched.lines[0].romaji.length > 0, 'Romaji should be generated');

  // 2. Simulate English track (Romaji should remain empty)
  const englishLrc = `[00:01.00]Hello world, let's sing together
[00:04.00]Nothing can stop us now`;
  const englishParsed = lyricsService.parseLrc(englishLrc);
  const englishEnriched = await enricher.enrichLyrics('Hello', 'Adele', {
    synced: true,
    lines: englishParsed
  }, 'en');

  assert.strictEqual(englishEnriched.isForeign, false);
  assert.strictEqual(englishEnriched.lines[0].romaji, '');

  // 3. Test ConfigStore
  const config = new ConfigStore(path.join(testCacheDir, 'test-config.json'));
  assert.strictEqual(config.get('showRomaji'), true);
  config.set('targetLanguage', 'id');
  assert.strictEqual(config.get('targetLanguage'), 'id');

  // Clean up
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  console.log('All end-to-end integration tests passed!');
}

runIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
