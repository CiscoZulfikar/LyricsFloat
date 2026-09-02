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

}

runTest();
