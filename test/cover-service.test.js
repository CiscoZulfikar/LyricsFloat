const assert = require('assert');
const { CoverService } = require('../services/cover-service');

async function runTests() {
  console.log('Running CoverService tests...');
  const service = new CoverService();

  // Test 1: Regional Japanese track with native script and album name
  const cover1 = await service.fetchCoverUrl('晴る', 'Yorushika', '二人称');
  assert(cover1, 'Expected cover URL for 晴る by Yorushika');
  assert(cover1.includes('512x512bb') || cover1.includes('mzstatic') || cover1.includes('dzcdn'), 'Expected high-resolution cover image URL');
  console.log('✓ 晴る Yorushika cover resolved:', cover1);

  // Test 2: Western track
  const cover2 = await service.fetchCoverUrl('Rap God', 'Eminem', 'The Marshall Mathers LP2');
  assert(cover2, 'Expected cover URL for Rap God by Eminem');
  console.log('✓ Rap God Eminem cover resolved:', cover2);

  // Test 3: Memory Cache hit
  const start = Date.now();
  const cachedCover = await service.fetchCoverUrl('晴る', 'Yorushika', '二人称');
  const elapsed = Date.now() - start;
  assert.strictEqual(cachedCover, cover1, 'Expected identical cached cover URL');
  assert(elapsed < 20, `Expected memory cache hit to be instantaneous (<20ms), was ${elapsed}ms`);
  console.log(`✓ Memory cache hit confirmed (${elapsed}ms)`);

  // Test 4: Track metadata with explicitness detection
  const metaClean = await service.fetchTrackMetadata('晴る', 'Yorushika', '二人称');
  assert.strictEqual(metaClean.isExplicit, false, 'Expected 晴る to be marked clean / not explicit');
  console.log('✓ Clean track correctly marked isExplicit=false');

  const metaExplicit = await service.fetchTrackMetadata('Rap God', 'Eminem', 'The Marshall Mathers LP2');
  assert.strictEqual(metaExplicit.isExplicit, true, 'Expected Rap God to be marked explicit');
  console.log('✓ Western explicit track correctly marked isExplicit=true');

  const metaExplicit2 = await service.fetchTrackMetadata('São Paulo', 'The Weeknd');
  assert.strictEqual(metaExplicit2.isExplicit, true, 'Expected São Paulo to be marked explicit');
  console.log('✓ Bilingual explicit track correctly marked isExplicit=true');

  // Test 5: Helper function unit tests
  const { mergeContributors, extractFeaturedFromTitle, cleanTitle } = require('../services/cover-service');
  assert.strictEqual(mergeContributors('The Weeknd', ['The Weeknd', 'Daft Punk']), 'The Weeknd, Daft Punk');
  assert.strictEqual(mergeContributors('The Weeknd', ['The Weeknd']), 'The Weeknd');
  assert.strictEqual(mergeContributors('Queen', ['Queen', 'David Bowie']), 'Queen, David Bowie');
  assert.strictEqual(mergeContributors('米津玄師', ['Kenshi Yonezu']), '米津玄師');
  assert.strictEqual(mergeContributors('DAOKO', ['Kenshi Yonezu']), 'DAOKO');
  assert.strictEqual(extractFeaturedFromTitle('Timeless (feat Playboi Carti)'), 'Playboi Carti');
  assert.strictEqual(cleanTitle('Timeless (feat Playboi Carti)'), 'Timeless');
  console.log('✓ Contributor merging and title extraction helper unit tests passed');

  // Test 6: Full artist resolution for "I Feel It Coming" (Spotify GSMTC shows only The Weeknd, resolves to The Weeknd, Daft Punk)
  const metaFeelItComing = await service.fetchTrackMetadata('I Feel It Coming', 'The Weeknd', 'Starboy');
  assert(metaFeelItComing, 'Expected metadata for I Feel It Coming');
  assert.strictEqual(metaFeelItComing.artist, 'The Weeknd, Daft Punk', `Expected artist to be "The Weeknd, Daft Punk", got "${metaFeelItComing.artist}"`);
  console.log('✓ I Feel It Coming correctly resolved full artist credits:', metaFeelItComing.artist);

  // Test 7: Full artist resolution for "Starboy" (featured Daft Punk)
  const metaStarboy = await service.fetchTrackMetadata('Starboy', 'The Weeknd', 'Starboy');
  assert(metaStarboy, 'Expected metadata for Starboy');
  assert.strictEqual(metaStarboy.artist, 'The Weeknd, Daft Punk', `Expected artist to be "The Weeknd, Daft Punk", got "${metaStarboy.artist}"`);
  console.log('✓ Starboy correctly resolved full artist credits:', metaStarboy.artist);

  console.log('All CoverService tests passed successfully!');
}

runTests().catch(err => {
  console.error('CoverService test failed:', err);
  process.exit(1);
});

