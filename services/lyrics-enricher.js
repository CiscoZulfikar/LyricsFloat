const { TransliterationService } = require('./transliteration');
const { TranslationService } = require('./translation');

const DEFAULT_TRANSLATE_LANGS = [
  'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
];

class LyricsEnricher {
  constructor(cacheDir = null) {
    this.transliterationService = new TransliterationService();
    this.translationService = new TranslationService(cacheDir);
  }

  async init() {
    await this.transliterationService.init();
  }

  async enrichLyrics(title, artist, rawLyrics, targetLang = 'en', onTranslationReady = null, enabledLanguages = DEFAULT_TRANSLATE_LANGS) {
    if (!rawLyrics || !Array.isArray(rawLyrics.lines) || rawLyrics.lines.length === 0) {
      return null;
    }

    const activeEnabledLangs = Array.isArray(enabledLanguages) ? enabledLanguages : DEFAULT_TRANSLATE_LANGS;
    const trackKey = `${(title || '').trim()}___${(artist || '').trim()}`;
    const sampleText = rawLyrics.lines.slice(0, 15).map(l => l.text || l.original || '').join(' ');
    const detectedScript = this.transliterationService.detectScript(sampleText);
    const hasNonLatinLines = rawLyrics.lines.some(l => this.transliterationService.detectScript(l.text || l.original || '') !== 'latin');
    const isForeign = hasNonLatinLines || detectedScript !== 'latin';

    const SCRIPT_TO_LANG = {
      japanese: 'ja',
      korean: 'ko',
      chinese: 'zh',
      cyrillic: 'ru',
      greek: 'el',
      arabic: 'ar',
      devanagari: 'hi'
    };

    function isLikelyEnglish(text) {
      if (!text) return false;
      const englishWords = /\b(the|and|you|that|was|for|are|with|his|they|this|have|from|one|had|word|but|not|what|all|were|when|your|can|said|there|each|which|she|how|their|will|my|me|we|our|us)\b/gi;
      const matches = text.match(englishWords);
      return Boolean(matches && matches.length >= 3);
    }

    let shouldTranslate = isForeign;
    if (isForeign) {
      const scriptLang = SCRIPT_TO_LANG[detectedScript];
      if (scriptLang && !activeEnabledLangs.includes(scriptLang)) {
        shouldTranslate = false;
      }
    } else {
      // For Latin script songs:
      // If target language is English and the song is already English, do not translate!
      const isEnglishSong = targetLang.toLowerCase() === 'en' && isLikelyEnglish(sampleText);
      if (isEnglishSong) {
        shouldTranslate = false;
      } else {
        // Foreign Latin songs (Spanish, French, German, Portuguese, Italian, Indonesian)
        const anyLatinEnabled = ['es', 'fr', 'de', 'pt', 'it', 'id'].some(l => activeEnabledLangs.includes(l));
        shouldTranslate = anyLatinEnabled;
      }
    }

    // Step 1: Fast Transliteration (<15ms)
    const transliteratedLines = await this.transliterationService.transliterateLyrics(rawLyrics.lines);

    const initialLines = transliteratedLines.map(l => ({
      timeMs: l.timeMs,
      original: l.original,
      romaji: l.romaji,
      translation: ''
    }));

    // Step 2: Asynchronous Translation
    if (shouldTranslate) {
      this.translationService.translateLyrics({
        trackKey,
        lines: rawLyrics.lines,
        targetLang
      }).then(translatedLines => {
        if (Array.isArray(translatedLines)) {
          const globalDetectedLang = (translatedLines.detectedLang || '').toLowerCase();

          // If the song is already in the target language (e.g. English -> English), never show duplicate translations!
          if (globalDetectedLang && (globalDetectedLang === targetLang.toLowerCase() || (targetLang === 'en' && globalDetectedLang === 'en'))) {
            initialLines.forEach(l => { l.translation = ''; });
            if (typeof onTranslationReady === 'function') {
              onTranslationReady({
                trackKey,
                lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: '' }))
              });
            }
            return;
          }

          translatedLines.forEach((t, idx) => {
            if (initialLines[idx]) {
              const origText = (initialLines[idx].original || '').trim();
              const cleanTranslation = (t.translation || '').trim();

              const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
              const isSame = norm(cleanTranslation) === norm(origText);

              const lineDetected = (t.detectedLang || globalDetectedLang || '').toLowerCase();
              let isLangPermitted = false;
              if (Array.isArray(activeEnabledLangs) && lineDetected) {
                isLangPermitted = activeEnabledLangs.some(l => {
                  if (l === 'id' && (lineDetected === 'id' || lineDetected === 'ms')) return true;
                  return lineDetected === l || lineDetected.startsWith(l + '-');
                });
              } else if (!lineDetected) {
                isLangPermitted = !isSame;
              }

              if (isSame || !cleanTranslation || !isLangPermitted || lineDetected === targetLang.toLowerCase()) {
                initialLines[idx].translation = '';
                t.translation = '';
              } else {
                initialLines[idx].translation = cleanTranslation;
              }
            }
          });
        }
        if (typeof onTranslationReady === 'function') {
          onTranslationReady({
            trackKey,
            lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: l.translation }))
          });
        }
      }).catch(err => {
        console.error('Async translation error:', err);
      });
    }



    return {
      trackKey,
      title,
      artist,
      album: rawLyrics.album || '',
      synced: rawLyrics.synced,
      isForeign,
      detectedScript,

      provider: rawLyrics.provider || { name: 'LRCLIB', url: 'https://lrclib.net' },
      lines: initialLines
    };

  }
}

module.exports = { LyricsEnricher };
