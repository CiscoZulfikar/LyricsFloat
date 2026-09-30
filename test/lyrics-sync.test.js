const assert = require('assert');
const { LyricsSyncEngine } = require('../src/lyrics-sync');

function createMockContainer() {
  const elements = new Map();
  const container = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 200,
    innerHTML: '',
    children: [],
    appendChild: () => {},
    addEventListener: () => {},
    getBoundingClientRect: () => ({
      top: 50,
      bottom: 250,
      height: 200
    }),
    querySelector: (sel) => {
      const match = sel.match(/\[data-index="(\d+)"\]/);
      if (match) {
        return elements.get(parseInt(match[1], 10)) || null;
      }
      if (sel === '.lyrics-provider-footer') {
        return elements.get('footer') || null;
      }
      if (sel === '.lyric-line.active') {
        for (const el of elements.values()) {
          if (el.classList.contains('active')) return el;
        }
        return null;
      }
      return null;
    }
  };

  function addElement(key, top, height, isLast = false) {
    const classList = new Set();
    const elem = {
      offsetTop: top,
      clientHeight: height,
      dataset: { index: String(key) },
      classList: {
        add: (c) => classList.add(c),
        remove: (c) => classList.delete(c),
        contains: (c) => classList.has(c)
      },
      getBoundingClientRect: () => ({
        top: 50 + top - container.scrollTop,
        bottom: 50 + top - container.scrollTop + height,
        height: height
      })
    };
    elements.set(key, elem);
    return elem;
  }

  return { container, elements, addElement };
}

