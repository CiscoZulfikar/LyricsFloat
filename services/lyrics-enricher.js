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

const VOCALIC_TOKENS = new Set([
  'lu', 'lulu', 'lululu',
  'ru', 'ruru', 'rururu',
  'la', 'lala', 'lalala',
  'na', 'nana', 'nanana',
  'da', 'dada', 'dadada',
  'ba', 'baba', 'bababa',
  'oh', 'ooh', 'oo', 'whoa', 'woah',
  'ah', 'aah', 'ha', 'haha',
  'yeah', 'yea', 'yep',
  'doo', 'du', 'dum', 'dududu',
  'pa', 'ra', 'ta', 'uh', 'mm', 'mmm', 'hmm',
  'tra', 'trala', 'tralala'
]);

function isRepetitiveVocalization(text) {
  if (!text) return false;
  const words = text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 3) return false;

  const uniqueWords = new Set(words);
  if (uniqueWords.size === 1) {
    const singleWord = words[0];
    if (VOCALIC_TOKENS.has(singleWord) || singleWord.length <= 4) {
      return true;
    }
  }

  if (uniqueWords.size <= 2 && words.length >= 4) {
    const allVocalic = Array.from(uniqueWords).every(w => VOCALIC_TOKENS.has(w) || w.length <= 3);
    if (allVocalic) return true;
  }

  return false;
}

function isPhoneticallyIdenticalToRomaji(romaji, translation) {
  if (!romaji || !translation) return false;
  const norm = (s) => (s || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .replace(/[rl]/g, 'r'); // Equate Japanese/Korean r & l liquid consonants
  return norm(romaji) === norm(translation);
}

function isRepetitiveOriginal(orig) {
  if (!orig) return false;
  const clean = (orig || '').replace(/[\s\p{P}\p{S}]/gu, '');
  if (clean.length >= 3) {
    const chars = Array.from(clean);
    const first = chars[0];
    if (chars.every(c => c === first)) return true;
  }
  return false;
}

function collapseRepetition(text) {
  if (!text) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return text;

  const firstWordNorm = words[0].toLowerCase().replace(/[\p{P}\p{S}]/gu, '');
  const allSame = words.every(w => w.toLowerCase().replace(/[\p{P}\p{S}]/gu, '') === firstWordNorm);
  if (allSame) {
    return `${words[0]} ${words[1]} ${words[2]}...`;
  }
  return text;
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

    const FOREIGN_LATIN_MARKERS = /\b(de|la|el|en|es|que|un|una|por|con|para|como|tu|su|sin|más|mas|estoy|otra|vez|amor|siento|je|tu|il|elle|nous|vous|ils|elles|et|est|le|les|des|une|dans|pour|alors|danse|pas|qui|mais|avec|tout|sur|und|der|die|das|ich|nicht|ein|eine|mich|dich|hab|nicht|di|ke|yang|ini|itu|dan|dari|aku|kamu|kita|bisa|ada|tidak|sono|sei|della|dello|gli|per|olha|coisa|linda|cheia|graça)\b/i;
    const FOREIGN_ACCENTS = /[\u00C0-\u024F\u00A1\u00BF]/;

    const DISTINCT_ENGLISH_WORDS = new Set([
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'from',
      'they', 'say', 'her', 'she', 'will', 'one', 'all', 'would', 'there', 'their', 'what',
      'out', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
      'just', 'him', 'know', 'take', 'person', 'into', 'year', 'your', 'good', 'some', 'could',
      'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
      'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
      'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'wanna', 'gonna', 'gotta',
      'cant', 'dont', 'wont', 'ive', 'im', 'youre', 'theyre', 'hes', 'shes', 'aint', 'baby', 'love',
      'lately', 'help', 'roads', 'phases', 'speechless', 'complicate', 'rhythm', 'aimless', 'painless'
    ]);

    function isSongPurelyEnglish(lines) {
      if (!Array.isArray(lines) || lines.length === 0) return true;

      let englishLineCount = 0;
      let totalMeaningfulLines = 0;

      for (const line of lines) {
        const text = (line.text || line.original || '').trim();
        if (!text || text.length < 2 || /^[\p{P}\s♪~]+$/u.test(text)) continue;
        totalMeaningfulLines++;

        // If any line has foreign accented characters or non-English Latin stop words, it's NOT purely English
        if (FOREIGN_ACCENTS.test(text) || FOREIGN_LATIN_MARKERS.test(text)) {
          return false;
        }

        const words = text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
        const hasEnglishWord = words.some(w => DISTINCT_ENGLISH_WORDS.has(w));
        if (hasEnglishWord) {
          englishLineCount++;
        }
      }

      if (totalMeaningfulLines === 0) return true;
      return (englishLineCount / totalMeaningfulLines) >= 0.35;
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
    const transliteratedLines = await this.transliterationService.transliterateLyrics(rawLyrics.lines, detectedScript);

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
                const romaji = (initialLines[idx].romaji || '').trim();
                const hasRomaji = Boolean(romaji && romaji !== origText);

                // Check vocalization suppression & repetition collapsing
                if (hasRomaji && (
                  isRepetitiveOriginal(origText) ||
                  isRepetitiveVocalization(cleanTranslation) ||
                  isPhoneticallyIdenticalToRomaji(romaji, cleanTranslation)
                )) {
                  initialLines[idx].translation = '';
                  t.translation = '';
                } else {
                  const collapsed = collapseRepetition(cleanTranslation);
                  initialLines[idx].translation = collapsed;
                  t.translation = collapsed;
                }
              }
            }
          });
        }
        if (typeof onTranslationReady === 'function') {
          onTranslationReady({
            trackKey,
            isTranslating: false,
            lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: l.translation }))
          });
        }
      }).catch(err => {
        console.error('Async translation error:', err);
        if (typeof onTranslationReady === 'function') {
          onTranslationReady({
            trackKey,
            isTranslating: false,
            lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: '' }))
          });
        }
      });
    } else if (typeof onTranslationReady === 'function') {
      setTimeout(() => {
        onTranslationReady({
          trackKey,
          isTranslating: false,
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
      isTranslating: shouldTranslate,
      targetLang,
      provider: rawLyrics.provider || { name: 'LRCLIB', url: 'https://lrclib.net' },
      lines: initialLines
    };
  }
}

module.exports = {
  LyricsEnricher,
  isRepetitiveVocalization,
  isPhoneticallyIdenticalToRomaji,
  isRepetitiveOriginal,
  collapseRepetition
};
