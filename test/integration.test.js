const assert = require('assert');
const { LyricsService } = require('../services/lyrics-service');
const { LyricsEnricher } = require('../services/lyrics-enricher');
const { ConfigStore } = require('../services/config-store');
const path = require('path');
const fs = require('fs');

async function runIntegration() {
  const testCacheDir = path.join(__dirname, 'test-int-cache-temp');
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

  // 3. Test accurate English track fetch (prevent CJK remix/translation hijacking)
  const jvkeLyrics = await lyricsService.fetchLyrics({
    title: 'this is what falling in love feels like',
    artist: 'JVKE',
    durationSec: 120
  });
  if (jvkeLyrics) {
    assert.ok(jvkeLyrics && jvkeLyrics.synced, 'JVKE lyrics should be synced');
    const allJvkeText = jvkeLyrics.lines.map(l => l.text).join(' ');
    const hasCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(allJvkeText);
    assert.strictEqual(hasCJK, false, 'JVKE lyrics should NOT contain CJK/Mandarin translation text');
    assert.ok(allJvkeText.includes('Feel like sun on my skin'), 'JVKE lyrics should contain original English text');
  } else {
    console.warn('⚠️ LRCLIB API returned no data (upstream 502/network timeout), skipping live network assertions for JVKE');
  }

  // 4. Test Multi-Pass and Interleaved bilingual LRC deduplication
  const multiPassLrc = `[00:00.87]無敵の笑顔で荒らすメディア
[00:03.78]知りたいその秘密ミステリアス
[00:06.33]抜けてるとこさえ彼女のエリア
[03:20.00]終わりの歌詞
[00:00.87]Muteki no egao de arasu media
[00:03.78]Shiritai sono himitsu misuteriasu
[00:06.33]Nuketeru toko sae kanojo no eria
[03:20.00]Owari no kashi`;

  const parsedMultiPass = lyricsService.parseLrc(multiPassLrc, 'アイドル', 'YOASOBI');
  const textLines = parsedMultiPass.filter(l => !l.isBreak);
  assert.strictEqual(textLines.length, 4, 'Multi-pass CJK LRC should discard appended Romaji pass');
  assert.strictEqual(textLines[0].text, '無敵の笑顔で荒らすメディア');
  assert.strictEqual(textLines[2].text, '抜けてるとこさえ彼女のエリア');
  assert.ok(parsedMultiPass.some(l => l.isBreak), 'Long 3-minute gap should have instrumental break');

  const interleavedLrc = `[00:01.00]無敵の笑顔で荒らすメディア
[00:01.00]Muteki no egao de arasu media
[00:04.00]Shiritai sono himitsu misuteriasu
[00:04.00]知りたいその秘密ミステリアス
[00:07.00](Saving grace)
[00:07.00](Saving grace)`;

  const parsedInterleaved = lyricsService.parseLrc(interleavedLrc, 'アイドル', 'YOASOBI');
  assert.strictEqual(parsedInterleaved.length, 3, 'Interleaved bilingual LRC should keep CJK lines and deduplicate exact text');
  assert.strictEqual(parsedInterleaved[0].text, '無敵の笑顔で荒らすメディア');
  assert.strictEqual(parsedInterleaved[1].text, '知りたいその秘密ミステリアス');
  assert.strictEqual(parsedInterleaved[2].text, '(Saving grace)');

  // 5. Test ConfigStore
  const config = new ConfigStore(path.join(testCacheDir, 'test-config.json'));
  assert.strictEqual(config.get('showRomaji'), true);
  config.set('targetLanguage', 'id');
  assert.strictEqual(config.get('targetLanguage'), 'id');

  // 6. Test Romanized Japanese song fetches native CJK lyrics instead of Romaji upload
  const akumaLyrics = await lyricsService.fetchLyrics({
    title: 'Akuma no Ko',
    artist: 'Ai Higuchi',
    album: 'Akuma no Ko',
    durationSec: 228
  });
  if (akumaLyrics) {
    assert.ok(akumaLyrics && akumaLyrics.synced, 'Akuma no Ko lyrics should be synced');
    const akumaText = akumaLyrics.lines.map(l => l.text).join(' ');
    const akumaHasCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(akumaText);
    assert.strictEqual(akumaHasCJK, true, 'Akuma no Ko should fetch native Japanese kanji/kana lyrics instead of Romaji upload');
    assert.ok(akumaLyrics.lines[0].timeMs < 2000, 'Akuma no Ko should select accurately synced opening line (~0.9s), not delayed version');
    assert.ok(akumaLyrics.provider.url.includes('34725169'), 'Akuma no Ko should select best track 34725169');
  } else {
    console.warn('⚠️ LRCLIB API returned no data (upstream 502/network timeout), skipping live network assertions for Akuma no Ko');
  }

  // Clean up
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  console.log('All end-to-end integration tests passed!');
}

runIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
