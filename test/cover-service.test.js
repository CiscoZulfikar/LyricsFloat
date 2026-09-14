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

  console.log('All CoverService tests passed successfully!');
}

runTests().catch(err => {
  console.error('CoverService test failed:', err);
  process.exit(1);
});
