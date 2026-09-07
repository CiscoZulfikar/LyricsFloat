const assert = require('assert');
const { TransliterationService } = require('../services/transliteration');

async function runTests() {
  const service = new TransliterationService();
  await service.init();

  // Test Script Detection
  assert.strictEqual(service.detectScript('君の声を聴かせて'), 'japanese');
  assert.strictEqual(service.detectScript('きみのこえをきかせて'), 'japanese');
  assert.strictEqual(service.detectScript('사랑해요 그대'), 'korean');
  assert.strictEqual(service.detectScript('你好世界'), 'chinese');
  assert.strictEqual(service.detectScript('Hello World! This is a test.'), 'latin');
  assert.strictEqual(service.detectScript('君と I love you so much'), 'japanese');

  // Test Transliteration
  const japaneseRomaji = await service.transliterateLine('君の声を聴かせて', 'japanese');
  console.log('Japanese Romaji output:', japaneseRomaji);
  assert.ok(japaneseRomaji.toLowerCase().includes('kimi') || japaneseRomaji.toLowerCase().includes('koe'), `Expected romaji for Japanese, got: ${japaneseRomaji}`);

  const koreanRomaji = await service.transliterateLine('사랑해요', 'korean');
  console.log('Korean Romanization output:', koreanRomaji);
  assert.ok(koreanRomaji.toLowerCase().includes('sarang'), `Expected romanization for Korean, got: ${koreanRomaji}`);

  const chinesePinyin = await service.transliterateLine('你好', 'chinese');
  console.log('Chinese Pinyin output:', chinesePinyin);
  assert.ok(chinesePinyin.toLowerCase().includes('ni') && chinesePinyin.toLowerCase().includes('hao'), `Expected pinyin for Chinese, got: ${chinesePinyin}`);

  const latinLine = await service.transliterateLine('Hello World', 'latin');
  assert.strictEqual(latinLine, '');

  // Test Batch Lyric Processing
  const sampleLines = [
    { timeMs: 1000, text: '君の声を聴かせて' },
    { timeMs: 3500, text: 'Yeah yeah yeah' }
  ];
  const enriched = await service.transliterateLyrics(sampleLines);
  assert.strictEqual(enriched.length, 2);
  assert.strictEqual(enriched[0].original, '君の声を聴かせて');
  assert.ok(enriched[0].romaji.length > 0);
  assert.strictEqual(enriched[1].original, 'Yeah yeah yeah');

  // Test Japanese Kanji-only line in a Japanese song (e.g. Kenshi Yonezu - KICK BACK)
  const kickBackLines = [
    { timeMs: 1000, text: '努力 未来 a beautiful star' }, // Kanji only + English
    { timeMs: 5000, text: 'ランドリー今日はガラ空きでラッキーデイ' } // Katakana & Hiragana
  ];
  const kickBackTrans = await service.transliterateLyrics(kickBackLines);
  console.log('[KICK BACK Romaji]:', kickBackTrans[0].romaji);
  assert.ok(/doryoku/i.test(kickBackTrans[0].romaji) && /mirai/i.test(kickBackTrans[0].romaji),
    `Kanji-only line in Japanese song must produce Japanese Romaji, got: ${kickBackTrans[0].romaji}`);

  // Test colloquial suffix 〜面 (zura) in Japanese songs (e.g. Vaundy - odoriko)
  const odorikoRomaji = await service.transliterateLine('回り出した あの子と僕が被害者面で', 'japanese');
  console.log('[odoriko Romaji]:', odorikoRomaji);
  assert.ok(/zura\s*de/i.test(odorikoRomaji),
    `Colloquial suffix 被害者面で must produce 'zura de', got: ${odorikoRomaji}`);
  assert.ok(!/men\s*de/i.test(odorikoRomaji),
    `Colloquial suffix 被害者面で must NOT produce 'men de', got: ${odorikoRomaji}`);

  // Test Japanese people counters (一人 = hitori, 二人 = futari) and でして (e.g. Vaundy - odoriko Verse 3)
  const odorikoVerse3Romaji = await service.transliterateLine('(あぁ) 思いを蹴って 二人でしてんだ', 'japanese');
  console.log('[odoriko Verse 3 Romaji]:', odorikoVerse3Romaji);
  assert.ok(/futari/i.test(odorikoVerse3Romaji),
    `二人 must produce 'futari', got: ${odorikoVerse3Romaji}`);
  assert.ok(!/ni\s*nin/i.test(odorikoVerse3Romaji),
    `二人 must NOT produce 'ni nin', got: ${odorikoVerse3Romaji}`);
  assert.ok(!/deshi\s*te/i.test(odorikoVerse3Romaji),
    `でして must NOT tokenize as 'deshi te', got: ${odorikoVerse3Romaji}`);

  const hitoriRomaji = await service.transliterateLine('一人で歩く', 'japanese');
  console.log('[hitori Romaji]:', hitoriRomaji);
  assert.ok(/hitori/i.test(hitoriRomaji), `一人 must produce 'hitori', got: ${hitoriRomaji}`);
  assert.ok(!/ichi\s*nin/i.test(hitoriRomaji), `一人 must NOT produce 'ichi nin', got: ${hitoriRomaji}`);

  console.log('TransliterationService tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
