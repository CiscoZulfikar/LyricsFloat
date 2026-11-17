/**
 * LyricsFloat - Lyric Expression & Idiom Translation Registry
 * Contextual lyric expressions and mimetic idioms mapped by target language.
 */

(function(root) {
  const LYRIC_EXPRESSION_MAP = {
    en: {
      'カミナッチャ': 'Coming at ya',
      'のらりくらり': 'Nonchalantly',
      'のらりくらりと': 'Evasively',
      'ゆらりゆらり': 'Swaying gently',
      'ゆらりゆらりと': 'Swaying gently',
      'ゆらゆら': 'Swaying back and forth',
      'ゆらゆらと': 'Swaying back and forth',
      'ふらふら': 'Wandering aimlessly',
      'ふらふらと': 'Wandering aimlessly',
      'うろうろ': 'Wandering around',
      'うろうろと': 'Wandering around',
      'きらきら': 'Sparkling bright',
      'きらきらと': 'Sparkling bright',
      'ギラギラ': 'Dazzling glare',
      'ギラギラと': 'Dazzling glare',
      '燦々と': 'Brilliantly',
      'さんさんと': 'Brilliantly'
    },
    id: {
      'のらりくらり': 'Bermalas-malasan',
      'のらりくらりと': 'Mengelak',
      'ゆらりゆらり': 'Bergoyang perlahan',
      'ゆらりゆらりと': 'Bergoyang perlahan',
      'ゆらゆら': 'Terombang-ambing',
      'ふらふら': 'Berkeliaran tanpa tujuan',
      'きらきら': 'Berkilauan',
      'ギラギラ': 'Menyilaukan',
      'カミナッチャ': 'Datang padamu'
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LYRIC_EXPRESSION_MAP };
  }
  if (root) {
    root.LYRIC_EXPRESSION_MAP = LYRIC_EXPRESSION_MAP;
  }
})(typeof self !== 'undefined' ? self : this);
