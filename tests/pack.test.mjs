import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIncidentPack } from '../src/pack.js';

test('parseIncidentPack splits @@ section @@ blocks and normalizes supported section names', () => {
  const pack = parseIncidentPack([
    '@@ CURRENT @@',
    `TypeError: Cannot read properties of undefined (reading 'name')`,
    '    at renderProfile (/app/src/profile.js:88:17)',
    '',
    '@@ History Casebook @@',
    '=== release-2026-04-15 ===',
    `TypeError: Cannot read properties of undefined (reading 'name')`,
    '    at renderProfile (/app/src/profile.js:88:17)',
  ].join('\n'));

  assert.deepEqual(pack.sectionOrder, ['current', 'history']);
  assert.match(pack.sections.current, /renderProfile/);
  assert.match(pack.sections.history, /=== release-2026-04-15 ===/);
  assert.deepEqual(pack.unknownSections, []);
});

test('parseIncidentPack ignores unknown sections and appends duplicate supported sections', () => {
  const pack = parseIncidentPack([
    '@@ current @@',
    'alpha',
    '',
    '@@ notes @@',
    'ignore me',
    '',
    '@@ current @@',
    'beta',
  ].join('\n'));

  assert.deepEqual(pack.sectionOrder, ['current']);
  assert.equal(pack.sections.current, 'alpha\n\nbeta');
  assert.deepEqual(pack.unknownSections, ['notes']);
});

test('parseIncidentPack normalizes CRLF input for copy-paste friendly packs', () => {
  const pack = parseIncidentPack('@@ current @@\r\ntrace\r\n\r\n@@ baseline @@\r\nolder');

  assert.deepEqual(pack.sectionOrder, ['current', 'baseline']);
  assert.equal(pack.sections.current, 'trace');
  assert.equal(pack.sections.baseline, 'older');
});
