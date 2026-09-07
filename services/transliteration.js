const Kuroshiro = require('kuroshiro');
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
const pinyin = require('pinyin');
const wanakana = require('wanakana');

// Algorithmic Korean Revised Romanization
const HANGUL_OFFSET = 0xAC00;
const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FINALS = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

function romanizeHangul(text) {
  if (!text || typeof text !== 'string') return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllableIndex = code - HANGUL_OFFSET;
      const initialIndex = Math.floor(syllableIndex / 588);
      const medialIndex = Math.floor((syllableIndex % 588) / 28);
      const finalIndex = syllableIndex % 28;

      let init = INITIALS[initialIndex];
      result += init + MEDIALS[medialIndex] + FINALS[finalIndex];
    } else {
      result += text[i];
    }
  }
  return result;
}

const CYRILLIC_MAP = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '\'', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
  'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
  'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
  'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '\'', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  'і': 'i', 'І': 'I', 'ї': 'yi', 'Ї': 'Yi', 'є': 'ye', 'Є': 'Ye', 'ґ': 'g', 'Ґ': 'G',
  'ў': 'w', 'Ў': 'W', 'ђ': 'dj', 'Ђ': 'Dj', 'ј': 'j', 'Ј': 'J', 'љ': 'lj', 'Љ': 'Lj',
  'њ': 'nj', 'Њ': 'Nj', 'ћ': 'c', 'Ћ': 'C', 'џ': 'dz', 'Џ': 'Dz'
};

const GREEK_MAP = {
  'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th',
  'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
  'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
  'ά': 'a', 'έ': 'e', 'ή': 'i', 'ί': 'i', 'ό': 'o', 'ύ': 'y', 'ώ': 'o',
  'Α': 'A', 'Β': 'V', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'I', 'Θ': 'Th',
  'Ι': 'I', 'Κ': 'K', 'Л': 'L', 'М': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P',
  'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'Ch', 'Ψ': 'Ps', 'Ω': 'O',
  'Ά': 'A', 'Έ': 'E', 'Ή': 'I', 'Ί': 'I', 'Ό': 'O', 'Ύ': 'Y', 'Ώ': 'O'
};

const ARABIC_MAP = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'sh': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': '\'', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'h', 'ء': '\'', 'ئ': 'y', 'ؤ': 'w', 'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'گ': 'g'
};

const DEVANAGARI_MAP = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah',
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  '्': '', 'ं': 'n', 'ँ': 'n', 'ः': 'h'
};

const HEBREW_MAP = {
  'א': '\'', 'ב': 'v', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch',
  'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n',
  'ן': 'n', 'ס': 's', 'ע': '\'', 'פ': 'f', 'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k',
  'ר': 'r', 'ש': 'sh', 'ת': 't'
};

function romanizeByMap(text, map) {
  return text.split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

const path = require('path');

function normalizeHomoglyphs(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/[\u0430\u0410\u0432\u0412\u0441\u0421\u0435\u0415\u0456\u0406\u0458\u0408\u043a\u041a\u043c\u041c\u043d\u041d\u043e\u041e\u0440\u0420\u0442\u0422\u0443\u0423\u0445\u0425]/g, (ch) => {
    const map = {
      '\u0430': 'a', '\u0410': 'A',
      '\u0432': 'b', '\u0412': 'B',
      '\u0441': 'c', '\u0421': 'C',
      '\u0435': 'e', '\u0415': 'E',
      '\u0456': 'i', '\u0406': 'I',
      '\u0458': 'j', '\u0408': 'J',
      '\u043a': 'k', '\u041a': 'K',
      '\u043c': 'm', '\u041c': 'M',
      '\u043d': 'h', '\u041d': 'H',
      '\u043e': 'o', '\u041e': 'O',
      '\u0440': 'p', '\u0420': 'P',
      '\u0442': 't', '\u0422': 'T',
      '\u0443': 'y', '\u0423': 'Y',
      '\u0445': 'x', '\u0425': 'X'
    };
    return map[ch] || ch;
  });
}

class TransliterationService {
  constructor() {
    const KuroshiroClass = Kuroshiro.default || Kuroshiro;
    const AnalyzerClass = KuromojiAnalyzer.default || KuromojiAnalyzer;
    this.kuroshiro = new KuroshiroClass();

    // Support unpacked kuromoji dictionary in production ASAR packaging
    const dictPath = path.join(__dirname, '..', 'node_modules', 'kuromoji', 'dict').replace('app.asar', 'app.asar.unpacked');
    this.analyzer = new AnalyzerClass({ dictPath });
    this.isInitialized = false;
    this.initPromise = null;
  }


