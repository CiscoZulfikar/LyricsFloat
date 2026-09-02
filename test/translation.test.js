const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TranslationService } = require('../services/translation');

const testCacheDir = path.join(__dirname, 'test-translation-cache');
if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });

async function runTests() {
  const service = new TranslationService(testCacheDir);

  // Mock translation fetcher to avoid external API dependency during unit test
  service.fetchTranslation = async (text, targetLang) => {
    return text.split('\n').map(l => `[${targetLang}] ${l}`);
  };

  const sampleLines = [
    { timeMs: 1200, text: '君の声を聴かせて' },
    { timeMs: 4500, text: '消えない温もり' }
  ];

  const result1 = await service.translateLyrics({
    trackKey: 'artist_test_track_1',
    lines: sampleLines,
    targetLang: 'en'
  });

  assert.strictEqual(result1.length, 2);
  assert.strictEqual(result1[0].translation, '[en] 君の声を聴かせて');
  assert.strictEqual(result1[0].timeMs, 1200);

  // Verify disk cache creation
  const cacheKey = service.getCacheKey('artist_test_track_1', 'en');
  const cacheFile = path.join(testCacheDir, `${cacheKey}.json`);
  assert.ok(fs.existsSync(cacheFile), 'Cache file should exist on disk');

  // Verify second request returns from disk cache
  service.fetchTranslation = () => { throw new Error('Should not call API on cache hit'); };
  const resultCached = await service.translateLyrics({
    trackKey: 'artist_test_track_1',
    lines: sampleLines,
    targetLang: 'en'
  });
  assert.strictEqual(resultCached[0].translation, '[en] 君の声を聴かせて');

  // Clean up
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  console.log('TranslationService tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
