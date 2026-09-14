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

function isVocalicOrRepetitive(text) {
  if (!text) return false;
  const words = text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  return words.every(w => VOCALIC_TOKENS.has(w) || /^(la|na|da|oh|ah|ooh|yeah|whoa|mmm|hmm|ha|doo|di|dum|ba|lu|ru)+$/i.test(w));
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
    const trackKey = `${(title || '').trim().normalize('NFC').toLowerCase()}___${(artist || '').trim().normalize('NFC').toLowerCase()}`;
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

    const UNAMBIGUOUS_FOREIGN_MARKERS = /\b(estoy|estás|está|estamos|están|otra|vez|siento|quiero|tengo|tienes|tiene|somos|nadie|cuando|tiempo|siempre|corazón|noche|nada|vida|aqui|aquí|haga|puedo|puedes|puede|tenerte|olvidarme|respirar|cuesta|entonces|despacito|cuello|deja|diga|cosas|oído|alors|danse|chante|travail|thunes|nous|vous|ils|elles|dans|pour|avec|cette|aussi|faire|suis|sommes|sont|monde|toujours|rien|jamais|und|der|das|dem|den|des|ich|nicht|nichts|einer|einem|einen|eines|mich|dich|sich|hab|habe|hast|hat|haben|hatte|hatten|wir|ihr|bist|seid|sind|war|waren|gefragt|gesagt|immer|wieder|wenn|aber|durch|ohne|zwischen|olha|olhou|olhar|coisa|linda|cheia|graça|você|vocês|não|muito|tudo|fazer|faço|faz|fez|kukira|bersama|jalan|hati|yang|ini|itu|dari|aku|kamu|kita|bisa|ada|tidak|dengan|untuk|sudah|akan|mereka|kalian|kami|saya|bukan|karena|pada|saat|semua|lagi|bila|sono|siamo|siete|della|dello|delle|degli|questo|questa|questi|queste|quello|quella|quelli|quelle|anche|perché|ancora|niente|eu|ele|ela|eles|elas|meu|minha|meus|minhas|seu|sua|seus|suas|nosso|nossa|dele|dela|deles|delas|pra|pras|pros|pelo|pela|pelos|pelas|num|numa|onde|como|quem|mais|bem|bom|boa|bons|boas|hoje|ontem|amanhã|agora|depois|antes|também|mesmo|mesma|outro|outra|pouco|estou|estão|estava|fico|fica|ficou|tenho|tem|têm|tinha|vou|vai|vão|foi|fui|dar|dou|dá|dão|deu|comer|quis|quiser|quer|quero|sei|sabe|posso|pode|podem|vem|veio|boca|vinho|menino|menina|garoto|garota|yo|tú|él|ella|ellos|ellas|nosotros|usted|ustedes|nuestro|nuestra|pero|más|muy|bueno|buena|después|quién|decir|dice|dijo)\b/i;
    const UNAMBIGUOUS_FOREIGN_CHARS = /[¿¡ñÑäöüßÄÖÜẞãõçÃÕÇâêôÂÊÔàèùÀÈÙëïîûËÏÎÛœæŒÆ]/;
    const FRENCH_CONTRACTIONS = /\b(j'|c'|d'|l'|m'|t'|s'|n'|qu')/i;

    const DISTINCT_ENGLISH_WORDS = new Set([
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'from',
      'they', 'say', 'her', 'she', 'will', 'one', 'all', 'would', 'there', 'their', 'what',
      'out', 'about', 'who', 'get', 'which', 'go', 'when', 'make', 'can', 'like', 'time',
      'just', 'him', 'know', 'take', 'person', 'into', 'year', 'your', 'good', 'some', 'could',
      'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
      'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
      'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'wanna', 'gonna', 'gotta',
      'cant', 'dont', 'wont', 'ive', 'im', 'youre', 'theyre', 'hes', 'shes', 'aint', 'baby', 'love',
      'lately', 'help', 'roads', 'phases', 'speechless', 'complicate', 'rhythm', 'aimless', 'painless',
      'was', 'my', 'up', 'down', 'too', 'to', 'off', 'on', 'at', 'by', 'dead',
      'am', 'are', 'is', 'were', 'been', 'had', 'has', 'did', 'does', 'doing', 'done', 'worship',
      'worshipped', 'ground', 'walk', 'walked', 'ear', 'towel', 'dry', 'dried', 'kill', 'friends',
      'friend', 'cry', 'beat', 'inside', 'feel', 'alive', 'home', 'shag', 'pity', 'tag', 'shoes',
      'liked', 'being', 'germs', 'flu', 'chip', 'tooth', 'never', 'always', 'every', 'missing',
      'bed', 'side', 'tell', 'wait', 'patiently', 'promise', 'honest', 'right', 'wish', 'water',
      'lost', 'together', 'cold', 'heart', 'i', 'we'
    ]);

    function isLineForeign(text) {
      if (!text) return false;
      if (UNAMBIGUOUS_FOREIGN_MARKERS.test(text) || UNAMBIGUOUS_FOREIGN_CHARS.test(text) || FRENCH_CONTRACTIONS.test(text)) {
        return true;
      }
      if (/[áéíóúÁÉÍÓÚ]/.test(text)) {
        const words = text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
        const engMatches = words.filter(w => DISTINCT_ENGLISH_WORDS.has(w));
        if (engMatches.length < 2) return true;
      }
      return false;
    }

    function isSongPurelyEnglish(lines, songTitle = '', songArtist = '') {
      if (!Array.isArray(lines) || lines.length === 0) return true;

      // Metadata with unambiguous foreign characters or markers indicates a non-pure English track
      if (isLineForeign(songTitle) || isLineForeign(songArtist)) {
        return false;
      }

      let englishLineCount = 0;
      let foreignLineCount = 0;
      let totalMeaningfulLines = 0;

      for (const line of lines) {
        const text = (line.text || line.original || '').trim();
        if (!text || text.length < 2 || /^[\p{P}\s♪~]+$/u.test(text)) continue;
        totalMeaningfulLines++;

        if (isLineForeign(text)) {
          foreignLineCount++;
        }

        const words = text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
        const hasEnglishWord = words.some(w => DISTINCT_ENGLISH_WORDS.has(w));
        if (hasEnglishWord) {
          englishLineCount++;
        }
      }

      if (totalMeaningfulLines === 0) return true;

      // Purely English only if there is a dominant ratio of distinct English words with zero foreign markers
      if ((englishLineCount / totalMeaningfulLines) >= 0.40 && foreignLineCount === 0) {
        return true;
      }

      // If a longer song has <= 1 isolated foreign token (< 5% of lines) while predominantly English
      if (totalMeaningfulLines >= 15 && (foreignLineCount / totalMeaningfulLines) <= 0.05 && (englishLineCount / totalMeaningfulLines) >= 0.70) {
        return true;
      }

      return false;
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
      } else if (targetLang.toLowerCase() === 'en' && isSongPurelyEnglish(rawLyrics.lines, title, artist)) {
        shouldTranslate = false;
      }
    }

    // Step 1: Fast Transliteration (<15ms)
    const transliteratedLines = await this.transliterationService.transliterateLyrics(rawLyrics.lines, detectedScript);

    const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

    const initialLines = transliteratedLines.map(l => {
      const origText = l.original || '';
      let romajiText = l.romaji || '';
      if (romajiText && norm(normalizeHomoglyphs(romajiText)) === norm(normalizeHomoglyphs(origText))) {
        romajiText = '';
      }
      return {
        timeMs: l.timeMs,
        original: origText,
        romaji: romajiText,
        translation: ''
      };
    });

    const applyTranslations = (translatedLines) => {
      if (!Array.isArray(translatedLines)) return;
      translatedLines.forEach((t, idx) => {
        if (initialLines[idx]) {
          const origText = (initialLines[idx].original || '').trim();
          const cleanTranslation = (t.translation || '').trim();

          const isSame = norm(normalizeHomoglyphs(cleanTranslation)) === norm(normalizeHomoglyphs(origText));

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

          // If individual line detected an obscure dialect, but the song's primary language is permitted
          const songPrimaryLang = (translatedLines.detectedLang || '').toLowerCase();
          if (!isLangPermitted && songPrimaryLang && activeEnabledLangs.includes(songPrimaryLang) && !isTargetLanguage && !isSame) {
            isLangPermitted = true;
          }

          // Suppress duplicate, empty, disabled, or target-language lines
          if (isSame || !cleanTranslation || !isLangPermitted || (isTargetLanguage && !t.isPartiallyForeign)) {
            initialLines[idx].translation = '';
            t.translation = '';
          } else {
            const romaji = (initialLines[idx].romaji || '').trim();
            const hasRomaji = Boolean(romaji && romaji !== origText);

            // Check vocalization suppression & repetition collapsing
            const isVocalic = isRepetitiveOriginal(origText) ||
              isRepetitiveVocalization(cleanTranslation) ||
              (isVocalicOrRepetitive(cleanTranslation) && isPhoneticallyIdenticalToRomaji(romaji, cleanTranslation));

            if (hasRomaji && isVocalic) {
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
    };

    let isTranslating = false;

    // Step 2: Translation (Fast path for cache, async for network)
    if (shouldTranslate) {
      const cachedTranslations = this.translationService.getCachedTranslation(trackKey, targetLang, rawLyrics.lines.length);
      if (cachedTranslations) {
        applyTranslations(cachedTranslations);
        isTranslating = false;
        if (typeof onTranslationReady === 'function') {
          setTimeout(() => {
            onTranslationReady({
              trackKey,
              isTranslating: false,
              lines: initialLines.map(l => ({ timeMs: l.timeMs, translation: l.translation }))
            });
          }, 0);
        }
      } else {
        isTranslating = true;
        this.translationService.translateLyrics({
          trackKey,
          lines: rawLyrics.lines,
          targetLang
        }).then(translatedLines => {
          applyTranslations(translatedLines);
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
      }
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
      isTranslating,
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
  isVocalicOrRepetitive,
  isRepetitiveOriginal,
  collapseRepetition
};
