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

const HOMOGLYPH_MAP = {
  // Cyrillic
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
  '\u0445': 'x', '\u0425': 'X',
  // Greek uppercase homoglyphs
  '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z',
  '\u0397': 'H', '\u0399': 'I', '\u039A': 'K', '\u039C': 'M',
  '\u039D': 'N', '\u039F': 'O', '\u03A1': 'P', '\u03A4': 'T',
  '\u03A5': 'Y', '\u03A7': 'X',
  // Greek lowercase homoglyphs
  '\u03BF': 'o', '\u03C1': 'p', '\u03BD': 'v'
};

const HOMOGLYPH_REGEX = /[\u0430\u0410\u0432\u0412\u0441\u0421\u0435\u0415\u0456\u0406\u0458\u0408\u043a\u041a\u043c\u041c\u043d\u041d\u043e\u041e\u0440\u0420\u0442\u0422\u0443\u0423\u0445\u0425\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03BF\u03C1\u03BD\uFF21-\uFF5A]/g;

function normalizeHomoglyphs(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(HOMOGLYPH_REGEX, (ch) => {
    const code = ch.charCodeAt(0);
    // Fullwidth Latin: A-Z (0xFF21-0xFF3A), a-z (0xFF41-0xFF5A)
    if (code >= 0xFF21 && code <= 0xFF3A) return String.fromCharCode(code - 0xFEE0);
    if (code >= 0xFF41 && code <= 0xFF5A) return String.fromCharCode(code - 0xFEE0);
    return HOMOGLYPH_MAP[ch] || ch;
  });
}

// Nuance dictionary for colloquial suffixes and lyric idioms where standard
// morphological dictionaries (Kuromoji/IPADIC) select generic On'yomi readings
const JAPANESE_LYRIC_OVERRIDES = [
  // Colloquial suffix 〜面 (zura: acting like / putting on the face of)
  { pattern: /被害者面/g, replacement: '被害者づら' },
  { pattern: /いい子面/g, replacement: 'いい子づら' },
  { pattern: /知らん面/g, replacement: '知らんづら' },
  { pattern: /澄まし(た?)面/g, replacement: '澄まし$1づら' },
  { pattern: /すまし(た?)面/g, replacement: 'すまし$1づら' },
  { pattern: /泣き面/g, replacement: '泣きづら' },
  { pattern: /涼しい面/g, replacement: '涼しいづら' },
  { pattern: /他人面/g, replacement: '他人づら' },
  { pattern: /馬鹿面/g, replacement: '馬鹿づら' },
  { pattern: /あほ面/g, replacement: 'あほづら' },
  { pattern: /浮かない面/g, replacement: '浮かないづら' },

  // People counters: 1 person (hitori) & 2 people (futari)
  // Kuromoji notoriously tokenizes these as "ichi-nin" and "ni-nin"
  { pattern: /(?<![一二三四五六七八九十])一人(?!前)/g, replacement: 'ひとり' },
  { pattern: /(?<![一二三四五六七八九十])二人(?!三脚)/g, replacement: 'ふたり' },

  // Grammatical boundary: particle で + verb して (avoids Kuromoji misparsing as 'でし' + 'て')
  { pattern: /(?<=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])でして(?=[んるたよねも欲しい]|$)/g, replacement: 'で して' },

  // Buddhist & literary idioms / proper nouns often missing from IPADIC
  // Prevents mangled readings like '怨親平等' -> '怨 oya byōdō'
  { pattern: /怨親平等/g, replacement: 'オンシン平等' },
  { pattern: /怨親/g, replacement: 'オンシン' },
  { pattern: /廻廻奇譚/g, replacement: 'カイカイキタン' },
  { pattern: /両面宿儺/g, replacement: 'リョウメンスクナ' },
  { pattern: /宿儺/g, replacement: 'スクナ' },

  // J-Pop & anime lyric nuance idioms (e.g. King Gnu - SPECIALZ)
  { pattern: /際際/g, replacement: 'キワキワ' },
  { pattern: /興の都/g, replacement: 'きょうのみやこ' },
  { pattern: /悪い面/g, replacement: '悪い つら' },
  { pattern: /如何(痴れ者|余所者)/g, replacement: 'どんな$1' },
  { pattern: /廻遊/g, replacement: 'カイユウ ' },
  { pattern: /儘/g, replacement: 'まま' },
  { pattern: /廻る/g, replacement: 'まわる' },
  { pattern: /如何言おうと/g, replacement: 'どう言おうと' },
  { pattern: /大荒れ/g, replacement: 'おお荒れ' },
  { pattern: /氣裸氣裸/g, replacement: 'ギラギラ' },
  { pattern: /其体温/g, replacement: ' その体温' },
  { pattern: /(?<![一-龠])其(?=[一-龠])/g, replacement: ' その ' }
];

