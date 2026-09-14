const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeHomoglyphs } = require('./transliteration');

function isSameLanguage(lang1, lang2) {
  if (!lang1 || !lang2) return false;
  const l1 = lang1.toLowerCase().trim();
  const l2 = lang2.toLowerCase().trim();
  if (l1 === l2) return true;
  if (l1.startsWith(l2 + '-') || l2.startsWith(l1 + '-')) return true;
  if ((l1 === 'id' || l1 === 'ms') && (l2 === 'id' || l2 === 'ms')) return true;
  return false;
}

function norm(str) {
  return (str || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

const LYRIC_EXPRESSION_MAP = {
  en: {
    'カミナッチャ': 'Coming at ya',
    'のらりくらり': 'Nonchalantly',
    'のらりくらりと': 'Evasively',
    'ゆらりゆらり': 'Swaying gently',
    'ゆらりゆらりと': 'Swaying gently',
    'ゆらゆら': 'Swaying back and forth',
    'ゆらゆらと': 'Swaying back and forth',
    'ふらふら': 'Wandering aimlessly',
    'ふらふらと': 'Wandering aimlessly',
    'うろうろ': 'Wandering around',
    'うろうろと': 'Wandering around',
    'きらきら': 'Sparkling bright',
    'きらきらと': 'Sparkling bright',
    'ギラギラ': 'Dazzling glare',
    'ギラギラと': 'Dazzling glare',
    '燦々と': 'Brilliantly',
    'さんさんと': 'Brilliantly'
  },
  id: {
    'のらりくらり': 'Bermalas-malasan',
    'のらりくらりと': 'Mengelak',
    'ゆらりゆらり': 'Bergoyang perlahan',
    'ゆらりゆらりと': 'Bergoyang perlahan',
    'ゆらゆら': 'Terombang-ambing',
    'ふらふら': 'Berkeliaran tanpa tujuan',
    'きらきら': 'Berkilauan',
    'ギラギラ': 'Menyilaukan',
    'カミナッチャ': 'Datang padamu'
  }
};

function postProcessTranslation(translation, targetLang = 'en') {
  if (!translation || typeof translation !== 'string') return translation;
  let text = translation;
  const lang = (targetLang || 'en').toLowerCase();

  if (lang === 'en') {
    text = text.replace(/\bpepequinha\b/gi, 'pussy');
    text = text.replace(/\bpepeca\b/gi, 'pussy');
    text = text.replace(/\bppk\b/gi, 'pussy');
    text = text.replace(/\bxoxota\b/gi, 'pussy');
    text = text.replace(/\bxoxotinha\b/gi, 'pussy');
    text = text.replace(/\b(my|your|her|his|our|their)\s+larissinha\b/gi, '$1 pussy');
    text = text.replace(/\bthe\s+larissinha\b/gi, 'the pussy');
    text = text.replace(/\bfuck,\s*fuck\s+larissinha\b/gi, 'fuck, fuck the pussy');
    text = text.replace(/\blarissinha\b/gi, 'the pussy');
    text = text.replace(/\bboot in the mouth\b/gi, 'put it in your mouth');
    text = text.replace(/\bboot in the face\b/gi, 'put it on your face');
    text = text.replace(/\bboot on the mouth\b/gi, 'put it in your mouth');
    text = text.replace(/\bboot on the face\b/gi, 'put it on your face');
  } else if (lang === 'id') {
    text = text.replace(/\bpepequinha\b/gi, 'vagina');
    text = text.replace(/\bpepeca\b/gi, 'vagina');
    text = text.replace(/\bppk\b/gi, 'vagina');
    text = text.replace(/\bxoxota\b/gi, 'vagina');
    text = text.replace(/\b(the\s+)?larissinha\b/gi, 'vagina');
  }

  if (text && text.length > 0 && translation[0] && translation[0] === translation[0].toUpperCase()) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  return text;
}

class TranslationService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'cache', 'translations');
    this.memoryCache = new Map();
    this.activeAbortController = null;
  }

  getCacheKey(trackKey, targetLang = 'en') {
    const raw = `v2___${(trackKey || '').toLowerCase().trim()}___${targetLang}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  readFromDisk(cacheKey) {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const foreignItem = parsed.find(l => l.detectedLang && l.detectedLang !== 'en');
          parsed.detectedLang = foreignItem ? foreignItem.detectedLang : ((parsed[0] && parsed[0].detectedLang) || '');
          return parsed;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error reading translation cache:', e);
    }
    return null;
  }

  writeToDisk(cacheKey, data) {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing translation cache:', e);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchSingleText(text, targetLang = 'en', signal = null, sourceLang = 'auto') {
    if (!text || !text.trim()) return { text, translation: '', detectedLang: '' };

    // Support mocking in unit tests if fetchTranslation was replaced on the instance
    if (this.fetchTranslation !== TranslationService.prototype.fetchTranslation) {
      const res = await this.fetchTranslation(text, targetLang, signal);
      const trans = Array.isArray(res) ? (res[0] || '') : (typeof res === 'string' ? res : '');
      const detectedLang = (res && res.detectedLang) || '';
      return { text, translation: trans, detectedLang };
    }

    const clients = ['dict-chrome-ex', 'gtx', 'webapp', 't'];
    for (const client of clients) {
      if (signal && signal.aborted) throw new Error('Aborted');

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=${encodeURIComponent(sourceLang || 'auto')}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url, {
          signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            const detectedLang = (data[2] || '').toLowerCase();
            const translation = data[0].map(item => item[0]).join('').trim();
            return { text, translation, detectedLang };
          }
        } else if (response.status === 429) {
          await this.sleep(100);
          continue;
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }

    // Fallback to MyMemory for single text
    try {
      const langpair = `${encodeURIComponent(sourceLang === 'auto' ? 'autodetect' : sourceLang)}|${encodeURIComponent(targetLang)}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
      const res = await fetch(url, { signal, headers: { 'User-Agent': 'LyricsFloat/1.0' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.responseData && data.responseData.translatedText) {
          return { text, translation: (data.responseData.translatedText || '').trim(), detectedLang: '' };
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }

    return { text, translation: '', detectedLang: '' };
  }

  async translateSingleLine(rawText, targetLang = 'en', signal = null, sourceLang = 'auto') {
    const text = normalizeHomoglyphs(rawText ? rawText.trim() : '');
    if (!text) return { translation: '', detectedLang: '', isPartiallyForeign: false };

    // Check fast dictionary lookup for Japanese mimetic/lyric phrases
    const cleanKey = text.replace(/[\p{P}\s]/gu, '');
    const dict = LYRIC_EXPRESSION_MAP[targetLang.toLowerCase()];
    if (dict && dict[cleanKey]) {
      return { text, translation: dict[cleanKey], detectedLang: 'ja', isPartiallyForeign: true };
    }

    // Check for parenthetical backing vocals: e.g. "Main text (Backing vocal)" or "Main text [Backing vocal]"
    const parenMatch = text.match(/^(.*?)\s*([(\[][^)\]]+[)\]])\s*$/);
    if (parenMatch && parenMatch[1].trim() && parenMatch[2].trim()) {
      const mainText = parenMatch[1].trim();
      const parenWrapper = parenMatch[2].trim();
      const openParen = parenWrapper[0];
      const closeParen = parenWrapper[parenWrapper.length - 1];
      const parenContent = parenWrapper.slice(1, -1).trim();

      const [mainRes, parenRes] = await Promise.all([
        this.fetchSingleText(mainText, targetLang, signal, sourceLang),
        this.fetchSingleText(parenContent, targetLang, signal, sourceLang)
      ]);

      const mainDetected = (mainRes.detectedLang || '').toLowerCase();
      const parenDetected = (parenRes.detectedLang || '').toLowerCase();

      const isMainForeign = Boolean(mainDetected && !isSameLanguage(mainDetected, targetLang));
      const isParenForeign = Boolean(parenDetected && !isSameLanguage(parenDetected, targetLang));

      let mainFinal = postProcessTranslation(mainRes.translation || mainText, targetLang);
      let parenFinal = postProcessTranslation(parenRes.translation || parenContent, targetLang);

      // Preserve capitalization of main text if original was capitalized
      if (mainText[0] && mainText[0] === mainText[0].toUpperCase() && mainFinal.length > 0) {
        mainFinal = mainFinal[0].toUpperCase() + mainFinal.slice(1);
      }

      const combined = `${mainFinal} ${openParen}${parenFinal}${closeParen}`;
      const overallDetected = isMainForeign ? mainDetected : (isParenForeign ? parenDetected : (mainDetected || parenDetected || ''));

      return {
        translation: combined,
        detectedLang: overallDetected,
        isPartiallyForeign: isMainForeign || isParenForeign
      };
    }

    // Normal line
    const res = await this.fetchSingleText(text, targetLang, signal, sourceLang);
    let trans = res.translation;
    let detectedLang = res.detectedLang;

    // Check for swallowed foreign script in mixed lines:
    // If the original text contains CJK characters, but the translation returned by the engine
    // merely echoed or translated the Latin segment (completely omitting the foreign CJK text)
    if (CJK_REGEX.test(text)) {
      const m1 = text.match(/^([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\s\p{P}]+?)\s+([a-zA-Z0-9\s\p{P}]+)$/u);
      const m2 = text.match(/^([a-zA-Z0-9\s\p{P}]+?)\s+([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\s\p{P}]+)$/u);

      if (m1 && m1[1].trim() && m1[2].trim()) {
        const cjkPart = m1[1].trim();
        const latinPart = m1[2].trim();
        if (norm(trans) === norm(latinPart)) {
          const cjkRes = await this.fetchSingleText(cjkPart, targetLang, signal);
          let cjkTrans = cjkRes.translation || cjkPart;
          cjkTrans = cjkTrans.replace(/\bKaminaccha\b/gi, 'coming at ya');
          trans = `${cjkTrans} ${latinPart}`;
          detectedLang = cjkRes.detectedLang || 'ja';
        }
      } else if (m2 && m2[1].trim() && m2[2].trim()) {
        const latinPart = m2[1].trim();
        const cjkPart = m2[2].trim();
        if (norm(trans) === norm(latinPart)) {
          const cjkRes = await this.fetchSingleText(cjkPart, targetLang, signal);
          let cjkTrans = cjkRes.translation || cjkPart;
          cjkTrans = cjkTrans.replace(/\bKaminaccha\b/gi, 'coming at ya');
          trans = `${latinPart} ${cjkTrans}`;
          detectedLang = cjkRes.detectedLang || 'ja';
        }
      }
    }

    if (text[0] && text[0] === text[0].toUpperCase() && trans && trans.length > 0) {
      trans = trans[0].toUpperCase() + trans.slice(1);
    }
    trans = postProcessTranslation(trans, targetLang);
    const detectedLower = (detectedLang || '').toLowerCase();
    const isForeign = Boolean(detectedLower && !isSameLanguage(detectedLower, targetLang));

    return {
      translation: trans,
      detectedLang: detectedLang,
      isPartiallyForeign: isForeign
    };
  }

  async fetchWithGoogleClients(joinedText, targetLang = 'en', signal = null) {
    const clients = ['dict-chrome-ex', 'gtx', 'webapp', 't'];

    for (const client of clients) {
      if (signal && signal.aborted) throw new Error('Aborted');

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joinedText)}`;
        const response = await fetch(url, {
          signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            const detectedLang = (data[2] || '').toLowerCase();
            const fullTranslatedText = data[0].map(item => item[0]).join('');
            const lines = fullTranslatedText.split('\n');
            lines.detectedLang = detectedLang;
            return lines;
          }
        } else if (response.status === 429) {
          await this.sleep(150);
          continue;
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }

    throw new Error('Google Translate multi-client queries failed');
  }

  async fetchWithMyMemory(texts, targetLang = 'en', signal = null) {
    if (signal && signal.aborted) throw new Error('Aborted');

    const translated = [];
    for (const text of texts) {
      if (!text.trim()) {
        translated.push('');
        continue;
      }
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
        const res = await fetch(url, { signal, headers: { 'User-Agent': 'LyricsFloat/1.0' } });
        if (res.ok) {
          const data = await res.json();
          if (data && data.responseData && data.responseData.translatedText) {
            translated.push(data.responseData.translatedText);
            continue;
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
      translated.push(text);
    }
    return translated;
  }

  async fetchChunkTranslation(texts, targetLang = 'en', signal = null) {
    const joinedText = texts.join('\n');

    try {
      return await this.fetchWithGoogleClients(joinedText, targetLang, signal);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn('Google Translate failed, falling back to MyMemory provider...');
    }

    try {
      return await this.fetchWithMyMemory(texts, targetLang, signal);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.error('All translation providers failed:', e.message);
    }

    return texts.map(() => '');
  }

  async fetchTranslation(joinedText, targetLang = 'en', signal = null) {
    const texts = joinedText.split('\n');
    return this.fetchChunkTranslation(texts, targetLang, signal);
  }

  getCachedTranslation(trackKey, targetLang = 'en', expectedLength = null) {
    if (!trackKey) return null;
    const cacheKey = this.getCacheKey(trackKey, targetLang);
    if (this.memoryCache.has(cacheKey)) {
      const data = this.memoryCache.get(cacheKey);
      if (!expectedLength || (Array.isArray(data) && data.length === expectedLength)) {
        return data;
      }
    }
    const diskData = this.readFromDisk(cacheKey);
    if (diskData && Array.isArray(diskData) && (!expectedLength || diskData.length === expectedLength)) {
      let changed = false;
      diskData.forEach(item => {
        if (item && item.translation) {
          const processed = postProcessTranslation(item.translation, targetLang);
          if (processed !== item.translation) {
            item.translation = processed;
            changed = true;
          }
        }
      });
      if (changed) {
        this.writeToDisk(cacheKey, diskData);
      }
      this.memoryCache.set(cacheKey, diskData);
      return diskData;
    }
    return null;
  }

  async translateLyrics({ trackKey, lines, targetLang = 'en' }) {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const cacheKey = this.getCacheKey(trackKey, targetLang);

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const diskData = this.readFromDisk(cacheKey);
    if (diskData && Array.isArray(diskData) && diskData.length === lines.length) {
      let changed = false;
      const dict = LYRIC_EXPRESSION_MAP[targetLang.toLowerCase()];
      diskData.forEach((item, idx) => {
        if (item && item.translation) {
          const processed = postProcessTranslation(item.translation, targetLang);
          if (processed !== item.translation) {
            item.translation = processed;
            changed = true;
          }
        }
        if (dict) {
          const origText = (lines[idx] && (lines[idx].text || lines[idx].original || '')).trim();
          const cleanKey = origText.replace(/[\p{P}\s]/gu, '');
          if (dict[cleanKey] && item.translation !== dict[cleanKey]) {
            item.translation = dict[cleanKey];
            changed = true;
          }
        }
      });
      if (changed) {
        this.writeToDisk(cacheKey, diskData);
      }
      this.memoryCache.set(cacheKey, diskData);
      return diskData;
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      // Deduplicate unique non-empty text lines to minimize network requests
      const uniqueTexts = Array.from(new Set(
        lines.map(l => normalizeHomoglyphs((l.text || l.original || '').trim())).filter(Boolean)
      ));

      const textMap = new Map();
      const BATCH_SIZE = 12;

      for (let i = 0; i < uniqueTexts.length; i += BATCH_SIZE) {
        if (signal.aborted) break;
        const batch = uniqueTexts.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(text => {
          return this.translateSingleLine(text, targetLang, signal);
        }));
        batch.forEach((text, idx) => {
          textMap.set(text, batchResults[idx]);
        });
      }

      // Find primary foreign detected language from valid standard languages
      const standardLangs = ['ja', 'ko', 'zh', 'ru', 'es', 'fr', 'de', 'pt', 'it', 'id', 'el', 'hi', 'ar'];
      let primaryForeignLang = '';
      for (const item of textMap.values()) {
        if (item && item.detectedLang && item.detectedLang !== targetLang.toLowerCase() && standardLangs.includes(item.detectedLang)) {
          primaryForeignLang = item.detectedLang;
          break;
        }
      }

      // If a track has a primary foreign language, re-translate any lines that hallucinated obscure language codes (e.g. 'zap', 'la')
      if (primaryForeignLang) {
        const obscureEntries = Array.from(textMap.entries()).filter(([_, item]) => {
          return item && item.detectedLang && !['en', ...standardLangs].includes(item.detectedLang);
        });

        if (obscureEntries.length > 0) {
          const fixedBatch = await Promise.all(obscureEntries.map(([raw]) => {
            return this.translateSingleLine(raw, targetLang, signal, primaryForeignLang);
          }));
          obscureEntries.forEach(([raw], i) => {
            if (fixedBatch[i] && fixedBatch[i].translation) {
              textMap.set(raw, fixedBatch[i]);
            }
          });
        }
      }

      const result = lines.map((line) => {
        const rawText = normalizeHomoglyphs((line.text || line.original || '').trim());
        const item = textMap.get(rawText) || { translation: '', detectedLang: '', isPartiallyForeign: false };
        return {
          timeMs: line.timeMs,
          translation: (item.translation || '').trim(),
          detectedLang: item.detectedLang || '',
          isPartiallyForeign: Boolean(item.isPartiallyForeign)
        };
      });

      // Find primary foreign detected language
      const foreignItem = result.find(r => r.detectedLang && r.detectedLang !== targetLang.toLowerCase());
      result.detectedLang = foreignItem ? foreignItem.detectedLang : (primaryForeignLang || (result[0] && result[0].detectedLang) || '');

      this.memoryCache.set(cacheKey, result);
      this.writeToDisk(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error('Translation failed:', err.message);
      return lines.map(l => ({ timeMs: l.timeMs, translation: '', detectedLang: '' }));
    }
  }
}

module.exports = { TranslationService, postProcessTranslation };
