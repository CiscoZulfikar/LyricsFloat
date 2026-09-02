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

  const enriched = await enricher.enrichLyrics('Song A', 'Artist B', sampleRawLyrics, 'en');
  assert.strictEqual(enriched.lines[0].original, '君の声を聴かせて');
  assert.strictEqual(enriched.lines[0].romaji, 'kimi no koe');
  assert.strictEqual(enriched.isForeign, true);

  console.log('LyricsEnricher tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
