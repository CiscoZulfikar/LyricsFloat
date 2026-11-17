# Changelog

All notable changes to LyricsFloat will be documented in this file.

---

## Version 1.2

### [1.2.3] - 2026-10-06 (`261006`)

#### ✨ What's New
- **Album-Aware Artwork Blurring:** When changing songs, the cover art softens with a subtle Gaussian blur to give a clear visual cue that it is loading until the new track's lyrics and artwork arrive. If the incoming track belongs to the same album as the previous song, the artwork remains crisp and unblurred.
- **Persistent Disk Caching:** Cached lyrics are saved to disk in `cache/lyrics/`, providing near-instant lyrics loading on subsequent plays and app relaunches without hitting the network.
- **Modular Data & Configuration Architecture:** Separated track registries, translation phrasebooks, theme lists, and release history into dedicated data files, making song behaviors, language nuance adjustments, and future additions faster and easier to maintain.
- **Streamlined Changelog Experience:** Optimized the in-app changelog to load from external release records, keeping the interface lightweight and snappy.

#### 🛠️ What's Been Modified
- **Pipelined Independent Lyrics Delivery:** Lyrics delivery is no longer blocked by external Deezer/iTunes cover art requests; lyrics render immediately upon LRCLIB resolution (~200ms) while cover art updates asynchronously in the background.
- **Rapid Skip In-Flight Cancellation:** Integrated `AbortController` to abort pending HTTP requests immediately when switching tracks, avoiding request backlogs and 429 rate limits during rapid song skipping.
- **Clean Separation of Content and Engine Logic:** Continuous song suites and lyrics processing engines are now fully data-driven, allowing community-reported song transitions and nuance rules to be updated seamlessly without altering the core app logic.

#### 🐛 Bug Fixes
- **Accurate Explicit Badge Display:** Fixed clean songs (such as *"All I Really Want Is You"*) incorrectly showing the `[E]` badge.
- **Chinese & Non-Latin Translation Detection:** Fixed Chinese lyrics (such as *"Hong Kong"*) failing to translate when the translation provider falsely reported the source language as English.
- **Visual HTTP 503 Outage State:** Added a dedicated visual offline state when the lyrics provider is experiencing server downtime (503 Service Unavailable) with one-click retry.
- **Mid-Song Lyrics Fetch & Rate-Limit Resilience:** Fixed an issue where launching the app or polling mid-song failed to load lyrics (resulting in *"Lyrics unavailable for this track"*). Added compliant LRCLIB User-Agent headers, automatic HTTP 429 backoff retry with `Retry-After` parsing, duration-agnostic query fallbacks, and capped background retries to eliminate infinite polling loops.
- **Unicode Track Metadata Recovery:** Fixed CP437 mojibake recovery to restore accented Latin names as well as CJK names, so artist and track names such as *"The Marías"* remain intact.
- **Album Artwork Blur Timing:** Keep the previous cover blurred until the incoming artwork has loaded and is applied; late image loads from an earlier track can no longer clear the blur.

---

### [1.2.2] - 2026-10-05 (`261005`)

#### ✨ What's New
- **Continuous Suite & Album Transitions:** Smooth, zero-flash transitions for continuous songs and consecutive album tracks (e.g. The Weeknd - *"Baptized in Fear"* → *"Open Hearts"*), crossfading directly into the next track's lyrics without loading flicker.
- **Compound Medley Splitting & Stitching:** Automatically splits combined tracks (e.g. *"Holiday / Boulevard of Broken Dreams"*) to fetch and stitch synchronized lyrics with duration offsets.
- **Instrumental Breaks & Solos (`•••`):** Extended musical breaks, solos, and long intros now display an ambient, gently pulsing 3-dot indicator matching your theme accent.
- **Micro-Break Filtering:** Brief pauses and line-clears under 6s are automatically suppressed to keep vocals smooth and eliminate frequent 3-dot popups.
- **Artwork Peek Hint & Themed Hint Pill:** Opening the artwork modal briefly previews the track details for 1.8 seconds before tucking away. A subtle, theme-reactive frosted pill at the bottom edge indicates the expandable info drawer, automatically fading out when the details expand.