  async init() {
    if (this.isInitialized) return;
    if (!this.initPromise) {
      this.initPromise = this.kuroshiro.init(this.analyzer).then(() => {
        this.isInitialized = true;
      }).catch(err => {
        console.warn('Kuromoji init warning, falling back to Wanakana:', err.message);
        this.isInitialized = true;
      });
    }
    return this.initPromise;
  }

  detectScript(text) {
    if (!text || typeof text !== 'string') return 'latin';
    
    // Japanese: Hiragana or Katakana
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
    // Korean: Hangul
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'korean';
    // CJK Ideographs (Kanji / Hanzi)
    if (/[\u4E00-\u9FAF]/.test(text)) {
      if (/[\u3000-\u303F]/.test(text)) return 'japanese';
      return 'chinese';
    }

    // Clean confusable homoglyphs before checking Cyrillic
    const cleaned = normalizeHomoglyphs(text);
    // Cyrillic (Russian, Ukrainian, Belarusian, Bulgarian, Serbian)
    if (/[\u0400-\u04FF]/.test(cleaned)) return 'cyrillic';
    // Greek
    if (/[\u0370-\u03FF]/.test(text)) return 'greek';
    // Arabic / Persian / Urdu
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return 'arabic';
    // Devanagari (Hindi, Marathi, Nepali, Sanskrit)
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    // Hebrew
    if (/[\u0590-\u05FF]/.test(text)) return 'hebrew';

    return 'latin';
  }

  async transliterateLine(text, forcedScript = null) {
    if (!text || typeof text !== 'string') return '';
    const script = forcedScript || this.detectScript(text);

    if (script === 'latin') return '';

    try {
      if (script === 'japanese') {
        await this.init();
        if (this.kuroshiro && this.kuroshiro._analyzer) {
          const romaji = await this.kuroshiro.convert(text, {
            to: 'romaji',
            mode: 'spaced',
            romajiSystem: 'hepburn'
          });
          return romaji.trim();
        } else {
          // Fallback to wanakana
          return wanakana.toRomaji(text);
        }
      }

      if (script === 'korean') {
        return romanizeHangul(text).trim();
      }

      if (script === 'chinese') {
        const pinyinFn = pinyin.default || pinyin;
        const rawPinyin = pinyinFn(text, {
          style: pinyin.STYLE_TONE2 || 2,
          heteronym: false
        });
        return rawPinyin.map(item => item[0]).join(' ').trim();
      }

      if (script === 'cyrillic') {
        return romanizeByMap(text, CYRILLIC_MAP).trim();
      }

      if (script === 'greek') {
        return romanizeByMap(text, GREEK_MAP).trim();
      }

      if (script === 'arabic') {
        return romanizeByMap(text, ARABIC_MAP).trim();
      }

      if (script === 'devanagari') {
        return romanizeByMap(text, DEVANAGARI_MAP).trim();
      }

      if (script === 'hebrew') {
        return romanizeByMap(text, HEBREW_MAP).trim();
      }
    } catch (e) {
      console.error('Transliteration error for line:', text, e);
      if (script === 'japanese') {
        return wanakana.toRomaji(text);
      }
    }
    return '';
  }

  async transliterateLyrics(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    
    const hasAnyNonLatin = lines.some(l => this.detectScript(l.text || l.original || '') !== 'latin');
    if (!hasAnyNonLatin) {
      return lines.map(l => ({
        timeMs: l.timeMs,
        original: l.text || l.original || '',
        romaji: ''
      }));
    }

    const results = [];
    for (const line of lines) {
      const lineText = line.text || line.original || '';
      const lineScript = this.detectScript(lineText);
      // Only transliterate if the line actually contains non-Latin script (Kanji, Kana, Hangul, Hanzi)
      const romaji = lineScript !== 'latin' ? await this.transliterateLine(lineText, lineScript) : '';
      results.push({
        timeMs: line.timeMs,
        original: lineText,
        romaji
      });
    }
    return results;

  }
}

module.exports = { TransliterationService, romanizeHangul, romanizeByMap, normalizeHomoglyphs, CYRILLIC_MAP, GREEK_MAP };
