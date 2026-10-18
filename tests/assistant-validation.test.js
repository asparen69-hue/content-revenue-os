'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../config/winner-fields.json');
const { validateDraft } = require('../public/assistant-validation.js');
const validate = data => validateDraft(data, schema);

test('server remains ASCII-only for BOM-less Windows PowerShell 5.1 loading', () => {
  const bytes = require('node:fs').readFileSync(require('node:path').join(__dirname, '../server.ps1'));
  assert.ok(bytes.every(byte => byte < 128));
});
test('unknown values stay absent; no invented metrics, date, source or scores', () => {
  assert.deepEqual(validate({ title: ' Belegter Titel ', views: null, followers: '  ', scorePain: '' }),
    { title: 'Belegter Titel', status: 'Discovered' });
});
test('all editable schema fields and English stored options are supported', () => {
  const data = {};
  for (const f of schema.fields.filter(f => f.type !== 'computed')) {
    data[f.key] = f.options ? f.options[0] : f.type === 'date' ? '2024-02-29'
      : f.type === 'url' ? 'https://example.com/proof' : ['number', 'money', 'score'].includes(f.type) ? 2 : 'Belegt';
  }
  assert.deepEqual(validate(data), data);
});
test('explicit zero is preserved and German decimal money is accepted', () => {
  assert.deepEqual(validate({ title: 'x', views: 0, ownSales: '0', offerPrice: '49,90', scorePain: '10' }),
    { title: 'x', views: 0, ownSales: 0, offerPrice: 49.9, scorePain: 10, status: 'Discovered' });
});
for (const [name, data] of [
  ['array', []], ['null', null], ['scalar', 4], ['missing title', {}], ['blank title', { title: ' ' }],
  ...[true, false, [], [1], {}, -1, 1.5, '1e3', '0x10', 'Infinity', 1e100].map(views => ['invalid number ' + JSON.stringify(views), { title: 'x', views }]),
  ...[0, 11, 1.5].map(scorePain => ['invalid score ' + scorePain, { title: 'x', scorePain }]),
  ...['2025-02-29', '2026-02-30', '2026-04-31', '0000-01-01', '2026-13-01', '18.10.2026'].map(dateDiscovered => ['invalid date ' + dateDiscovered, { title: 'x', dateDiscovered }]),
  ...['https://', 'https://example.com/a b', 'javascript:alert(1)', 'https://' + 'a'.repeat(2000)].map(sourceUrl => ['invalid URL ' + sourceUrl.slice(0, 25), { title: 'x', sourceUrl }]),
  ['translated option', { title: 'x', platform: 'Sonstiges' }],
  ['premature approval', { title: 'x', status: 'Approved for test' }],
  ['winner', { title: 'x', status: 'Winner' }],
  ['computed field', { title: 'x', overallScore: 80 }],
  ['ID cannot overwrite existing data', { title: 'x', id: 'existing' }],
  ['unknown field', { title: 'x', invented: 1 }],
  ['oversized text', { title: 'x', notes: 'x'.repeat(20001) }],
  ['nested text', { title: 'x', notes: { text: 'x' } }],
  ['prototype property', JSON.parse('{"title":"x","__proto__":{"polluted":true}}')],
]) test(name, () => assert.throws(() => validate(data)));

test('valid leap day, URL and score boundaries pass', () => {
  assert.equal(validate({ title: 'x', ownPublishDate: '2024-02-29', sourceUrl: 'https://example.com', scorePain: 1 }).scorePain, 1);
});
