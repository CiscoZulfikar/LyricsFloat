const assert = require('assert');
const { LyricsEnricher } = require('../services/lyrics-enricher');

async function runTests() {
  const enricher = new LyricsEnricher();
  
  // Mock internal services for rapid isolated testing
  enricher.transliterationService.transliterateLyrics = async (lines) => {
    return lines.map(l => ({ timeMs: l.timeMs, original: l.text, romaji: 'kimi no koe' }));
  };
  enricher.translationService.translateLyrics = async () => {
    return [{ timeMs: 1000, translation: 'Let me hear your voice' }];
  };

  const sampleRawLyrics = {
    synced: true,
    lines: [{ timeMs: 1000, text: '君の声を聴かせて' }]
  };

  let translationReadyPayload = null;
  const enriched = await enricher.enrichLyrics('Song A', 'Artist B', sampleRawLyrics, 'en', (update) => {
    translationReadyPayload = update;
  });
  assert.strictEqual(enriched.lines[0].original, '君の声を聴かせて');
  assert.strictEqual(enriched.lines[0].romaji, 'kimi no koe');
  assert.strictEqual(enriched.isForeign, true);
  assert.strictEqual(enriched.isTranslating, true);

  // Wait a tick for async translation callback
  await new Promise(r => setTimeout(r, 10));
  assert.ok(translationReadyPayload, 'onTranslationReady should be called');
  assert.strictEqual(translationReadyPayload.isTranslating, false);
  assert.strictEqual(translationReadyPayload.lines[0].translation, 'Let me hear your voice');

  // Test Vocalization Suppression (e.g. Japanese singing syllables with Romaji)
  enricher.transliterationService.transliterateLyrics = async (lines) => {
    return [
      { timeMs: 1000, original: 'ル・ル・ルルルルル・ルルル・ルルルルルル', romaji: 'ru-ru-rururururu-rururu-rururururu' },
      { timeMs: 2000, original: 'Olé olé olé olé olé olé olé', romaji: '' }
    ];
  };
  enricher.translationService.translateLyrics = async () => {
    return [
      { timeMs: 1000, translation: 'Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu Lulu', detectedLang: 'ja' },
      { timeMs: 2000, translation: 'Olay olay olay olay olay olay olay', detectedLang: 'es' }
    ];
  };

  const vocalicLyrics = {
    synced: true,
    lines: [
      { timeMs: 1000, text: 'ル・ル・ルルルルル・ルルル・ルルルルルル' },
      { timeMs: 2000, text: 'Olé olé olé olé olé olé olé' }
    ]
  };

  let vocalicUpdate = null;
  const enrichedVocalic = await enricher.enrichLyrics('Song V', 'Artist V', vocalicLyrics, 'en', (update) => {
    vocalicUpdate = update;
  });
  await new Promise(r => setTimeout(r, 10));

  assert.ok(vocalicUpdate, 'vocalicUpdate should be received');
  // Line 0 has Romaji -> Lulu Lulu Lulu... suppressed to empty string!
  assert.strictEqual(vocalicUpdate.lines[0].translation, '', 'Repetitive vocalization with Romaji must be suppressed to empty string');
  // Line 1 has NO Romaji -> collapsed to max 3 words + ellipsis!
  assert.strictEqual(vocalicUpdate.lines[1].translation, 'Olay olay olay...', 'Repetitive vocalization without Romaji should be collapsed');

  console.log('LyricsEnricher tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
