# Changelog

All notable changes to LyricsFloat will be documented in this file.

---

## [1.1.0] - 2026-09-07 (`260907`)

### ✨ What's New
- **Parenthetical & Backing Vocal Translation:** Intelligently detects and translates lines featuring backing vocals or ad-libs in parentheses/brackets (e.g. *"Nadie como tú (We cried together when we said our goodbyes)"*), translating foreign primary vocals to the target language while retaining target-language backing vocals.
- **English Language Toggle in Settings:** Added English (`en`) with its flag icon to the Languages checklist in Settings, enabling translation of English tracks into other target languages (such as Indonesian) or selective disabling.
- **`v2` Cache Invalidation Engine:** Upgraded translation cache keys with automated versioning (`v2___...`), ensuring previously corrupted or misclassified lyrics cache entries are automatically superseded with clean per-line data.

### 🛠️ What's Been Modified
- **Concurrent Per-Line Translation Engine:** Replaced monolithic 35-line batch queries with concurrent per-line translation utilizing a controlled batch size (`BATCH_SIZE = 10`), achieving ~150ms execution speed while eliminating API rate-limiting risks.
- **Independent Per-Line Language Detection:** Each line now carries its own isolated `detectedLang`, preventing language classification conflicts across bilingual verses.
- **Smart English Song Bypass:** Purely English tracks are now detected accurately via distinct vocabulary markers, bypassing unnecessary network calls when the target language is English while guaranteeing bilingual songs are never skipped.
- **Homoglyph Normalization:** Integrated `normalizeHomoglyphs` across the transliteration, enrichment, and translation pipelines to clean Cyrillic lookalike letters from scraped lyrics.

### 🐛 What's Been Fixed
- **Bilingual / Multilingual Song Translation:** Fixed a critical bug where foreign verses in songs containing English lines (e.g. *"Nobody New"* by The Marías) were falsely treated as English and left untranslated.
- **Homoglyph Duplicate Translation Leak:** Fixed an issue where Cyrillic lookalikes (`\u0435` in `Therе's` and `watеr`) caused `norm(orig) === norm(trans)` to evaluate to `false`, causing English lyrics to display duplicate English text underneath.
- **Indonesian / Malay Mutual False Detection:** Resolved false translation triggers where Indonesian lyrics detected by Google as Malay (`ms`) triggered redundant translation when the target language was Indonesian (`id`).
- **Checklist Language Suppression Promise:** Fixed an issue where disabling languages could leave unresolved asynchronous promises.

---

## [1.0.0] - 2026-09-02

- Initial Release of LyricsFloat.
- Floating synced karaoke viewport with Windows 11 frosted glass / acrylic blur backdrop.
- Spotify and Windows Global System Media Transport Controls (GSMTC) sync.
- Real-time Romaji, Pinyin, and Hangul pronunciation sub-text.
- Automatic neural translation into target languages.
- Ambient album art fluid glow.
- 5 built-in color themes, opacity slider, and custom font scaling.