#### 🛠️ What's Been Modified
- **Interactive Artwork Metadata on Hover:** The album and track details overlay in the full-size artwork modal now hides by default to keep album artwork completely unobstructed, smoothly animating into view when the cursor enters the bottom 33% of the artwork.

#### 🐛 What's Been Fixed
- **Multiple & Featured Artist Display:** Full artist credits (e.g. *"SZA, Travis Scott"*) now appear reliably across the header, artwork modal, and lyrics metadata.
- **Accurate Album Cover Art:** Prioritized standard album releases over deluxe, repack, or solo variants (e.g. correctly showing the standard *SOS* ocean cover).
- **Windows Terminal Output:** Fixed console logs stair-stepping diagonally across PowerShell by normalizing newlines to `\r\n`.
- **Punctuation Normalization:** Cleans up community transcription artifacts like inverted question/exclamation marks (`¡`, `¿`) on non-Spanish songs.
- **Continuous Songs Loading Screen Flicker:** Fixed an issue where continuous songs momentarily showed the "Loading lyrics..." screen even after the lyrics had already been displayed.

---

### [1.2.1] - 2026-09-30 (`260930`)

#### ✨ What's New
- **Japanese "o" vs "wo" Distinction:** Romanization now clearly differentiates between the grammatical particle `を`/`ヲ` (romanized as `wo`) and standard vowels `お`/`オ` (romanized as `o`) for natural singing and pronunciation.
- **Native Script Prioritization:** Lyrics retrieval now actively prioritizes authentic Japanese Kanji/Kana lyrics with accurate line timings over community-uploaded Romaji text.
- **Smooth Lyrics State Crossfade:** Added subtle, fluid fade animations when transitioning between the loading state and loaded lyrics, as well as an elegant dissolve-out when switching songs.
- **Trilingual & Multilingual Support:** Songs with 3 or more languages and mixed scripts (such as English, Korean, and Chinese in *"MORE"* by K/DA) now fully support synchronized translations and romanization side-by-side.
- **Trilingual Test Suite:** Added automated integration tests covering multilingual songs with mixed Korean, Chinese, and English verses.

#### 🛠️ What's Been Modified
- **Refined Artwork Modal Dismissal:** Removed the "Click anywhere to close" tooltip; clicking on the artwork card no longer dismisses the modal, while backdrop clicks, the close button, and the `Escape` key cleanly close it.
- **Smarter Regional Language Detection:** Regional language codes (like `zh-cn`, `zh-tw`, `es-419`, `pt-br`) are now matched by their base language, preventing dialect lines from being rejected as unrecognized codes.
- **Script-Aware Language Guard:** Fallback re-translations now check script types to prevent forcing mismatched languages (e.g. treating Chinese characters as Korean).

