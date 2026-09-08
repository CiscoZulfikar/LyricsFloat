const fs = require('fs');
const path = require('path');

class ConfigStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'config.json');
    this.data = {
      alwaysOnTop: true,
      showRomaji: true,
      showTranslation: true,
      translateForeignLatin: true,
      enabledTranslateLanguages: [
        'ar', 'zh', 'en', 'fr', 'de', 'el', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'es'
      ],
      targetLanguage: 'en',
      theme: 'theme-nordic-frost',
      originalFontSize: 18,
      subtextFontSize: 11,
      albumArtTint: true,
      bounds: { x: null, y: null, width: 440, height: 620 }
    };


    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
        if (Array.isArray(this.data.enabledTranslateLanguages) && !this.data.enabledTranslateLanguages.includes('en')) {
          this.data.enabledTranslateLanguages.push('en');
        }
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  }

  get(key, defaultValue = null) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }
}

module.exports = { ConfigStore };
