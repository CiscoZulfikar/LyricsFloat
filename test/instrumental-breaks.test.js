const assert = require('assert');
const { LyricsService } = require('../services/lyrics-service');

function runTests() {
  const service = new LyricsService();

  // 1. Explicit empty timestamp in LRC (as seen in The Weeknd - Less Than Zero)
  const lrcWithEmptyTimestamp = `[02:11.03] I try to fight it, but I'd rather be free
[02:16.65] Oh, oh, ¡huh!
[02:24.79] 
[02:47.74] I can't get it out of my head`;

  const parsed = service.parseLrc(lrcWithEmptyTimestamp, 'Less Than Zero', 'The Weeknd');
  
  // Should have intro break at 0, and interlude break at 144790ms
  assert.strictEqual(parsed[0].isBreak, true, 'Should have intro break at 0');
  assert.strictEqual(parsed[0].timeMs, 0);

  const breakLine = parsed.find(l => l.isBreak && l.timeMs > 0);
  assert.ok(breakLine, 'Must parse explicit empty timestamp as isBreak: true');
  assert.strictEqual(breakLine.timeMs, 144790, 'Break timestamp must match 02:24.79');
  assert.strictEqual(breakLine.text, '', 'Break text must be empty');

  // Punctuation should also be normalized
  const weekndLine = parsed.find(l => l.text.includes('huh'));
  assert.strictEqual(weekndLine.text, 'Oh, oh, huh!', 'Must normalize stray ¡huh! to huh!');

  // 2. Music symbols (♪, ♫, ...) treated as breaks
  const lrcWithSymbol = `[01:00.00] Singing
[01:05.00] ♪
[01:20.00] Back again`;
  const parsedSymbols = service.parseLrc(lrcWithSymbol);
  const symbolLine = parsedSymbols.find(l => l.timeMs === 65000);
  assert.ok(symbolLine, 'Must find line at 65s');
  assert.strictEqual(symbolLine.isBreak, true, '♪ line must be treated as break');

  // 3. Short/medium gaps (< 12-14s) must NOT generate breaks (protect slow singing / sustained notes)
  const lrcSlowSinging = `[00:00.00] And I will always love you
[00:10.00] Will always love you`;
  const parsedSlow = service.parseLrc(lrcSlowSinging);
  assert.strictEqual(parsedSlow.some(l => l.isBreak), false, 'Slow singing with 10s gap must NOT generate artificial break');

  // 4. Long gap (>= 14s) without explicit empty line generates synthetic break after vocal hold
  const lrcLongGap = `[00:00.00] Short line
[00:30.00] Next verse after 30s guitar solo`;
  const parsedGap = service.parseLrc(lrcLongGap);
  assert.strictEqual(parsedGap.length, 3, 'Long 30s gap must insert a synthetic instrumental break');
  assert.strictEqual(parsedGap[1].isBreak, true);
  assert.ok(parsedGap[1].timeMs >= 5000 && parsedGap[1].timeMs <= 10000, 'Synthetic break must occur after vocal hold time');

  // 5. Song intro delayed (>= 8s) generates intro break
  const lrcDelayedIntro = `[00:15.00] First lyric at 15s`;
  const parsedIntro = service.parseLrc(lrcDelayedIntro);
  assert.strictEqual(parsedIntro[0].isBreak, true, 'Intro >= 8s must generate intro break');
  assert.strictEqual(parsedIntro[0].timeMs, 0);

  // 6. Transient micro-breaks (< 6s) must NOT generate breaks (filter out 1-2s line-clears and pauses)
  const lrcMicroBreak = `[00:00.00] I hate myself to make you stay
[00:03.00] 
[00:04.50] Push me away, I'll be right here`;
  const parsedMicro = service.parseLrc(lrcMicroBreak);
  assert.strictEqual(parsedMicro.some(l => l.isBreak), false, 'Explicit empty timestamp with 1.5s gap must NOT generate an instrumental break');
  assert.strictEqual(parsedMicro.length, 2, 'Should only contain the 2 real lyric lines');

  // 7. Transient symbol micro-break (< 6s) must NOT generate breaks
  const lrcSymbolMicro = `[00:00.00] Line one
[00:02.00] ♪
[00:04.00] Line two`;
  const parsedSymbolMicro = service.parseLrc(lrcSymbolMicro);
  assert.strictEqual(parsedSymbolMicro.some(l => l.isBreak), false, 'Music symbol with only 2s gap must NOT generate an instrumental break');

  // 8. Short intro (< 8s) must NOT generate intro break
  const lrcShortIntro = `[00:03.50] First lyric at 3.5s`;
  const parsedShortIntro = service.parseLrc(lrcShortIntro);
  assert.strictEqual(parsedShortIntro.some(l => l.isBreak), false, 'Short intro < 8s must NOT generate intro break');

  console.log('Instrumental break parsing unit tests passed!');
}

runTests();