// Fallback romaji map for standalone rare/Joyo kanji that Kuromoji's IPADIC flags as UNKNOWN
const KANJI_FALLBACK_ROMAJI = {
  '怨': 'on', '儺': 'na', '鬱': 'utsu', '憬': 'kei', '箋': 'sen',
  '苛': 'ka', '蔑': 'betsu', '毀': 'ki', '緻': 'chi', '傲': 'gō',
  '氾': 'han', '璧': 'heki', '呪': 'juso', '譚': 'tan', '廻': 'kai',
  '繋': 'tsunagi', '呟': 'tsubuyaki', '弄': 'rō', '醒': 'sei', '彷': 'hō',
  '徨': 'kō', '儚': 'hakanai', '綻': 'hokorobi', '仄': 'hono', '掠': 'kasuri',
  '歪': 'hizumi', '蝕': 'shoku', '謳': 'ō', '錆': 'sabi', '儘': 'mama',
  '其': 'sono', '氣': 'ki', '遊': 'asobi', '際': 'kiwa',
  '疼': 'uzuki', '軋': 'kishimi', '轢': 'reki', '嘲': 'azawari', '煽': 'aori',
  '蠢': 'ugomeki', '慄': 'ritsu', '悶': 'mon', '憐': 'awaremi', '悍': 'kan'
};

function resolveRemainingKanji(romaji) {
  if (!romaji || !/[\u4E00-\u9FAF]/.test(romaji)) return romaji;
  return romaji.replace(/[\u4E00-\u9FAF]/g, (ch) => {
    return KANJI_FALLBACK_ROMAJI[ch] ? ` ${KANJI_FALLBACK_ROMAJI[ch]} ` : '';
  }).replace(/\s+/g, ' ').trim();
}

function applyJapaneseLyricOverrides(text) {
  if (!text || typeof text !== 'string') return text;
  let processed = text;
  for (const { pattern, replacement } of JAPANESE_LYRIC_OVERRIDES) {
    processed = processed.replace(pattern, replacement);
  }
  return processed;
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

    // Clean confusable homoglyphs before checking Cyrillic and Greek
    const cleaned = normalizeHomoglyphs(text);
    // Cyrillic (Russian, Ukrainian, Belarusian, Bulgarian, Serbian)
    if (/[\u0400-\u04FF]/.test(cleaned)) return 'cyrillic';
    // Greek
    if (/[\u0370-\u03FF]/.test(cleaned)) return 'greek';
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
        const lyricText = applyJapaneseLyricOverrides(text);
        if (this.kuroshiro && this.kuroshiro._analyzer) {
          const rawRomaji = await this.kuroshiro.convert(lyricText, {
            to: 'romaji',
            mode: 'spaced',
            romajiSystem: 'hepburn'
          });
          const cleanRomaji = rawRomaji.replace(/\s+/g, ' ').trim();
          return resolveRemainingKanji(cleanRomaji);
        } else {
          // Fallback to wanakana
          return resolveRemainingKanji(wanakana.toRomaji(lyricText));
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

  async transliterateLyrics(lines, forcedSongScript = null) {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    
    const songHasKana = lines.some(l => /[\u3040-\u309F\u30A0-\u30FF]/.test(l.text || l.original || ''));
    const songHasHangul = lines.some(l => /[\uAC00-\uD7AF\u1100-\u11FF]/.test(l.text || l.original || ''));

    const allText = lines.map(l => l.text || l.original || '').join(' ');
    const overallScript = forcedSongScript || this.detectScript(allText);

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
      let lineScript = this.detectScript(lineText);

      // If line has CJK ideographs without kana, contextualize to song script
      if (lineScript === 'chinese' && (songHasKana || overallScript === 'japanese')) {
        lineScript = 'japanese';
      } else if (lineScript === 'chinese' && (songHasHangul || overallScript === 'korean')) {
        lineScript = 'korean';
      }

      // Only transliterate if the line actually contains non-Latin script (Kanji, Kana, Hangul, Hanzi)
      let romaji = lineScript !== 'latin' ? await this.transliterateLine(lineText, lineScript) : '';
      if (romaji) {
        const norm = (s) => (s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
        if (norm(normalizeHomoglyphs(romaji)) === norm(normalizeHomoglyphs(lineText))) {
          romaji = '';
        }
      }
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
