const assert = require('assert');
const { normalizePunctuation } = require('../services/lyrics-service');

function runTests() {
  // 1. English tracks with stray Spanish punctuation
  assert.strictEqual(normalizePunctuation('Oh, oh, ¡huh!', false), 'Oh, oh, huh!');
  assert.strictEqual(normalizePunctuation('¿What do you mean?', false), 'What do you mean?');
  assert.strictEqual(normalizePunctuation('¡Yeah! We made it!', false), 'Yeah! We made it!');
  assert.strictEqual(normalizePunctuation('¿Why?', false), 'Why?');

  // 2. Spanish tracks / lines (should preserve punctuation)
  assert.strictEqual(normalizePunctuation('¡Ay! Fonsi, D.Y.', true), '¡Ay! Fonsi, D.Y.');
  assert.strictEqual(normalizePunctuation('¿Cómo estás, mi amor?', false), '¿Cómo estás, mi amor?');
  assert.strictEqual(normalizePunctuation('¡Hola corazón!', false), '¡Hola corazón!');

  console.log('Punctuation normalization unit tests passed!');
}

runTests();
