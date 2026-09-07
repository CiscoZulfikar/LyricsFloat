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

  console.log('All multi-language tests passed successfully!');
}

runTest().catch(err => {
  console.error('Multi-language test failed:', err);
  process.exit(1);
});
