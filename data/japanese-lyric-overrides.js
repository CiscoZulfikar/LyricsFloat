/**
 * LyricsFloat - Japanese Lyric Nuance Overrides Registry
 * Nuance dictionary for colloquial suffixes, counters, and lyric idioms where standard
 * morphological dictionaries (Kuromoji/IPADIC) select generic On'yomi readings.
 */

(function(root) {
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JAPANESE_LYRIC_OVERRIDES };
  }
  if (root) {
    root.JAPANESE_LYRIC_OVERRIDES = JAPANESE_LYRIC_OVERRIDES;
  }
})(typeof self !== 'undefined' ? self : this);
