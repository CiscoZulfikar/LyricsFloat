const assert = require('assert');
const { LyricsEnricher } = require('../services/lyrics-enricher');

async function runTest() {
  const enricher = new LyricsEnricher();
  await enricher.init();

  const testCases = [
    { title: 'Alors on danse', artist: 'Stromae', lines: [{ text: 'Alors on danse' }] },
    { title: 'Despacito', artist: 'Luis Fonsi', lines: [{ text: 'Despacito, quiero respirar tu cuello despacito' }] },
    { title: 'Du hast', artist: 'Rammstein', lines: [{ text: 'Du hast mich gefragt und ich hab nichts gesagt' }] },
    { title: 'Garota de Ipanema', artist: 'Tom Jobim', lines: [{ text: 'Olha que coisa mais linda' }] },
    { title: 'Hati-Hati di Jalan', artist: 'Tulus', lines: [{ text: 'Kukira kita akan bersama' }] },
    { title: 'Adore You', artist: 'Harry Styles', lines: [{ text: 'Walk in your rainbow paradise' }] }
  ];

  const enabledLangs = ['fr', 'es', 'de', 'pt', 'id'];

  for (const tc of testCases) {
    await new Promise(resolve => {
      enricher.enrichLyrics(tc.title, tc.artist, { lines: tc.lines }, 'en', (update) => {
        console.log(`[${tc.title}] "${tc.lines[0].text}" -> Translation: "${update.lines[0].translation}"`);
        resolve();
      }, enabledLangs);
    });
  }


  // Verify that if German ('de') is disabled in the checklist, its translation is suppressed
  const withoutGerman = ['fr', 'es'];
  await new Promise(resolve => {
    enricher.enrichLyrics('Du hast', 'Rammstein', { lines: [{ text: 'Du hast mich gefragt' }] }, 'en', (update) => {
      const germanTranslation = update.lines[0].translation;
      console.log('German with de disabled -> Translation: "' + germanTranslation + '" (expected empty)');
      if (germanTranslation === '') {
        console.log('Checklist language suppression test passed!');
      }
      resolve();
    }, withoutGerman);
  });

  // Verify English song translated to Indonesian ('id')
  const englishSong = { title: 'Lay Me Down', artist: 'Sam Smith', lines: [{ text: 'That one day I will be where I was' }] };
  await new Promise(resolve => {
    enricher.enrichLyrics(englishSong.title, englishSong.artist, { lines: englishSong.lines }, 'id', (update) => {
      const idTranslation = update.lines[0].translation;
      console.log(`[Lay Me Down] English -> Indonesian: "${idTranslation}"`);
      assert.ok(idTranslation && idTranslation.length > 0, 'English song should be translated to Indonesian');
      resolve();
    }, ['en', 'id']);
  });

  // Verify Indonesian song with targetLang='id' suppresses duplicate translation
  const indonesianSong = { title: 'Hati-Hati di Jalan', artist: 'Tulus', lines: [{ text: 'Kukira kita akan bersama' }] };
  await new Promise(resolve => {
    enricher.enrichLyrics(indonesianSong.title, indonesianSong.artist, { lines: indonesianSong.lines }, 'id', (update) => {
      const idTranslation = update.lines[0].translation;
      console.log(`[Hati-Hati di Jalan] Indonesian -> Indonesian: "${idTranslation}" (expected empty)`);
      assert.strictEqual(idTranslation, '', 'Indonesian song should not be translated when targetLang is id');
      resolve();
    }, ['en', 'id']);
  });

  // Verify English song translated to Indonesian ('id') with DEFAULT enabledLanguages
  await new Promise(resolve => {
    enricher.enrichLyrics(englishSong.title, englishSong.artist, { lines: englishSong.lines }, 'id', (update) => {
      const idTranslationDefault = update.lines[0].translation;
      console.log(`[Lay Me Down (Default langs)] English -> Indonesian: "${idTranslationDefault}"`);
      assert.ok(idTranslationDefault && idTranslationDefault.length > 0, 'English song should be translated to Indonesian with default enabledLanguages');
      resolve();
    });
  });

  // Verify Bilingual Song (Spanish + English, parenthetical vocals, Cyrillic homoglyphs)
  const bilingualSong = {
    title: 'Nobody New',
    artist: 'The Marías',
    lines: [
      { timeMs: 1000, text: 'Baby, I promise' },
      { timeMs: 2000, text: 'Nadie como tú (We cried together when we said our goodbyes)' },
      { timeMs: 3000, text: 'Therе\'s no one like you (Down by the watеr where we used to get lost)' }, // Cyrillic \u0435
      { timeMs: 4000, text: 'Aquí estoy otra vez sin tu amor' }
    ]
  };

  await new Promise(resolve => {
    enricher.enrichLyrics(bilingualSong.title, bilingualSong.artist, { lines: bilingualSong.lines }, 'en', (update) => {
      const line0Trans = update.lines[0].translation;
      const line1Trans = update.lines[1].translation;
      const line2Trans = update.lines[2].translation;
      const line3Trans = update.lines[3].translation;

      console.log(`[Nobody New] Line 0 (English): "${line0Trans}" (expected empty)`);
      console.log(`[Nobody New] Line 1 (Spanish + English): "${line1Trans}"`);
      console.log(`[Nobody New] Line 2 (English with homoglyphs): "${line2Trans}" (expected empty)`);
      console.log(`[Nobody New] Line 3 (Spanish verse): "${line3Trans}"`);

      assert.strictEqual(line0Trans, '', 'English line 0 should be suppressed');
      assert.ok(line1Trans && /nobody|no one/i.test(line1Trans), 'Spanish parenthetical line 1 should translate Nadie como tú');
      assert.strictEqual(line2Trans, '', 'English line 2 with Cyrillic homoglyphs must be suppressed without duplicates');
      assert.ok(line3Trans && line3Trans.length > 0 && /here|without/i.test(line3Trans), 'Spanish line 3 should be translated');

      console.log('Bilingual parenthetical and homoglyph tests passed!');
      resolve();
    });
  });

  // Verify Bilingual Portuguese + English Song (São Paulo by The Weeknd feat. Anitta)
  const saoPauloSong = {
    title: 'São Paulo (feat. Anitta)',
    artist: 'The Weeknd',
    lines: [
      { timeMs: 1000, text: 'Bota na boca, bota na cara, bota onde quiser' },
      { timeMs: 2000, text: 'Bota na boca, bota na cara, bota na boca, bota na cara' },
      { timeMs: 3000, text: 'O novinho me olhou e quis comer minha pepequinha' },
      { timeMs: 4000, text: 'Hoje eu vou dar pro novinho, fode, fode a Larissinha' },
      { timeMs: 5000, text: 'Every time I try to run, you put your curse all over me' }
    ]
  };

  await new Promise(resolve => {
    enricher.enrichLyrics(saoPauloSong.title, saoPauloSong.artist, { lines: saoPauloSong.lines }, 'en', (update) => {
      const line0Trans = update.lines[0].translation;
      const line1Trans = update.lines[1].translation;
      const line2Trans = update.lines[2].translation;
      const line3Trans = update.lines[3].translation;
      const line4Trans = update.lines[4].translation;

      console.log(`[São Paulo] Line 0 (Bota onde quiser): "${line0Trans}"`);
      console.log(`[São Paulo] Line 1 (Bota repetido): "${line1Trans}"`);
      console.log(`[São Paulo] Line 2 (Portuguese): "${line2Trans}"`);
      console.log(`[São Paulo] Line 3 (Portuguese): "${line3Trans}"`);
      console.log(`[São Paulo] Line 4 (English): "${line4Trans}" (expected empty)`);

      assert.ok(line0Trans && /mouth|face/i.test(line0Trans), 'Line 0 must translate bota as put/stick');
      assert.ok(line1Trans && /mouth|face/i.test(line1Trans), 'Line 1 must translate repetitive bota lines');
      assert.ok(line2Trans && /pussy/i.test(line2Trans), 'Portuguese line 2 must translate pepequinha as pussy');
      assert.ok(line3Trans && /pussy/i.test(line3Trans), 'Portuguese line 3 must translate Larissinha as pussy');
      assert.strictEqual(line4Trans, '', 'English line 4 must be suppressed without duplicate translation');

      console.log('Bilingual Portuguese + English test passed!');
      resolve();
    });
  });

  // Test Japanese Katakana chanting / vocalization suppression (e.g. "ル・ル・ルルルルル・ルルル・ルルルルルル")
  await new Promise((resolve) => {
    const jpVocalicLyrics = {
      synced: true,
      lines: [
        { timeMs: 0, text: 'ル・ル・ルルルルル・ルルル・ルルルルルル' }
      ]
    };
    enricher.enrichLyrics('J-Chant', 'Artist J', jpVocalicLyrics, 'en', (update) => {
      const trans = update.lines[0].translation;
      console.log('[Japanese Chant]', jpVocalicLyrics.lines[0].text, '-> Translation:', JSON.stringify(trans));
      assert.strictEqual(trans, '', 'Japanese chanting with Romaji should suppress translation');
      console.log('Japanese vocalization suppression test passed!');
      resolve();
    });
  });

  // Test purely English song (Like You Do by Joji) -> isTranslating must be false
  const jojiLyrics = {
    synced: true,
    lines: [
      { timeMs: 14320, text: "Lately, I can't help but think" },
      { timeMs: 19250, text: "That our roads might take us down different phases" },
      { timeMs: 24930, text: "Don't wanna complicate the rhythm that we've got" }
    ]
  };
  const jojiRes = await enricher.enrichLyrics('Like You Do', 'Joji', jojiLyrics, 'en');
  console.log('[Like You Do] isTranslating:', jojiRes.isTranslating, '(expected false)');
  assert.strictEqual(jojiRes.isTranslating, false, 'Purely English song with en target must set isTranslating to false');

  // Test English song with ambiguous tokens like "die", "sin", "la" (Curl up & Die) -> isTranslating must be false
  const curlUpDieLyrics = {
    synced: true,
    lines: [
      { timeMs: 1000, text: "When I worshipped the ground you walked on" },
      { timeMs: 5000, text: "When I'd cut off my ear for you" },
      { timeMs: 10000, text: "Curl up and die" },
      { timeMs: 15000, text: "Curl up and die" }
    ]
  };
  const curlRes = await enricher.enrichLyrics('Curl up & Die', 'Matt Maltese', curlUpDieLyrics, 'en');
  console.log('[Curl up & Die] isTranslating:', curlRes.isTranslating, '(expected false)');
  assert.strictEqual(curlRes.isTranslating, false, 'English song with word "die" must set isTranslating to false');

  // Test mixed-script line (CJK + English, e.g. Otonoke by Creepy Nuts)
  await new Promise((resolve) => {
    const otonokeLyrics = {
      synced: true,
      lines: [
        { timeMs: 28670, text: '四尺四寸四分様がカミナッチャ bang around, hey' }
      ]
    };
    enricher.enrichLyrics('Otonoke Test', 'Creepy Nuts', otonokeLyrics, 'en', (update) => {
      const trans = update.lines[0].translation;
      console.log('[Otonoke Mixed Line]', otonokeLyrics.lines[0].text, '-> Translation:', JSON.stringify(trans));
      assert.ok(trans && trans.includes('bang around'), 'Translation must retain English part');
      assert.ok(trans && !/^bang around, hey$/i.test(trans), 'Translation must not swallow the Japanese folklore entity');
      assert.ok(trans && (trans.includes('shaku') || trans.includes('coming at ya') || trans.includes('Kaminaccha') || trans.includes('4')), 'Translation must include translated Japanese segment');
      console.log('Mixed-script translation recovery test passed!');
      resolve();
    });
  });

  console.log('All multi-language tests passed successfully!');
}

runTest().catch(err => {
  console.error('Multi-language test failed:', err);
  process.exit(1);
});
