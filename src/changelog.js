/**
 * LyricsFloat - In-App Changelog Data & Renderer
 * Separated from index.html to keep the markup lean and maintainable.
 */

const CHANGELOG_DATA = [
  {
    groupTitle: 'Version 1.2',
    isLatest: true,
    isExpanded: true,
    releases: [
      {
        version: 'v1.2.0',
        date: '260914',
        isLatest: true,
        isExpanded: true,
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

function renderChangelog(container) {
  if (!container) return;
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  CHANGELOG_DATA.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'changelog-group';

    // Group Header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.dataset.toggle = 'group';

    const groupTitleWrap = document.createElement('div');
    groupTitleWrap.style.display = 'flex';
    groupTitleWrap.style.alignItems = 'center';
    groupTitleWrap.style.gap = '6px';

    const groupArrow = document.createElement('span');
    groupArrow.className = 'group-arrow';
    groupArrow.textContent = group.isExpanded ? '▼' : '▶';

    const groupTitle = document.createElement('span');
    groupTitle.className = 'group-title';
    groupTitle.textContent = group.groupTitle;

    groupTitleWrap.appendChild(groupArrow);
    groupTitleWrap.appendChild(groupTitle);
    groupHeader.appendChild(groupTitleWrap);

    if (group.isLatest) {
      const groupBadge = document.createElement('span');
      groupBadge.className = 'group-badge';
      groupBadge.textContent = 'Latest';
      groupHeader.appendChild(groupBadge);
    }

    // Group Content
    const groupContent = document.createElement('div');
    groupContent.className = 'group-content';
    if (!group.isExpanded) {
      groupContent.style.display = 'none';
    }

    // Releases
    group.releases.forEach(release => {
      const releaseCard = document.createElement('div');
      releaseCard.className = 'release-card';

      // Release Header
      const releaseHeader = document.createElement('div');
      releaseHeader.className = 'release-header';
      releaseHeader.dataset.toggle = 'release';

      const releaseLeft = document.createElement('div');
      releaseLeft.style.display = 'flex';
      releaseLeft.style.alignItems = 'center';
      releaseLeft.style.gap = '6px';

      const releaseArrow = document.createElement('span');
      releaseArrow.className = 'release-arrow';
      releaseArrow.textContent = release.isExpanded ? '▼' : '▶';

      const releaseTag = document.createElement('span');
      releaseTag.className = 'release-tag';
      releaseTag.textContent = release.version;

      releaseLeft.appendChild(releaseArrow);
      releaseLeft.appendChild(releaseTag);

      if (release.isLatest) {
        const releaseBadge = document.createElement('span');
        releaseBadge.className = 'release-badge';
        releaseBadge.textContent = 'Latest';
        releaseLeft.appendChild(releaseBadge);
      }

      const releaseDate = document.createElement('span');
      releaseDate.className = 'release-date';
      releaseDate.textContent = release.date;

      releaseHeader.appendChild(releaseLeft);
      releaseHeader.appendChild(releaseDate);

      // Release Content
      const releaseContent = document.createElement('div');
      releaseContent.className = 'release-content';
      if (!release.isExpanded) {
        releaseContent.style.display = 'none';
      }

      // Sections
      release.sections.forEach(sec => {
        const secDiv = document.createElement('div');
        secDiv.className = 'changelog-sec';

        const tag = document.createElement('span');
        tag.className = `changelog-tag tag-${sec.type}`;
        tag.textContent = sec.title;
        secDiv.appendChild(tag);

        const ul = document.createElement('ul');
        sec.items.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${item.title}:</strong> ${item.desc}`;
          ul.appendChild(li);
        });
        secDiv.appendChild(ul);
        releaseContent.appendChild(secDiv);
      });

      releaseCard.appendChild(releaseHeader);
      releaseCard.appendChild(releaseContent);
      groupContent.appendChild(releaseCard);
    });

    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(groupContent);
    fragment.appendChild(groupDiv);
  });

  container.appendChild(fragment);

  // Setup click delegation for smooth accordion expand/collapse
  container.onclick = (e) => {
    const groupH = e.target.closest('.group-header[data-toggle="group"]');
    if (groupH) {
      const content = groupH.nextElementSibling;
      const arrow = groupH.querySelector('.group-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
      return;
    }

    const releaseH = e.target.closest('.release-header[data-toggle="release"]');
    if (releaseH) {
      const content = releaseH.nextElementSibling;
      const arrow = releaseH.querySelector('.release-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
      return;
    }
  };
}

// Auto-render if #changelog-body is present in DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const body = document.getElementById('changelog-body');
      if (body) renderChangelog(body);
    });
  } else {
    const body = document.getElementById('changelog-body');
    if (body) renderChangelog(body);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { CHANGELOG_DATA, renderChangelog };
}
