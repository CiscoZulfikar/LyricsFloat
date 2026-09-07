# Changelog

All notable changes to LyricsFloat will be documented in this file.

---

## Version 1.1

### [1.1.3] - 2026-09-07 (`260907d`)

#### ✨ What's New
- **Collapsible In-App Changelog:** Both major version groups and individual minor releases in the in-app Settings modal can now be independently collapsed and expanded with interactive toggle arrows, keeping the settings panel sleek and compact.

#### 🐛 What's Been Fixed
- **Japanese Lyric Colloquial Suffix Pronunciation:** Added a targeted lyric nuance override system to `TransliterationService` for Japanese colloquial suffix `〜面` (e.g. `被害者面で` in *"odoriko"* by Vaundy correctly transliterated as *"higaisha zura de"* instead of generic dictionary On'yomi reading *"men de"*).
- **Japanese Counter & Grammatical Tokenization:** Resolved notorious Kuromoji bugs where `二人` and `一人` were transliterated as *"ni nin"* and *"ichi nin"* instead of *"futari"* and *"hitori"*, and fixed particle `で` + verb `して` being mis-parsed as *"deshi te"* (e.g. `二人でしてんだ` now outputs clean *"futari de shi te n da"*).
- **Translation Loading State & Line Deduplication:** Fixed the translation status pill prematurely vanishing after 8 seconds on longer tracks before translation arrived. Translation state is now purely event-driven by backend completion, and in-song line deduplication accelerates translation speeds by up to 60-70%.

---

### [1.1.2] - 2026-09-07 (`260907c`)

#### 🐛 What's Been Fixed
- **Japanese Kanji Transliteration in Japanese Songs:** Fixed a bug where Kanji-only lines in Japanese tracks (e.g. *"努力 未来 a beautiful star"* in *"KICK BACK"* by Kenshi Yonezu) were classified as Chinese Hanzi due to isolated line evaluation and produced Pinyin (`nu3 li4 wei4 lai2...`). The transliteration engine now inspects the broader song context and Kana presence to reliably generate authentic Japanese Romaji (`doryoku mirai...`).

---

### [1.1.1] - 2026-09-07 (`260907b`)

#### ✨ What's New
- **Translation Loading Indicator:** Added live visual feedback during async lyrics translation with an active glowing/spinning toolbar icon and a sleek floating status pill (`Translating lyrics...` → `✓ Translation ready`).

#### 🛠️ What's Been Modified
- **Smart Vocalization Suppression & Repetition Collapsing:** Automatically suppresses redundant translations when Romaji is already active and the line is purely singing vocalizations or onomatopoeia (e.g. Japanese katakana chanting `ル・ル・ル...`), and collapses excessive identical word repeats in non-CJK tracks.
- **Pure English Fast-Path:** Robust vocabulary and foreign marker scanning eliminates false translation triggers on purely English tracks.

#### 🐛 What's Been Fixed
- **English Song Translation & Pill Hang:** Fixed purely English songs (e.g. *"Like You Do"*) getting falsely translated and leaving the loading pill spinning.
- **Vocalization Redundancy & 3-Line Wall Bug:** Fixed an issue where Japanese katakana vocalizations (`ル` repeated 16+ times) produced 21 repeats of *"Lulu"* spanning 3 lines of italics right under Romaji.

---

### [1.1.0] - 2026-09-07 (`260907`)

#### ✨ What's New
- **Parenthetical & Backing Vocal Translation:** Intelligently detects and translates lines featuring backing vocals or ad-libs in parentheses/brackets (e.g. *"Nadie como tú (We cried together when we said our goodbyes)"*), translating foreign primary vocals to the target language while retaining target-language backing vocals.
- **English Language Toggle in Settings:** Added English (`en`) with its flag icon to the Languages checklist in Settings, enabling translation of English tracks into other target languages (such as Indonesian) or selective disabling.
- **`v2` Cache Invalidation Engine:** Upgraded translation cache keys with automated versioning (`v2___...`), ensuring previously corrupted or misclassified lyrics cache entries are automatically superseded with clean per-line data.

#### 🛠️ What's Been Modified
- **Concurrent Per-Line Translation Engine:** Replaced monolithic 35-line batch queries with concurrent per-line translation utilizing a controlled batch size (`BATCH_SIZE = 10`), achieving ~150ms execution speed while eliminating API rate-limiting risks.
- **Independent Per-Line Language Detection:** Each line now carries its own isolated `detectedLang`, preventing language classification conflicts across bilingual verses.
- **Smart English Song Bypass:** Purely English tracks are now detected accurately via distinct vocabulary markers, bypassing unnecessary network calls when the target language is English while guaranteeing bilingual songs are never skipped.
- **Homoglyph Normalization:** Integrated `normalizeHomoglyphs` across the transliteration, enrichment, and translation pipelines to clean Cyrillic lookalike letters from scraped lyrics.

#### 🐛 What's Been Fixed
- **Bilingual / Multilingual Song Translation:** Fixed a critical bug where foreign verses in songs containing English lines (e.g. *"Nobody New"* by The Marías) were falsely treated as English and left untranslated.
- **Homoglyph Duplicate Translation Leak:** Fixed an issue where Cyrillic lookalikes (`\u0435` in `Therе's` and `watеr`) caused `norm(orig) === norm(trans)` to evaluate to `false`, causing English lyrics to display duplicate English text underneath.
- **Indonesian / Malay Mutual False Detection:** Resolved false translation triggers where Indonesian lyrics detected by Google as Malay (`ms`) triggered redundant translation when the target language was Indonesian (`id`).
- **Checklist Language Suppression Promise:** Fixed an issue where disabling languages could leave unresolved asynchronous promises.

---

## Version 1.0

### [1.0.0] - 2026-09-02 (`260902`)

- Initial Release of LyricsFloat.
- Floating synced karaoke viewport with Windows 11 frosted glass / acrylic blur backdrop.
- Spotify and Windows Global System Media Transport Controls (GSMTC) sync.
- Real-time Romaji, Pinyin, and Hangul pronunciation sub-text.
- Automatic neural translation into target languages.
- Ambient album art fluid glow.
- 5 built-in color themes, opacity slider, and custom font scaling.
