const assert = require('assert');
const { ContinuousSuites } = require('../src/continuous-suites');
const { LyricsService } = require('../services/lyrics-service');

console.log('Running Continuous Suites & Album Transitions tests...');

// ========================================================
// 1. Verified Continuous Suites Tests
// ========================================================
const t1 = { title: 'Baptized in Fear', artist: 'The Weeknd', album: 'Hurry Up Tomorrow' };
const t2 = { title: 'Open Hearts', artist: 'The Weeknd', album: 'Hurry Up Tomorrow' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(t1, t2), true, 'Baptized in Fear -> Open Hearts should be verified suite');

const dawnFm = { title: 'Dawn FM', artist: 'The Weeknd', album: 'Dawn FM' };
const gasoline = { title: 'Gasoline', artist: 'The Weeknd', album: 'Dawn FM' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(dawnFm, gasoline), true, 'Dawn FM -> Gasoline should be verified suite');

const brainDamage = { title: 'Brain Damage', artist: 'Pink Floyd', album: 'The Dark Side of the Moon' };
const eclipse = { title: 'Eclipse', artist: 'Pink Floyd', album: 'The Dark Side of the Moon' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(brainDamage, eclipse), true, 'Brain Damage -> Eclipse should be verified suite');

// Unrelated tracks on same album must return false for isVerifiedContinuousSuite
const beatIt = { title: 'Beat It', artist: 'Michael Jackson', album: 'Thriller' };
const billieJean = { title: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(beatIt, billieJean), false, 'Beat It -> Billie Jean is not a continuous suite');

// Pattern match: Intro -> Track on same album
const introTrack = { title: 'Intro (Live)', artist: 'Artist X', album: 'Album Y' };
const mainTrack = { title: 'Main Anthem', artist: 'Artist X', album: 'Album Y' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(introTrack, mainTrack), true, 'Intro -> Main track pattern should match');

// Pattern match: Part 1 -> Part 2
const pt1 = { title: 'Shine On You Crazy Diamond (Pts. 1-5)', artist: 'Pink Floyd', album: 'Wish You Were Here' };
const pt2 = { title: 'Shine On You Crazy Diamond (Pts. 6-9)', artist: 'Pink Floyd', album: 'Wish You Were Here' };
// Different artist must be rejected
const diffArtist = { title: 'Open Hearts', artist: 'Someone Else', album: 'Other' };
assert.strictEqual(ContinuousSuites.isVerifiedContinuousSuite(t1, diffArtist), false, 'Different artist must be rejected');

console.log('✓ Verified Continuous Suites tests passed');


// ========================================================
// 2. Natural Album Handoff Tests
// ========================================================
// Natural transition: Track 1 played until 3:52 of 3:55 (durationMs: 235000, pos: 233000), Track 2 starts at 500ms
const naturalPrev = {
  title: 'Song 1',
  artist: 'Artist A',
  album: 'Album 1',
  trackNumber: 1,
  durationMs: 235000,
  positionMs: 233000
};
const naturalNext = {
  title: 'Song 2',
  artist: 'Artist A',
  album: 'Album 1',
  trackNumber: 2,
  durationMs: 210000,
  positionMs: 500
};
assert.strictEqual(ContinuousSuites.isNaturalAlbumHandoff(naturalPrev, naturalNext), true, 'Consecutive natural album handoff should be true');

// Manual skip mid-song: Song 1 at 45s of 235s
const skippedPrev = { ...naturalPrev, positionMs: 45000 };
assert.strictEqual(ContinuousSuites.isNaturalAlbumHandoff(skippedPrev, naturalNext), false, 'Manual mid-song skip must not trigger natural handoff');

// Manual jump into next track: Song 2 starts at 60s
const scrubbedNext = { ...naturalNext, positionMs: 60000 };
assert.strictEqual(ContinuousSuites.isNaturalAlbumHandoff(naturalPrev, scrubbedNext), false, 'Manual seek into next track must not trigger natural handoff');

