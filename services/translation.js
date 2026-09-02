const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TranslationService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'cache', 'translations');
    this.memoryCache = new Map();
    this.activeAbortController = null;
  }

  getCacheKey(trackKey, targetLang = 'en') {
    const raw = `${(trackKey || '').toLowerCase().trim()}___${targetLang}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  readFromDisk(cacheKey) {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
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

          // Rate limited on this client, try next client
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

    // MyMemory translates single queries
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

    // 1. Try Google Multi-Client Strategy
    try {
      return await this.fetchWithGoogleClients(joinedText, targetLang, signal);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn('Google Translate failed, falling back to MyMemory provider...');
    }

    // 2. Fallback to MyMemory
    try {
      return await this.fetchWithMyMemory(texts, targetLang, signal);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.error('All translation providers failed:', e.message);
    }

    // Default fallback: return empty strings
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
      const texts = lines.map(l => l.text || l.original || '');
      const CHUNK_SIZE = 35;
      const allTranslated = [];

      let detectedLang = '';
      for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        if (signal.aborted) break;
        const chunkTexts = texts.slice(i, i + CHUNK_SIZE);
        const chunkTranslated = await this.fetchTranslation(chunkTexts.join('\n'), targetLang, signal);
        allTranslated.push(...chunkTranslated);
        if (chunkTranslated.detectedLang && !detectedLang) {
          detectedLang = chunkTranslated.detectedLang;
        }
      }

      const result = lines.map((line, index) => ({
        timeMs: line.timeMs,
        translation: (allTranslated[index] || '').trim(),
        detectedLang
      }));
      result.detectedLang = detectedLang;


      this.memoryCache.set(cacheKey, result);
      this.writeToDisk(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error('Translation failed:', err.message);
      return lines.map(l => ({ timeMs: l.timeMs, translation: '' }));
    }
  }
}


module.exports = { TranslationService };
