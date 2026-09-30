const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');

function runTest() {
  console.log('Running Media Source Filter tests...');

  const getMediaScript = path.join(__dirname, '..', 'services', 'get-media.ps1');
  const mockFilterScript = path.join(__dirname, 'mock-media-filter.ps1');

  // 1. Verify Test-IsAllowedSession logic via PowerShell script
  const psOutput = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${mockFilterScript}"`, {
    encoding: 'utf8'
  });
  console.log(psOutput.trim());

  // 2. Test live get-media.ps1 script execution without syntax or runtime crashes
  const liveOutput = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${getMediaScript}"`, {
    encoding: 'utf8'
  });
  const parsed = JSON.parse(liveOutput.trim());
  assert.ok(typeof parsed === 'object', 'Output must be a valid JSON object');
  if (parsed.Title) {
    console.log(`Live track detected: "${parsed.Title}" by "${parsed.Artist}" (Source: ${parsed.Source})`);
    assert.ok(
      parsed.Source === 'GSMTC' || parsed.Source === 'WindowTitle' || parsed.Source === 'Win32EnumWindows',
      'Source must be valid'
    );
  } else {
    console.log('No active allowed track currently playing (empty JSON received as expected).');
  }

  // 3. Test fixCP437Mojibake correctly restores CP437 mojibake strings to original CJK
  const { fixCP437Mojibake } = require('../services/media-watcher');
  assert.strictEqual(fixCP437Mojibake('σ╣│Φíîτ╖Ü'), '平行線', 'Must restore CP437 mojibake for 平行線');
  assert.strictEqual(fixCP437Mojibake('Sayuri'), 'Sayuri', 'Normal Latin strings must remain unchanged');
  assert.strictEqual(fixCP437Mojibake('平行線'), '平行線', 'Proper Unicode CJK strings must remain unchanged');
  console.log('fixCP437Mojibake tests passed successfully!');

  console.log('All Media Source Filter tests passed successfully!');
}

runTest();
