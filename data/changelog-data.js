/**
 * LyricsFloat - In-App Changelog Data
 * Historical version notes, feature highlights, modifications, and bugfixes.
 */

(function(root) {
  const CHANGELOG_DATA = [
  {
    groupTitle: 'Version 1.2',
    isLatest: true,
    isExpanded: true,
    releases: [
      {
        version: 'v1.2.3',
        date: '261006',
        isLatest: true,
        isExpanded: true,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Album-Aware Artwork Blurring", desc: "When changing songs, the cover art softens with a subtle Gaussian blur to give a clear visual cue that it is loading until the new track's lyrics and artwork arrive. If the incoming track belongs to the same album as the previous song, the artwork remains crisp and unblurred." },
              { title: "Persistent Disk Caching", desc: "Cached lyrics are saved to disk in <code>cache/lyrics/</code>, providing near-instant (&lt;2ms) lyrics loading on subsequent plays and app relaunches without hitting the network." },
              { title: "Modular Data & Configuration Architecture", desc: "Separated track registries, translation phrasebooks, theme lists, and release history into dedicated data files, making song behaviors, language nuance adjustments, and future additions faster and easier to maintain." },
              { title: "Streamlined Changelog Experience", desc: "Optimized the in-app changelog to load from external release records, keeping the interface lightweight and snappy." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Pipelined Independent Lyrics Delivery", desc: "Lyrics delivery is no longer blocked by external Deezer/iTunes cover art requests; lyrics render immediately upon LRCLIB resolution (~200ms) while cover art updates asynchronously in the background." },
              { title: "Rapid Skip In-Flight Cancellation", desc: "Integrated <code>AbortController</code> to abort pending HTTP requests immediately when switching tracks, avoiding request backlogs and 429 rate limits during rapid song skipping." },
              { title: "Clean Separation of Content and Engine Logic", desc: "Continuous song suites and lyrics processing engines are now fully data-driven, allowing community-reported song transitions and nuance rules to be updated seamlessly without altering the core app logic." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 Bug Fixes",
            items: [
              { title: "Accurate Explicit Badge Display", desc: "Fixed clean songs (such as <em>\"All I Really Want Is You\"</em>) incorrectly showing the [E] badge." },
              { title: "Translation Provider Error Handling", desc: "Stopped MyMemory error messages from appearing as lyric translations and refreshed translations saved by the previous version." },
              { title: "Retry Missing Line Translations", desc: "Foreign lyric lines left blank by a temporary translation failure are retried instead of staying blank in cache." },
              { title: "Correct Mixed-Script Translation Hints", desc: "Fixed Chinese lyric lines being sent an invalid source-language value, which could leave some lines untranslated." },
              { title: "English Lyrics Stay English", desc: "Fixed English-only lyrics from artists with accented names (such as <em>\"The Marías\"</em>) being incorrectly translated just because the artist name contained non-ASCII characters." },
              { title: "Chinese & Non-Latin Translation Detection", desc: "Fixed Chinese lyrics (such as <em>\"Hong Kong\"</em>) failing to translate when the translation provider falsely reported the source language as English." },
              { title: "Visual HTTP 503 Outage State", desc: "Added a dedicated visual offline state when the lyrics provider is experiencing server downtime (503 Service Unavailable) with one-click retry." },
              { title: "Mid-Song Lyrics Fetch & Rate-Limit Resilience", desc: "Fixed an issue where launching the app or polling mid-song failed to load lyrics (resulting in <em>\"Lyrics unavailable for this track\"</em>). Added compliant LRCLIB User-Agent headers, automatic HTTP 429 backoff retry with Retry-After parsing, duration-agnostic query fallbacks, and capped background retries to eliminate infinite polling loops." }
            ]
          }
        ]
      },
      {
        version: 'v1.2.2',
        date: '261005',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Continuous Suite & Album Transitions", desc: "Smooth, zero-flash transitions for continuous songs and consecutive album tracks (e.g. The Weeknd - <em>\"Baptized in Fear\"</em> → <em>\"Open Hearts\"</em>), crossfading directly into the next track's lyrics without loading flicker." },
              { title: "Compound Medley Splitting & Stitching", desc: "Automatically splits combined tracks (e.g. <em>\"Holiday / Boulevard of Broken Dreams\"</em>) to fetch and stitch synchronized lyrics with duration offsets." },
              { title: "Instrumental Breaks & Solos (•••)", desc: "Extended musical breaks, solos, and long intros now display an ambient, gently pulsing 3-dot indicator matching your theme accent." },
              { title: "Micro-Break Filtering", desc: "Brief pauses and line-clears under 6s are automatically suppressed to keep vocals smooth and eliminate frequent 3-dot popups." },
              { title: "Artwork Peek Hint & Themed Hint Pill", desc: "Opening the artwork modal briefly previews the track details for 1.8 seconds before tucking away. A subtle, theme-reactive frosted pill at the bottom edge indicates the expandable info drawer, automatically fading out when the details expand." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Interactive Artwork Metadata on Hover", desc: "The album and track details overlay in the full-size artwork modal now hides by default to keep album artwork completely unobstructed, smoothly animating into view when the cursor enters the bottom 33% of the artwork." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Multiple & Featured Artist Display", desc: "Full artist credits (e.g. <em>\"SZA, Travis Scott\"</em>) now appear reliably across the header, artwork modal, and lyrics metadata." },
              { title: "Accurate Album Cover Art", desc: "Prioritized standard album releases over deluxe, repack, or solo variants (e.g. correctly showing the standard <em>SOS</em> ocean cover)." },
              { title: "Windows Terminal Output", desc: "Fixed console logs stair-stepping diagonally across PowerShell by normalizing newlines to <code>\\r\\n</code>." },
              { title: "Punctuation Normalization", desc: "Cleans up community transcription artifacts like inverted question/exclamation marks (<code>¡</code>, <code>¿</code>) on non-Spanish songs." },
              { title: "Continuous Songs Loading Screen Flicker", desc: "Fixed an issue where continuous songs momentarily showed the \"Loading lyrics...\" screen even after the lyrics had already been displayed." }
            ]
          }
        ]
      },
      {
        version: 'v1.2.1',
        date: '260930',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Japanese \"o\" vs \"wo\" Distinction", desc: "Romanization now clearly differentiates between the grammatical particle <code>を</code>/<code>ヲ</code> (romanized as <code>wo</code>) and standard vowels <code>お</code>/<code>オ</code> (romanized as <code>o</code>) for natural singing and pronunciation." },
              { title: "Native Script Prioritization", desc: "Lyrics retrieval now actively prioritizes authentic Japanese Kanji/Kana lyrics with accurate line timings over community-uploaded Romaji text." },
              { title: "Smooth Lyrics State Crossfade", desc: "Added subtle, fluid fade animations when transitioning between the loading state and loaded lyrics, as well as an elegant dissolve-out when switching songs." },
              { title: "Trilingual & Multilingual Support", desc: "Songs with 3 or more languages and mixed scripts (such as English, Korean, and Chinese in <em>\"MORE\"</em> by K/DA) now fully support synchronized translations and romanization side-by-side." },
              { title: "Trilingual Test Suite", desc: "Added automated integration tests covering multilingual songs with mixed Korean, Chinese, and English verses." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Refined Artwork Modal Dismissal", desc: "Removed the <em>\"Click anywhere to close\"</em> tooltip; clicking on the artwork card no longer dismisses the modal, while backdrop clicks, the close button, and the <code>Escape</code> key cleanly close it." },
              { title: "Smarter Regional Language Detection", desc: "Regional language codes (like <code>zh-cn</code>, <code>zh-tw</code>, <code>es-419</code>, <code>pt-br</code>) are now matched by their base language, preventing dialect lines from being rejected as unrecognized codes." },
              { title: "Script-Aware Language Guard", desc: "Fallback re-translations now check script types to prevent forcing mismatched languages (e.g. treating Chinese characters as Korean)." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Full-Size Artwork Modal Marquee Scrolling", desc: "Fixed overflowing album titles (such as <em>Anime \"Attack on Titan\" Original Soundtrack</em>) getting clipped on the right without scrolling inside the full-size artwork modal by properly binding the wrapper element to its overflow container and ensuring <code>flex-shrink: 0</code>." },
              { title: "\"Lyrics Unavailable\" Flickering & Glitch", desc: "Fixed an issue where the <em>\"Lyrics unavailable for this track\"</em> message and pulse ring flickered and re-rendered every 800ms due to playback state polling re-triggering entrance animations on tracks with empty lyrics." },
              { title: "Startup Lyrics Fetch Resilience & Auto-Retry", desc: "Separated exact LRCLIB lookup and search into isolated stages with an increased 7-second timeout and automatic 3.5s background retry. Tracks playing when LyricsFloat launches no longer get stuck permanently on <em>\"Lyrics unavailable\"</em> due to transient startup network lag or upstream 503 errors." },
              { title: "Click-to-Retry Unavailable Lyrics", desc: "Made the <em>\"Lyrics unavailable\"</em> message interactively clickable with subtle hover feedback so users can instantly re-trigger lyrics retrieval anytime without restarting the app." },
              { title: "Startup IPC Race Condition", desc: "Moved renderer IPC event subscriptions prior to initial state retrieval, ensuring events emitted during window startup are never dropped." },
              { title: "Rewind & Replay Lyrics Retention", desc: "Fixed clicking the Previous button or rewinding the current track triggering an unnecessary <em>\"Loading lyrics...\"</em> state that timed out into <em>\"Lyrics unavailable\"</em>." },
              { title: "Terminal Mojibake on Windows", desc: "Set the terminal to UTF-8 before Electron starts and added CP437 mojibake reversal so track titles and artist names—including accented Latin and Asian names—log cleanly without character corruption." },
              { title: "Unicode Track Metadata Recovery", desc: "Fixed CP437 mojibake recovery to restore accented Latin names as well as CJK names, so artist and track names such as <em>\"The Marías\"</em> remain intact." },
              { title: "Album Artwork Blur Timing", desc: "Keep the previous cover blurred until the incoming artwork has loaded and is applied; late image loads from an earlier track can no longer clear the blur." },
              { title: "Multi-Pass & Bilingual LRC Duplication", desc: "Fixed multi-pass LRC files (such as YOASOBI's <em>\"アイドル\"</em> containing appended or interleaved Romaji sections) causing duplicate lines and orphaned Romaji active cards." },
              { title: "Missing Translations on Multilingual Lines", desc: "Fixed Chinese lines in multilingual tracks failing to translate or showing blank sub-text due to language code mismatches." },
              { title: "Chinese Pinyin in Songs with Korean Verses", desc: "Fixed Chinese lyrics being mistakenly treated as Korean Hanja in songs containing both Korean and Chinese, restoring instant <strong>Pinyin</strong> generation." },
              { title: "Corrupted Translation Cache", desc: "Automatically cleared stale cache entries for affected tracks so they re-translate cleanly." }
            ]
          }
        ]
      },
      {
        version: 'v1.2.0',
        date: '260914',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Explicit Content Badge [E]", desc: "Songs containing explicit lyrics now display a background-adaptive <code>[E]</code> badge beside the title, featuring frosted acrylic blur, theme-reactive cutout styling, and smooth marquee integration." },
              { title: "Tabbed Settings & Preferences", desc: "Preferences are now organized into 4 dedicated tabs (<em>Theme</em>, <em>Lyrics</em>, <em>Translation</em>, <em>About</em>) with fluid glide animations, a centered layout for wide displays, and an icon-only mode for compact windows." },
              { title: "Dynamic Header Controls & Hover Expansion", desc: "Playback controls neatly auto-collapse at rest to give long song titles maximum breathing room, expanding with a smooth spring transition when hovering over the header." },
              { title: "Dual Title & Artist Marquee Scrolling", desc: "Overflowing song titles and artist names now smoothly marquee back and forth with edge fading, dynamically adapting whenever the window is resized." },
              { title: "Interactive Timeline Scrubbing", desc: "Click or drag anywhere along the track progress bar to seek playback in Spotify with instant lyric position resynchronization." },
              { title: "Floating \"Jump to Singing Line\" Chip", desc: "A floating quick-return button appears when manually scrolling away from the lyrics, smoothly snapping the view back to the active singing line on click." },
              { title: "Full-Size Album Artwork Preview", desc: "Clicking the album thumbnail opens a full-size square artwork preview over a frosted acrylic backdrop with fluid zoom entrance and exit transitions." },
              { title: "Japanese Lyric Pronunciation Nuance", desc: "Enhanced Romaji transliteration accuracy for contextual Japanese lyrics, including people counters (<em>futari</em>, <em>hitori</em>), colloquial suffixes (<code>〜面</code> → <em>zura</em>), and colloquial mimetic words." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Symmetrical Marquee Edge Fade Masks", desc: "Overflowing titles and artist names now dissolve smoothly at both edges with symmetrical gradient fade masks, keeping text crisp at rest and seamlessly soft while scrolling." },
              { title: "Modular Frontend Architecture", desc: "Refactored the core frontend into dedicated UI controllers (marquee, playback, settings, and translation), improving responsiveness and architectural maintainability." },
              { title: "Playback Controls Auto-Collapse & Focus Handling", desc: "Refined focus management on the header playback dock so controls reliably auto-collapse after clicking buttons or moving the cursor away." },
              { title: "Refined Track Details Layout & Typography", desc: "Tightened typography line-heights and spacing for both track title and artist, ensuring clean vertical alignment alongside compact and standard album covers." },
              { title: "Seamless Frosted Acrylic Backdrop", desc: "Extended the frosted dark acrylic backdrop across the full window height, eliminating visible background seams behind the drag bar." },
              { title: "Strict English Translation Guard", desc: "Strengthened language detection to prevent accidental translations on English songs while accurately translating Latin-alphabet foreign tracks (Spanish, French, Portuguese, Indonesian)." },
              { title: "Customizable Lyrics Text Alignment", desc: "Added dedicated Left, Center, and Right text alignment options in Settings for personalized karaoke lyrics presentation." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Sticky Playback Controls on Skip", desc: "Fixed an issue where clicking Previous or Next track buttons kept the playback dock locked open due to persistent button focus." },
              { title: "Bilingual Song Translation Support", desc: "Fixed missing translations on bilingual tracks (such as <em>\"São Paulo\"</em> by The Weeknd & Anitta) by preventing false English skips and supporting colloquial regional slang." },
              { title: "English Track Lyrics Matching & Foreign Cover Guard", desc: "Fixed a search scoring bug where English tracks (such as <em>\"this is what falling in love feels like\"</em> by JVKE) could select foreign covers or remixes instead of the exact original lyrics." },
              { title: "Mixed-Script Translation Recovery", desc: "Resolved an issue where translation engines could drop foreign words in bilingual lines (such as Japanese + English in <em>\"Otonoke\"</em> by Creepy Nuts), now translating both sections seamlessly." },
              { title: "Regional Album Artwork & Storefront Search", desc: "Fixed missing album artwork for Japanese, Korean, and international releases (such as <em>\"晴る\"</em> by Yorushika) by detecting scripts and querying regional storefronts." },
              { title: "Duplicate Sub-text & Special Character Normalization", desc: "Fixed tracks with stylized fonts or Greek/fullwidth character variants causing redundant Romaji or identical translation sub-text to display underneath English lines." },
              { title: "Status Notification & Jump Button Stacking", desc: "Dynamically positions the translation status badge above the \"Jump to Singing Line\" button when both are active, preventing visual overlap and keeping click targets clear." },
              { title: "Synchronous Cached Translation Display", desc: "Cached translations now display immediately when switching tracks, preventing unnecessary loading spinners on previously translated songs." },
              { title: "Case-Insensitive Translation Updates", desc: "Fixed an internal track key case mismatch where songs with capitalized titles or artist names could fail to receive async translation updates." },
              { title: "Translation Status Badge Layout", desc: "Enforced single-line formatting with clean text truncation so the floating translation status badge never wraps awkwardly." },
              { title: "Instant Track Lyrics Refresh", desc: "Clears previous lyrics immediately when switching tracks in Spotify, preventing outdated lines from flashing during track transitions." }
            ]
          }
        ]
      }
    ]
  },
  {
    groupTitle: 'Version 1.1',
    isLatest: false,
    isExpanded: false,
    releases: [
      {
        version: 'v1.1.4',
        date: '260908',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Refined Active Line Typography", desc: "Crisp 1:1 text rendering, dark contrast drop shadow, and subtle ambient glow without bulky card borders or continuous scaling jumps." },
              { title: "Natural End-of-Song Attribution", desc: "Viewport naturally accommodates both the active final lyric line and the provider credits footer without clipping at the window border." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Streamlined Settings", desc: "Removed the experimental window opacity slider to ensure rock-solid native Windows 11 frosted acrylic blur and cleaner settings." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Outro Audio Cut-Off", desc: "Fixed a bug where songs with instrumental solos or outros prematurely jumped to the credits before the audio finished playing." },
              { title: "Manual Scroll Persistence", desc: "Fixed auto-scroll timer snapping the window back away when manually scrolling to the bottom to inspect attribution links." }
            ]
          }
        ]
      },
      {
        version: 'v1.1.3',
        date: '260907d',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Collapsible In-App Changelog", desc: "Both major version groups and individual minor releases can now be expanded or collapsed by clicking their headers." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Japanese Lyric Colloquial Suffixes", desc: "Added lyric nuance override dictionary for colloquial suffix <code>〜面</code> (e.g. <em>\"被害者面で\"</em> in <em>\"odoriko\"</em> by Vaundy correctly outputting <em>\"higaisha zura de\"</em> instead of <em>\"men de\"</em>)." },
              { title: "Japanese People Counters & Boundary Parsing", desc: "Fixed Kuromoji bug where <code>二人</code> and <code>一人</code> outputted <em>\"ni nin\"</em> and <em>\"ichi nin\"</em> instead of <em>\"futari\"</em> and <em>\"hitori\"</em>, and fixed particle <code>で</code> + verb <code>して</code> misparsing as <em>\"deshi te\"</em> (e.g. <em>\"二人でしてんだ\"</em> → <em>\"futari de shi te n da\"</em>)." },
              { title: "Translation Loader State & Speedup", desc: "Fixed the translation status pill prematurely vanishing after 8 seconds before translations arrived. The loading indicator is now purely driven by backend completion, and in-song line deduplication significantly reduces network queries." }
            ]
          }
        ]
      },
      {
        version: 'v1.1.2',
        date: '260907c',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Japanese Kanji Transliteration", desc: "Fixed Kanji-only lines in Japanese songs (such as <em>\"努力 未来 a beautiful star\"</em> in <em>\"KICK BACK\"</em> by Kenshi Yonezu) erroneously generating Chinese Pinyin. Now properly contextualizes the song's Japanese script and Kana markers to produce Japanese Romaji (<em>\"doryoku mirai a beautiful star\"</em>)." }
            ]
          }
        ]
      },
      {
        version: 'v1.1.1',
        date: '260907b',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Translation Loading Indicator", desc: "Real-time spinning/glowing icon and floating pill (<em>\"Translating lyrics...\"</em> → <em>\"✓ Translation ready\"</em>)." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Smart Vocalization Suppression", desc: "Repetitive singing syllables (e.g. <em>\"ル・ル・ル...\"</em>) with Romaji cleanly suppress redundant translation walls, and Western vocal repetitions are auto-collapsed." },
              { title: "Pure English Fast-Path", desc: "Robust vocabulary and foreign marker scanning eliminates false translation triggers on purely English tracks." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "English Song Translation & Pill Hang", desc: "Fixed purely English songs (e.g. <em>\"Like You Do\"</em>) getting falsely translated and leaving the loading pill spinning." },
              { title: "Vocalization Clutter Bug", desc: "Fixed katakana chanting generating 21 repeats of <em>\"Lulu\"</em> across 3 lines of italics right under Romaji." }
            ]
          }
        ]
      },
      {
        version: 'v1.1.0',
        date: '260907',
        isLatest: false,
        isExpanded: false,
        sections: [
          {
            type: 'new',
            title: "✨ What's New",
            items: [
              { title: "Parenthetical Vocal Translation", desc: "Intelligently translates foreign main vocals while preserving backing vocals (e.g. <em>\"Nadie como tú (We cried together...)\"</em>)." },
              { title: "English Language Toggle", desc: "Added English flag and checklist toggle to translate between English and other languages." },
              { title: "v2 Cache Engine", desc: "Upgraded translation cache system with auto-refresh for pristine lyrics." }
            ]
          },
          {
            type: 'mod',
            title: "🛠️ What's Been Modified",
            items: [
              { title: "Concurrent Translation Pipeline", desc: "Optimized per-line translation (~150ms) with zero rate-limit risk." },
              { title: "Accurate Language Detection", desc: "Each line is classified independently, preventing language overlap in bilingual tracks." },
              { title: "Smart English Bypass", desc: "Fast-paths purely English songs to save network bandwidth while keeping bilingual songs active." },
              { title: "Homoglyph Normalization", desc: "Integrated <code>normalizeHomoglyphs</code> to clean confusable letters from scraped lyrics." }
            ]
          },
          {
            type: 'fix',
            title: "🐛 What's Been Fixed",
            items: [
              { title: "Multi-Translation Bug", desc: "Fixed foreign verses in bilingual songs failing to translate." },
              { title: "Homoglyph Duplicate Leak", desc: "Sanitized Cyrillic lookalikes (e.g. <code>Therе's</code>) so English lines no longer show duplicate text." },
              { title: "Indonesian/Malay Mutual Detection", desc: "Resolved false translations for Indonesian songs with Indonesian target." },
              { title: "Checklist Language Suppression", desc: "Fixed hanging promises when disabling languages." }
            ]
          }
        ]
      }
    ]
  }
];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CHANGELOG_DATA };
  }
  if (root) {
    root.CHANGELOG_DATA = CHANGELOG_DATA;
  }
})(typeof self !== 'undefined' ? self : this);
