const assert = require('assert');
const { TransliterationService, normalizeHomoglyphs } = require('../services/transliteration');

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

  // Test Buddhist/literary idioms and Kanji leakage prevention (e.g. Eve - Kaikai Kitan)
  const kaikaiLineRomaji = await service.transliterateLine('怨親平等に没個性', 'japanese');
  console.log('[Kaikai Kitan line Romaji]:', kaikaiLineRomaji);
  assert.ok(/onshin\s+by[oō]d[oō]\s+ni\s+botsu\s+kosei/i.test(kaikaiLineRomaji),
    `怨親平等に没個性 must produce 'onshin byōdō ni botsu kosei', got: ${kaikaiLineRomaji}`);
  assert.ok(!/[\u4E00-\u9FAF]/.test(kaikaiLineRomaji),
    `Romaji output must not leak raw kanji characters, got: ${kaikaiLineRomaji}`);
  assert.ok(!/oya/i.test(kaikaiLineRomaji),
    `怨親 must not misparse as 'oya' (parent), got: ${kaikaiLineRomaji}`);

  // Test J-Pop / anime lyric nuances (e.g. King Gnu - SPECIALZ)
  const kiwakiwa = await service.transliterateLine('今際の際際で踊りましょう', 'japanese');
  console.log('[SPECIALZ kiwakiwa]:', kiwakiwa);
  assert.ok(/kiwakiwa/i.test(kiwakiwa), `際際 must produce 'kiwakiwa', got: ${kiwakiwa}`);
  assert.ok(!/sai\s*sai/i.test(kiwakiwa), `際際 must NOT produce 'sai sai', got: ${kiwakiwa}`);

  const miyako = await service.transliterateLine('東京前線興の都', 'japanese');
  console.log('[SPECIALZ miyako]:', miyako);
  assert.ok(/miyako/i.test(miyako), `興の都 must produce 'miyako', got: ${miyako}`);

  const tsura = await service.transliterateLine('お行儀の悪い面も見せてよ', 'japanese');
  console.log('[SPECIALZ tsura]:', tsura);
  assert.ok(/tsura/i.test(tsura), `悪い面 must produce 'tsura', got: ${tsura}`);

  const donna = await service.transliterateLine('如何痴れ者も如何余所者も', 'japanese');
  console.log('[SPECIALZ donna]:', donna);
  assert.ok(/donna\s+shiremono\s+mo\s+donna\s+yosomono/i.test(donna), `如何 must produce 'donna', got: ${donna}`);

  const kaiyu = await service.transliterateLine('一生迷宮廻遊ランデブー', 'japanese');
  console.log('[SPECIALZ kaiyu]:', kaiyu);
  assert.ok(/kaiyuu/i.test(kaiyu), `廻遊 must produce 'kaiyuu', got: ${kaiyu}`);

  const mama = await service.transliterateLine('有耶無耶な儘廻る世界', 'japanese');
  console.log('[SPECIALZ mama]:', mama);
  assert.ok(/mama\s+mawaru/i.test(mama), `儘廻る must produce 'mama mawaru', got: ${mama}`);

  const giragira = await service.transliterateLine('報道機関氣裸氣裸血走ります', 'japanese');
  console.log('[SPECIALZ giragira]:', giragira);
  assert.ok(/giragira/i.test(giragira), `氣裸氣裸 must produce 'giragira', got: ${giragira}`);

  // Test Greek homoglyph normalization and duplicate transliteration suppression
  const greekLine = 'Everybody want the key and the secret to rap immortality like \u0399 have got';
  const transliterated = await service.transliterateLyrics([{ timeMs: 1000, text: greekLine }]);
  assert.strictEqual(transliterated[0].romaji, '', 'English line with Greek Iota homoglyph must not generate duplicate Romaji');
  assert.strictEqual(service.detectScript(normalizeHomoglyphs(greekLine)), 'latin', 'Normalized Greek homoglyphs must be detected as Latin');

  console.log('TransliterationService tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
