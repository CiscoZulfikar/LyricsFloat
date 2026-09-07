const { TransliterationService, normalizeHomoglyphs } = require('./transliteration');
const { TranslationService } = require('./translation');

const DEFAULT_TRANSLATE_LANGS = [
  'en', 'ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'
];

function isSameLanguage(lang1, lang2) {
  if (!lang1 || !lang2) return false;
  const l1 = lang1.toLowerCase().trim();
  const l2 = lang2.toLowerCase().trim();
  if (l1 === l2) return true;
  if (l1.startsWith(l2 + '-') || l2.startsWith(l1 + '-')) return true;
  // Indonesian & Malay mutual detection
  if ((l1 === 'id' || l1 === 'ms') && (l2 === 'id' || l2 === 'ms')) return true;
  return false;
}

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

    // Sanitize confusable homoglyphs on all incoming lines
    rawLyrics.lines.forEach(l => {
      if (l.text) l.text = normalizeHomoglyphs(l.text);
      if (l.original) l.original = normalizeHomoglyphs(l.original);
    });

    const activeEnabledLangs = Array.isArray(enabledLanguages) ? enabledLanguages : DEFAULT_TRANSLATE_LANGS;
    const trackKey = `${(title || '').trim()}___${(artist || '').trim()}`;
    const allText = rawLyrics.lines.map(l => l.text || l.original || '').join(' ');
    const detectedScript = this.transliterationService.detectScript(allText);
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

    function isSongPurelyEnglish(lines) {
      if (!Array.isArray(lines) || lines.length === 0) return true;
      const englishWords = /\b(the|and|you|that|was|for|are|with|his|they|this|have|from|what|were|when|your|there|which|how|their|will)\b/i;
      const foreignChars = /[\u00C0-\u024F\u00A1\u00BF]/; // Accented Latin characters, ¿, ¡

      for (const line of lines) {
        const text = (line.text || line.original || '').trim();
        if (!text || text.length < 3 || /^[\p{P}\s♪~]+$/u.test(text)) continue;

        if (foreignChars.test(text)) {
          return false;
        }

        const words = text.split(/\s+/);
        if (words.length >= 1 && !englishWords.test(text)) {
          const vocalizations = /^(la|na|da|oh|ah|ooh|yeah|whoa|mmm|hmm|ha|doo|di|dum|ba)+$/i;
          const isVocal = words.every(w => vocalizations.test(w.replace(/[\p{P}\p{S}]/gu, '')));
          if (!isVocal) {
            return false;
          }
        }
      }

      return true;
    }

    let shouldTranslate = true;
    if (isForeign) {
      const scriptLang = SCRIPT_TO_LANG[detectedScript];
      if (scriptLang && !activeEnabledLangs.includes(scriptLang)) {
        shouldTranslate = false;
      }
    } else {
      // Latin script songs
      const anyLatinEnabled = ['en', 'es', 'fr', 'de', 'pt', 'it', 'id'].some(l => activeEnabledLangs.includes(l));
      if (!anyLatinEnabled) {
        shouldTranslate = false;
      } else if (targetLang.toLowerCase() === 'en' && isSongPurelyEnglish(rawLyrics.lines)) {
        shouldTranslate = false;
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
          translatedLines.forEach((t, idx) => {
            if (initialLines[idx]) {
              const origText = (initialLines[idx].original || '').trim();
              const cleanTranslation = (t.translation || '').trim();

              const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
              const isSame = norm(cleanTranslation) === norm(origText);

              const lineDetected = (t.detectedLang || '').toLowerCase();
              const isTargetLanguage = isSameLanguage(lineDetected, targetLang);

              let isLangPermitted = false;
              if (Array.isArray(activeEnabledLangs) && lineDetected) {
                isLangPermitted = activeEnabledLangs.some(l => {
                  if (l === 'id' && (lineDetected === 'id' || lineDetected === 'ms')) return true;
                  return lineDetected === l || lineDetected.startsWith(l + '-');
                });
              } else if (!lineDetected) {
                isLangPermitted = !isSame;
              }

              // Suppress duplicate, empty, disabled, or target-language lines
              if (isSame || !cleanTranslation || !isLangPermitted || (isTargetLanguage && !t.isPartiallyForeign)) {
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
    } else if (typeof onTranslationReady === 'function') {
      setTimeout(() => {
        onTranslationReady({
          trackKey,
          lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: '' }))
        });
      }, 0);
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
