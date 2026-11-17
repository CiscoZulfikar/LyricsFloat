/**
 * LyricsFloat - Color Themes Registry
 * CSS class names corresponding to available application themes.
 */

(function(root) {
  const THEMES = [
    'theme-neon-violet',
    'theme-cyberpunk-cyan',
    'theme-crimson-sunset',
    'theme-emerald-glass',
    'theme-nordic-frost'
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { THEMES };
  }
  if (root) {
    root.THEMES = THEMES;
  }
})(typeof self !== 'undefined' ? self : this);