#### 🐛 What's Been Fixed
- **Full-Size Artwork Modal Marquee Scrolling:** Fixed overflowing album titles (such as *Anime "Attack on Titan" Original Soundtrack*) getting clipped on the right without scrolling inside the full-size artwork modal by properly binding the wrapper element to its overflow container and ensuring `flex-shrink: 0`.
- **"Lyrics Unavailable" Flickering & Animation Glitch:** Fixed an issue where the *"Lyrics unavailable for this track"* message and pulse ring flickered and re-rendered every 800ms due to playback state polling re-triggering entrance animations on tracks with empty lyrics.
- **Startup Lyrics Fetch Resilience & Auto-Retry:** Separated exact LRCLIB lookup and search into isolated stages with an increased 7-second timeout and automatic 3.5s background retry. Tracks playing when LyricsFloat launches no longer get stuck permanently on *"Lyrics unavailable"* due to transient startup network lag or upstream 503 errors.
- **Click-to-Retry Unavailable Lyrics:** Made the *"Lyrics unavailable"* message interactively clickable with subtle hover feedback so users can instantly re-trigger lyrics retrieval anytime without restarting the app.
- **Startup IPC Race Condition:** Moved renderer IPC event subscriptions prior to initial state retrieval, ensuring events emitted during window startup are never dropped.
- **Rewind & Replay Lyrics Retention:** Fixed clicking the Previous button or rewinding the current track triggering an unnecessary "Loading lyrics..." state that timed out into "Lyrics unavailable".
- **Terminal Mojibake on Windows:** Set the terminal to UTF-8 before Electron starts and added CP437 mojibake reversal so track titles and artist names—including accented Latin and Asian names—log cleanly without character corruption.
- **Multi-Pass & Bilingual LRC Duplication:** Fixed multi-pass LRC files (such as YOASOBI's *"アイドル"* containing appended or interleaved Romaji sections) causing duplicate lines and orphaned Romaji active cards.
- **Missing Translations on Multilingual Lines:** Fixed Chinese lines in multilingual tracks failing to translate or showing blank sub-text due to language code mismatches.
- **Chinese Pinyin in Songs with Korean Verses:** Fixed Chinese lyrics being mistakenly treated as Korean Hanja in songs containing both Korean and Chinese, restoring instant **Pinyin** generation.
- **Corrupted Translation Cache:** Automatically cleared stale cache entries for affected tracks so they re-translate cleanly.

---

### [1.2.0] - 2026-09-14 (`260914`)

#### ✨ What's New
- **Explicit Content Badge [E]:** Songs containing explicit lyrics now display a background-adaptive `[E]` badge beside the title, featuring frosted acrylic blur, theme-reactive cutout styling, and smooth marquee integration.
- **Tabbed Settings & Preferences:** Preferences are now organized into 4 dedicated tabs (*Theme*, *Lyrics*, *Translation*, *About*) with fluid glide animations, a centered layout for wide displays, and an icon-only mode for compact windows.
- **Dynamic Header Controls & Hover Expansion:** Playback controls neatly auto-collapse at rest to give long song titles maximum breathing room, expanding with a smooth spring transition when hovering over the header.
- **Dual Title & Artist Marquee Scrolling:** Overflowing song titles and artist names now smoothly marquee back and forth with edge fading, dynamically adapting whenever the window is resized.
- **Interactive Timeline Scrubbing:** Click or drag anywhere along the track progress bar to seek playback in Spotify with instant lyric position resynchronization.
- **Floating "Jump to Singing Line" Chip:** A floating quick-return button appears when manually scrolling away from the lyrics, smoothly snapping the view back to the active singing line on click.
- **Full-Size Album Artwork Preview:** Clicking the album thumbnail opens a full-size square artwork preview over a frosted acrylic backdrop with fluid zoom entrance and exit transitions.
- **Japanese Lyric Pronunciation Nuance:** Enhanced Romaji transliteration accuracy for contextual Japanese lyrics, including people counters (*futari*, *hitori*), colloquial suffixes (`〜面` → *zura*), and colloquial mimetic words.

#### 🛠️ What's Been Modified
- **Symmetrical Marquee Edge Fade Masks:** Overflowing titles and artist names now dissolve smoothly at both edges with symmetrical gradient fade masks, keeping text crisp at rest and seamlessly soft while scrolling.
- **Modular Frontend Architecture:** Refactored the core frontend into dedicated UI controllers (marquee, playback, settings, and translation), improving responsiveness and architectural maintainability.
- **Playback Controls Auto-Collapse & Focus Handling:** Refined focus management on the header playback dock so controls reliably auto-collapse after clicking buttons or moving the cursor away.
- **Refined Track Details Layout & Typography:** Tightened typography line-heights and spacing for both track title and artist, ensuring clean vertical alignment alongside compact and standard album covers.
- **Seamless Frosted Acrylic Backdrop:** Extended the frosted dark acrylic backdrop across the full window height, eliminating visible background seams behind the drag bar.
- **Strict English Translation Guard:** Strengthened language detection to prevent accidental translations on English songs while accurately translating Latin-alphabet foreign tracks (Spanish, French, Portuguese, Indonesian).
- **Customizable Lyrics Text Alignment:** Added dedicated Left, Center, and Right text alignment options in Settings for personalized karaoke lyrics presentation.

#### 🐛 What's Been Fixed
- **Sticky Playback Controls on Skip:** Fixed an issue where clicking Previous or Next track buttons kept the playback dock locked open due to persistent button focus.
- **Bilingual Song Translation Support:** Fixed missing translations on bilingual tracks (such as *"São Paulo"* by The Weeknd & Anitta) by preventing false English skips and supporting colloquial regional slang.
- **English Track Lyrics Matching & Foreign Cover Guard:** Fixed a search scoring bug where English tracks (such as *"this is what falling in love feels like"* by JVKE) could select foreign covers or remixes instead of the exact original lyrics.
- **Mixed-Script Translation Recovery:** Resolved an issue where translation engines could drop foreign words in bilingual lines (such as Japanese + English in *"Otonoke"* by Creepy Nuts), now translating both sections seamlessly.
- **Regional Album Artwork & Storefront Search:** Fixed missing album artwork for Japanese, Korean, and international releases (such as *"晴る"* by Yorushika) by detecting scripts and querying regional storefronts.
- **Duplicate Sub-text & Special Character Normalization:** Fixed tracks with stylized fonts or Greek/fullwidth character variants causing redundant Romaji or identical translation sub-text to display underneath English lines.
- **Status Notification & Jump Button Stacking:** Dynamically positions the translation status badge above the "Jump to Singing Line" button when both are active, preventing visual overlap and keeping click targets clear.
- **Synchronous Cached Translation Display:** Cached translations now display immediately when switching tracks, preventing unnecessary loading spinners on previously translated songs.
- **Case-Insensitive Translation Updates:** Fixed an internal track key case mismatch where songs with capitalized titles or artist names could fail to receive async translation updates.
- **Translation Status Badge Layout:** Enforced single-line formatting with clean text truncation so the floating translation status badge never wraps awkwardly.
- **Instant Track Lyrics Refresh:** Clears previous lyrics immediately when switching tracks in Spotify, preventing outdated lines from flashing during track transitions.

---

## Version 1.1

### [1.1.4] - 2026-09-08 (`260908`)

#### ✨ What's New & Polished
- **Refined Active Line Typography & Subtle Focus:** Upgraded active karaoke line styling with crisp 1:1 text rendering, a dark contrast drop shadow, and a subtle ambient accent glow (`--accent-glow`). Inactive lines smoothly settle at `scale(0.98)` with reduced padding (`8px 12px`) for a cleaner, modern reading experience without jarring scale jumps or blurred neon clouds.
- **Natural End-of-Song Attribution Layout:** When the song reaches the final lyric line, the viewport automatically positions both the active final line and the provider credits footer (`Provided by: LRCLIB [track URL]`) comfortably in view with zero clipping at the window border.

#### 🛠️ What's Been Modified
- **Streamlined Settings (Window Opacity Removed):** Removed the experimental window opacity slider to ensure rock-solid native Windows 11 frosted acrylic background rendering (fixed at 90% blur) and cleaner settings.

#### 🐛 What's Been Fixed
- **End-of-Song Auto-Scroll Jump:** Fixed a bug where songs with instrumental solos or long outros (e.g. *Sunflower*, *Loverboy*, *odoriko*) prematurely jumped to the credits before the audio finished playing. The final line now remains in view throughout the entire outro without any interruptions.
- **Manual Scroll Persistence:** Fixed auto-scroll timer snapping the window back away when manually scrolling to the bottom to view or click track attribution links.

---

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