async function runTests() {
  console.log('Running LyricsSyncEngine tests...');

  // 1. Coordinate calculation test
  const { container, elements, addElement } = createMockContainer();
  addElement(0, 0, 30);
  addElement(1, 40, 30);
  addElement(2, 80, 40);
  addElement(3, 130, 40, true);
  addElement('footer', 180, 50);

  const engine = new LyricsSyncEngine(container);
  engine.lines = [
    { timeMs: 0, text: 'Line 0' },
    { timeMs: 5000, text: 'Line 1' },
    { timeMs: 10000, text: 'Line 2' },
    { timeMs: 15000, text: 'Line 3' }
  ];
  engine.durationMs = 25000;

  // Test getElementScrollTop
  const top1 = engine.getElementScrollTop(elements.get(1));
  assert.strictEqual(top1, 40, 'getElementScrollTop should be invariant to scroll position');
  container.scrollTop = 25;
  const top1Scrolled = engine.getElementScrollTop(elements.get(1));
  assert.strictEqual(top1Scrolled, 40, 'getElementScrollTop should remain 40 even when scrolled');
  container.scrollTop = 0;

  // 2. Center positioning at 42% height
  engine.setActiveIndex(2);
  // elemTop = 80, elemHeight = 40, containerHeight = 200
  // targetScrollTop = 80 - (200 * 0.42) + (40 / 2) = 80 - 84 + 20 = 16
  assert.strictEqual(engine.targetScrollTop, 16, 'Active line center should align with 42% container height');

  // 3. Final lyric line should NOT prematurely jump to footer credits while audio is still playing
  engine.syncPosition(16000); // Line 3 active, 16s into 25s song (9 seconds left)
  assert.strictEqual(engine.activeIndex, 3, 'Line 3 should be active index');
  assert.strictEqual(engine.hasScrolledToCredits, false, 'Should not have scrolled to credits 9 seconds before track end');

  // 4. Transition to credits ONLY within final 2 seconds
  engine.syncPosition(23500); // 1.5 seconds remaining
  assert.strictEqual(engine.hasScrolledToCredits, true, 'Should scroll to credits within 2s of track end');

  // 5. User scrolling and jump to active recovery
  engine.isUserScrolling = true;
  engine.syncPosition(18000);
  assert.strictEqual(engine.isUserScrolling, true);
  engine.jumpToActive();
  assert.strictEqual(engine.isUserScrolling, false, 'jumpToActive should clear isUserScrolling');

  // 6. Scrubbing behavior: direct snapping without lerp lag or fighting
  engine.isScrubbing = true;
  engine.scrubTo(10500); // Should jump directly to line 2
  assert.strictEqual(engine.activeIndex, 2, 'Line 2 should be active during scrubTo');
  assert.strictEqual(container.scrollTop, 16, 'scrollTop should snap directly to line 2 during scrub');
  engine.isScrubbing = false;

  // 7. Test showLoading and capabilities
  engine.lines = [
    { timeMs: 1000, text: 'Hello', romaji: 'Konnichiwa', translation: 'Hello' }
  ];
  assert.strictEqual(engine.hasRomaji(), true, 'hasRomaji should be true when romaji present');
  assert.strictEqual(engine.hasTranslation(), true, 'hasTranslation should be true when translation present');

  engine.lines = [
    { timeMs: 1000, text: 'Hello', romaji: '', translation: '' }
  ];
  assert.strictEqual(engine.hasRomaji(), false, 'hasRomaji should be false when romaji empty');
  assert.strictEqual(engine.hasTranslation(), false, 'hasTranslation should be false when translation empty');

  engine.showLoading('Next Song', 'Artist', 80);
  assert.strictEqual(engine.lines.length, 0, 'showLoading should reset lines');
  assert.strictEqual(engine.activeIndex, -1, 'showLoading should reset activeIndex');
  assert.strictEqual(container.scrollTop, 0, 'showLoading should reset scrollTop to 0');
  assert.ok(container.innerHTML.includes('lyrics-loading-state'), 'showLoading should render loading state');

  // 8. Watchdog timeout fallback to unavailable state
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.ok(container.innerHTML.includes('Lyrics unavailable for this track'), 'Watchdog should transition from loading to unavailable');

  // 9. loadLyrics cancels watchdog timeout
  engine.showLoading('Another Song', 'Artist', 80);
  assert.ok(container.innerHTML.includes('lyrics-loading-state'));
  engine.loadLyrics({ lines: [] });
  assert.strictEqual(engine.loadingWatchdogTimeout, null, 'loadLyrics should clear watchdog timeout');
  assert.ok(container.innerHTML.includes('Lyrics unavailable for this track'));

  // 9b. Glitch prevention: repeated loadLyrics with empty lines does not rewrite DOM if already unavailable
  const prevHtml = container.innerHTML;
  let domWrote = false;
  const originalDesc = Object.getOwnPropertyDescriptor(container, 'innerHTML');
  Object.defineProperty(container, 'innerHTML', {
    get() { return prevHtml; },
    set(_v) { domWrote = true; },
    configurable: true
  });
  engine.loadLyrics({ lines: [] });
  assert.strictEqual(domWrote, false, 'Repeated loadLyrics with empty lines must NOT rewrite DOM or cause reflow glitch');
  if (originalDesc) {
    Object.defineProperty(container, 'innerHTML', originalDesc);
  } else {
    delete container.innerHTML;
    container.innerHTML = prevHtml;
  }

  // Cancel animation loop for clean exit
  engine.destroy();

  // 10. isSubtextDuplicate tests
  const { isSubtextDuplicate } = require('../src/lyrics-sync');
  assert.strictEqual(isSubtextDuplicate('Hello world', 'Hello world'), true);
  assert.strictEqual(isSubtextDuplicate('Hello world!', 'Hello World'), true);
  assert.strictEqual(isSubtextDuplicate('like \u0399 have got', 'like I have got'), true, 'Greek Iota homoglyph must be detected as duplicate');
  assert.strictEqual(isSubtextDuplicate('Different text', 'Hello world'), false);

  // 11. Intro test: First line must NOT light up before its timestamp
  const introTest = createMockContainer();
  introTest.addElement(0, 0, 30);
  introTest.addElement(1, 40, 30);
  introTest.addElement(2, 80, 40);

  const introEngine = new LyricsSyncEngine(introTest.container);
  introEngine.lines = [
    { timeMs: 53370, text: 'Stole a key' },
    { timeMs: 57470, text: 'Took a car downtown where the lost boys meet' }
  ];
  introEngine.durationMs = 285000;

  // At 46s (intro before line 0 starts at 53.37s)
  introEngine.syncPosition(46000);
  assert.strictEqual(introEngine.activeIndex, -1, 'First line should NOT be active before 53.37s');
  assert.strictEqual(introTest.elements.get(0).classList.contains('active'), false, 'Line 0 must not have active class before its timestamp');

  // Once reaching 53.37s
  introEngine.syncPosition(53370);
  assert.strictEqual(introEngine.activeIndex, 0, 'First line should become active at 53.37s');
  assert.strictEqual(introTest.elements.get(0).classList.contains('active'), true, 'Line 0 must have active class once reached');

  // Scrubbing back to intro (e.g. 20s)
  introEngine.scrubTo(20000);
  assert.strictEqual(introEngine.activeIndex, -1, 'Scrubbing back to intro should deactivate line 0');
  assert.strictEqual(introTest.elements.get(0).classList.contains('active'), false, 'Line 0 must lose active class when scrubbed back to intro');
  introEngine.isScrubbing = false;

  // 12. Rewind test: rewinding back to 0:00 resets sync position and retains loaded lyrics
  introEngine.syncPosition(58000);
  assert.strictEqual(introEngine.activeIndex, 1, 'Line 1 should be active at 58s');
  introEngine.syncPosition(0);
  assert.strictEqual(introEngine.activeIndex, -1, 'Rewind to 0 should reset activeIndex to -1');
  assert.strictEqual(introEngine.lines.length, 2, 'Rewind must NEVER wipe loaded lyrics lines');
  assert.strictEqual(introEngine.targetScrollTop, 0, 'Rewind to 0 must reset targetScrollTop to 0');

  introEngine.destroy();

  // 13. Pending translation race condition test:
  // updateTranslations called while lines are empty caches pendingTranslations, which loadLyrics then consumes
  const raceTest = createMockContainer();
  const raceEngine = new LyricsSyncEngine(raceTest.container);
  raceEngine.updateTranslations({
    lines: [
      { timeMs: 162510, translation: 'Everything that lives dies one day' },
      { timeMs: 173550, translation: 'Whether we are ready to die or not' }
    ]
  });
  assert.ok(raceEngine.pendingTranslations, 'pendingTranslations should be cached when lines are not yet populated');
  assert.strictEqual(raceEngine.pendingTranslations.lines.length, 2);

  const rawData = {
    lines: [
      { timeMs: 162510, original: 'Alles Lebendige stirbt eines Tages', translation: '' },
      { timeMs: 173550, original: 'Ob wir zum Sterben bereit sind oder nicht', translation: '' }
    ]
  };
  global.document = {
    createDocumentFragment: () => ({ appendChild: () => {} }),
    createElement: () => {
      const classList = new Set();
      return {
        className: '',
        style: {},
        classList: { add: (c) => classList.add(c), remove: (c) => classList.delete(c), contains: (c) => classList.has(c) },
        appendChild: () => {},
        querySelector: () => null,
        dataset: {}
      };
    }
  };
  raceEngine.loadLyrics(rawData);
  assert.strictEqual(raceEngine.lines[0].translation, 'Everything that lives dies one day');
  assert.strictEqual(raceEngine.lines[1].translation, 'Whether we are ready to die or not');
  assert.strictEqual(raceEngine.hasTranslation(), true);
  assert.strictEqual(raceEngine.pendingTranslations, null, 'pendingTranslations should be cleared after being consumed');
  raceEngine.destroy();

  console.log('All LyricsSyncEngine tests passed successfully!');
}

runTests().catch(err => {
  console.error('LyricsSyncEngine test failed:', err);
  process.exit(1);
});
