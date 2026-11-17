/**
 * LyricsFloat - Standalone Kanji Fallback Romaji Registry
 * Fallback romaji map for standalone rare/Joyo kanji that Kuromoji's IPADIC flags as UNKNOWN.
 */

(function(root) {
  const KANJI_FALLBACK_ROMAJI = {
    '怨': 'on', '儺': 'na', '鬱': 'utsu', '憬': 'kei', '箋': 'sen',
    '苛': 'ka', '蔑': 'betsu', '毀': 'ki', '緻': 'chi', '傲': 'gō',
    '氾': 'han', '璧': 'heki', '呪': 'juso', '譚': 'tan', '廻': 'kai',
    '繋': 'tsunagi', '呟': 'tsubuyaki', '弄': 'rō', '醒': 'sei', '彷': 'hō',
    '徨': 'kō', '儚': 'hakanai', '綻': 'hokorobi', '仄': 'hono', '掠': 'kasuri',
    '歪': 'hizumi', '蝕': 'shoku', '謳': 'ō', '錆': 'sabi', '儘': 'mama',
    '其': 'sono', '氣': 'ki', '遊': 'asobi', '際': 'kiwa',
    '疼': 'uzuki', '軋': 'kishimi', '轢': 'reki', '嘲': 'azawari', '煽': 'aori',
    '蠢': 'ugomeki', '慄': 'ritsu', '悶': 'mon', '憐': 'awaremi', '悍': 'kan'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KANJI_FALLBACK_ROMAJI };
  }
  if (root) {
    root.KANJI_FALLBACK_ROMAJI = KANJI_FALLBACK_ROMAJI;
  }
})(typeof self !== 'undefined' ? self : this);
