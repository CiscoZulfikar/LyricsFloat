const assert = require('assert');
const crypto = require('crypto');
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

  const staleTrackKey = 'artist_stale_cache_track';
  const legacyCacheKey = crypto.createHash('md5')
    .update(`v3___${staleTrackKey}___en`)
    .digest('hex');
  fs.writeFileSync(path.join(testCacheDir, `${legacyCacheKey}.json`), JSON.stringify([
    { timeMs: 1000, translation: 'PLEASE SELECT TWO DISTINCT LANGUAGES', detectedLang: 'zh' }
  ]));

  const refreshedService = new TranslationService(testCacheDir);
  refreshedService.fetchTranslation = async (text) => text.split('\n').map(line => `fresh: ${line}`);
  const refreshedResult = await refreshedService.translateLyrics({
    trackKey: staleTrackKey,
    lines: [{ timeMs: 1000, text: "I'm posted in Hong Kong" }],
    targetLang: 'en'
  });
  assert.strictEqual(
    refreshedResult[0].translation,
    "Fresh: I'm posted in Hong Kong",
    'Translations cached with the previous cache version must not survive the fix'
  );

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.startsWith('https://translate.googleapis.com/')) {
      return { ok: false, status: 503 };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: '403',
        responseDetails: 'PLEASE SELECT TWO DISTINCT LANGUAGES',
        responseData: { translatedText: 'PLEASE SELECT TWO DISTINCT LANGUAGES' }
      })
    };
  };
  try {
    const fallbackService = new TranslationService(testCacheDir);
    const singleFallback = await fallbackService.fetchSingleText("I'm posted in Hong Kong", 'en');
    assert.strictEqual(singleFallback.translation, '', 'MyMemory error responses must not be shown as lyrics');

    const batchFallback = await fallbackService.fetchWithMyMemory(["I'm posted in Hong Kong"], 'en');
    assert.deepStrictEqual(batchFallback, ["I'm posted in Hong Kong"], 'MyMemory batch errors should preserve the original lyric');
  } finally {
    global.fetch = originalFetch;
  }

    const incompleteTrackKey = 'artist_incomplete_cache_track';
    const incompleteService = new TranslationService(testCacheDir);
    const missingLine = String.fromCodePoint(
      0x7136, 0x5f8c, 0x662f, 0x7a7a, 0x20, 0x52a0, 0x4e0a, 0x4e0d, 0x6b7b, 0x7684, 0x5fc3, 0x75db
    );
    const incompleteLines = [
      { timeMs: 1000, text: 'Still remember when we met' },
      { timeMs: 2000, text: missingLine }
    ];
    fs.writeFileSync(
      path.join(testCacheDir, `${incompleteService.getCacheKey(incompleteTrackKey, 'en')}.json`),
      JSON.stringify([
        { timeMs: 1000, translation: '', detectedLang: 'en', isPartiallyForeign: false },
        { timeMs: 2000, translation: '', detectedLang: 'zh', isPartiallyForeign: true }
      ])
    );
    let retryCount = 0;
    incompleteService.translateSingleLine = async (text) => {
      retryCount++;
      if (retryCount === 1) {
        return { translation: '', detectedLang: 'zh', isPartiallyForeign: true };
      }
      return { translation: 'Then there is emptiness, plus an undying heartache', detectedLang: 'zh', isPartiallyForeign: true };
    };
    assert.strictEqual(
      incompleteService.getCachedTranslation(incompleteTrackKey, 'en', incompleteLines.length, incompleteLines),
      null,
      'Incomplete foreign-language cache entries must trigger a retry'
    );
    const retriedLines = await incompleteService.translateLyrics({
      trackKey: incompleteTrackKey,
      lines: incompleteLines,
      targetLang: 'en'
    });
    assert.strictEqual(retryCount, 2, 'The failed foreign line should be retried when its first recovery attempt fails');
    assert.strictEqual(
      retriedLines[1].translation,
      'Then there is emptiness, plus an undying heartache',
      'A previously missing foreign translation should be refreshed'
    );

    const parentheticalService = new TranslationService(testCacheDir);
  const sourceLanguages = [];
  parentheticalService.fetchSingleText = async (text, targetLang, signal, sourceLang) => {
    sourceLanguages.push(sourceLang);
    if (/[\u4e00-\u9fff]/.test(text)) {
      return { text, translation: 'You are like the monsoon', detectedLang: 'en' };
    }
    return { text, translation: text, detectedLang: 'en' };
  };
  const parentheticalResult = await parentheticalService.translateSingleLine(
    '你似季候風 抵擋計劃全也無用 (oh, oh my)',
    'en'
  );
  assert.deepStrictEqual(sourceLanguages, ['zh', 'auto'], 'Chinese lyrics and English ad-libs must be translated with their own source detection');
  assert.strictEqual(parentheticalResult.detectedLang, 'zh', 'Chinese source detection must override a false English result');
  assert.strictEqual(parentheticalResult.isPartiallyForeign, true, 'Chinese lyrics with English ad-libs must remain translatable');
  assert.ok(parentheticalResult.translation.includes('You are like the monsoon'), 'Chinese lyrics should receive a translation');
  assert.ok(parentheticalResult.translation.includes('(oh, oh my)'), 'English ad-libs should be preserved');

  const normalLineService = new TranslationService(testCacheDir);
  let normalLineSource = '';
  normalLineService.fetchSingleText = async (text, targetLang, signal, sourceLang) => {
    normalLineSource = sourceLang;
    return { text, translation: 'Then there is emptiness, plus an undying heartache', detectedLang: 'zh' };
  };
  const normalChineseResult = await normalLineService.translateSingleLine(missingLine, 'en');
  assert.strictEqual(normalLineSource, 'zh', 'A normal Chinese lyric must pass the detected language code, not a boolean');
  assert.ok(normalChineseResult.translation, 'A normal Chinese lyric should be translated');

  // Clean up
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  console.log('TranslationService tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
