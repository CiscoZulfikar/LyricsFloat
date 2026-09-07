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

  async fetchSingleText(text, targetLang = 'en', signal = null) {
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
        const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
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
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
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

  async translateSingleLine(rawText, targetLang = 'en', signal = null) {
    const text = normalizeHomoglyphs(rawText ? rawText.trim() : '');
    if (!text) return { translation: '', detectedLang: '', isPartiallyForeign: false };

    // Check for parenthetical backing vocals: e.g. "Main text (Backing vocal)" or "Main text [Backing vocal]"
    const parenMatch = text.match(/^(.*?)\s*([(\[][^)\]]+[)\]])\s*$/);
    if (parenMatch && parenMatch[1].trim() && parenMatch[2].trim()) {
      const mainText = parenMatch[1].trim();
      const parenWrapper = parenMatch[2].trim();
      const openParen = parenWrapper[0];
      const closeParen = parenWrapper[parenWrapper.length - 1];
      const parenContent = parenWrapper.slice(1, -1).trim();

      const [mainRes, parenRes] = await Promise.all([
        this.fetchSingleText(mainText, targetLang, signal),
        this.fetchSingleText(parenContent, targetLang, signal)
      ]);

      const mainDetected = (mainRes.detectedLang || '').toLowerCase();
      const parenDetected = (parenRes.detectedLang || '').toLowerCase();

      const isMainForeign = Boolean(mainDetected && !isSameLanguage(mainDetected, targetLang));
      const isParenForeign = Boolean(parenDetected && !isSameLanguage(parenDetected, targetLang));

      let mainFinal = mainRes.translation || mainText;
      let parenFinal = parenRes.translation || parenContent;

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
    const res = await this.fetchSingleText(text, targetLang, signal);
    let trans = res.translation;
    if (text[0] && text[0] === text[0].toUpperCase() && trans && trans.length > 0) {
      trans = trans[0].toUpperCase() + trans.slice(1);
    }
    const detectedLower = (res.detectedLang || '').toLowerCase();
    const isForeign = Boolean(detectedLower && !isSameLanguage(detectedLower, targetLang));

    return {
      translation: trans,
      detectedLang: res.detectedLang,
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

  async translateLyrics({ trackKey, lines, targetLang = 'en' }) {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const cacheKey = this.getCacheKey(trackKey, targetLang);

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const diskData = this.readFromDisk(cacheKey);
    if (diskData && Array.isArray(diskData) && diskData.length === lines.length) {
      this.memoryCache.set(cacheKey, diskData);
      return diskData;
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      const BATCH_SIZE = 10;
      const allResults = [];

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        if (signal.aborted) break;
        const batch = lines.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(l => {
          const rawText = l.text || l.original || '';
          return this.translateSingleLine(rawText, targetLang, signal);
        }));
        allResults.push(...batchResults);
      }

      const result = lines.map((line, index) => {
        const item = allResults[index] || { translation: '', detectedLang: '', isPartiallyForeign: false };
        return {
          timeMs: line.timeMs,
          translation: (item.translation || '').trim(),
          detectedLang: item.detectedLang || '',
          isPartiallyForeign: Boolean(item.isPartiallyForeign)
        };
      });

      // Find primary foreign detected language
      const foreignItem = result.find(r => r.detectedLang && r.detectedLang !== targetLang.toLowerCase());
      result.detectedLang = foreignItem ? foreignItem.detectedLang : ((result[0] && result[0].detectedLang) || '');

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

module.exports = { TranslationService };