// Different album / different artist without suite match
const unrelatedNext = {
  title: 'Random Track',
  artist: 'Unrelated Artist',
  album: 'Different Album',
  trackNumber: 1,
  durationMs: 180000,
  positionMs: 0
};
assert.strictEqual(ContinuousSuites.isNaturalAlbumHandoff(naturalPrev, unrelatedNext), false, 'Unrelated playlist jump must return false');

// Non-consecutive track numbers (e.g. Shuffle from track 1 to track 7 on same album)
const shuffleNext = { ...naturalNext, trackNumber: 7 };
assert.strictEqual(ContinuousSuites.isNaturalAlbumHandoff(naturalPrev, shuffleNext), false, 'Shuffle jump across non-consecutive tracks must return false');

console.log('✓ Natural Album Handoff tests passed');


// ========================================================
// 3. Compound Medley Splitting Tests
// ========================================================
const lyricsService = new LyricsService();

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Baptized in Fear / Open Hearts'),
  ['Baptized in Fear', 'Open Hearts'],
  'Slash compound title must split'
);

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Holiday / Boulevard of Broken Dreams'),
  ['Holiday', 'Boulevard of Broken Dreams'],
  'Slash with spaces must split'
);

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Brain Damage – Eclipse'),
  ['Brain Damage', 'Eclipse'],
  'En-dash compound title must split'
);

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Song A - Song B'),
  ['Song A', 'Song B'],
  'Spaced hyphen compound title must split'
);

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Regular Song Title'),
  [],
  'Non-compound title must return empty array'
);

assert.deepStrictEqual(
  lyricsService.splitCompoundTitle('Single Word-Word'),
  [],
  'Hyphenated word inside title without surrounding spaces must not split'
);

console.log('✓ Compound Medley Splitting tests passed');


// ========================================================
// 4. Medley Stitching & Timestamp Offset Tests
// ========================================================
const part1Mock = {
  id: 111,
  albumName: 'Hurry Up Tomorrow',
  duration: 120, // 120 seconds
  syncedLyrics: '[00:10.00] Part 1 First Line\n[01:00.00] Part 1 Second Line\n[01:50.00] Part 1 Outro Break\n',
  plainLyrics: 'Part 1 First Line\nPart 1 Second Line\nPart 1 Outro Break'
};

const part2Mock = {
  id: 222,
  albumName: 'Hurry Up Tomorrow',
  duration: 100, // 100 seconds
  syncedLyrics: '[00:05.00] Part 2 First Line\n[00:40.00] Part 2 Second Line\n',
  plainLyrics: 'Part 2 First Line\nPart 2 Second Line'
};

const stitched = lyricsService.stitchMedley(part1Mock, part2Mock, 'Baptized in Fear / Open Hearts', 'The Weeknd', 'Hurry Up Tomorrow', 220);
assert.ok(stitched, 'Stitched result should not be null');
assert.strictEqual(stitched.synced, true, 'Stitched result should be synced');
assert.strictEqual(stitched.provider.name, 'LRCLIB (Medley Stitched)');

// Part 1 first line is at 10,000ms
assert.strictEqual(stitched.lines[0].timeMs, 0, 'Auto intro break injected at 0ms');
assert.strictEqual(stitched.lines[1].timeMs, 10000, 'Part 1 first line at 10000ms');

// Part 2 first line (originally 5000ms) should be offset by 120,000ms -> 125,000ms!
const part2FirstLine = stitched.lines.find(l => l.text === 'Part 2 First Line');
assert.ok(part2FirstLine, 'Part 2 line must exist in stitched lines');
assert.strictEqual(part2FirstLine.timeMs, 125000, 'Part 2 first line must be offset by exactly 120,000ms');

// Part 2 second line (originally 40,000ms) should be offset by 120,000ms -> 160,000ms!
const part2SecondLine = stitched.lines.find(l => l.text === 'Part 2 Second Line');
assert.ok(part2SecondLine, 'Part 2 second line must exist in stitched lines');
assert.strictEqual(part2SecondLine.timeMs, 160000, 'Part 2 second line must be offset by exactly 160,000ms');

console.log('✓ Medley Stitching & Timestamp Offset tests passed');
console.log('All Continuous Suites & Album Transitions tests passed successfully!');
