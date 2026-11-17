const assert = require('assert');
const { createArtworkLoader } = require('../src/artwork-loader');

class MockImage {
  static instances = [];

  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    MockImage.instances.push(this);
  }

  set src(value) {
    this.url = value;
  }

  load() {
    this.complete = true;
    this.naturalWidth = 100;
    this.onload();
  }

  fail() {
    this.complete = true;
    this.onerror();
  }
}

async function runTests() {
  const applied = [];
  const loadArtwork = createArtworkLoader((url) => applied.push(url), MockImage);

  const firstLoad = loadArtwork('old-cover.jpg');
  const secondLoad = loadArtwork('new-cover.jpg');
  MockImage.instances[1].load();
  assert.strictEqual(await secondLoad, true, 'Loaded current artwork should be applied');
  MockImage.instances[0].load();
  assert.strictEqual(await firstLoad, false, 'Late artwork from an older track should be ignored');
  assert.deepStrictEqual(applied, ['new-cover.jpg']);

  const failedLoad = loadArtwork('broken-cover.jpg');
  MockImage.instances[2].fail();
  assert.strictEqual(await failedLoad, false, 'Failed artwork should not be applied');
  assert.deepStrictEqual(applied, ['new-cover.jpg']);

  const cancelledLoad = loadArtwork('cancelled-cover.jpg');
  loadArtwork.cancel();
  MockImage.instances[3].load();
  assert.strictEqual(await cancelledLoad, false, 'Cancelled artwork should not be applied');

  console.log('Artwork loader tests passed successfully!');
}

runTests().catch((error) => {
  console.error('Artwork loader test failed:', error);
  process.exitCode = 1;
});
