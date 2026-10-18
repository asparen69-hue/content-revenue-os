'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseJson, request, readJsonFile } = require('../public/ui-helpers.js');

test('German JSON guidance replaces native parser errors', () => {
  assert.throws(() => parseJson(''), /Bitte zuerst/);
  for (const text of ['{"title":}', '{“title”:“x”}', '{"title":"x",}', 'Hier ist das JSON: {"title":"x"}']) {
    assert.throws(() => parseJson(text, true), /Das JSON ist nicht gültig.*Anführungszeichen/);
  }
});
test('only a complete enclosing Markdown block is removed', () => {
  assert.deepEqual(parseJson('```json\n{"title":"x"}\n```', true), { title: 'x' });
  assert.deepEqual(parseJson('```\n{"title":"x"}\n```', true), { title: 'x' });
  assert.throws(() => parseJson('```json\n{"title":"x"}\n```'));
  assert.throws(() => parseJson('Text\n```json\n{"title":"x"}\n```', true));
  assert.throws(() => parseJson('```json\n{"title":"x"}\n```\nWeiterer Text', true));
});
test('unreadable import file has German guidance', async () => {
  await assert.rejects(readJsonFile({ text: async () => { throw Error('NotReadableError'); } }), /Datei konnte nicht gelesen werden/);
  assert.deepEqual(await readJsonFile({ text: async () => '[{"title":"x"}]' }), [{ title: 'x' }]);
});
test('failed read and uncertain write have German guidance; no automatic retry', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(request('GET', '/api/schema'), /Keine Verbindung/);
  await assert.rejects(request('POST', '/api/import', []), /zuerst in der Library prüfen/);
  assert.equal(calls, 2);
});
test('unreadable server response has German guidance', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ json: async () => { throw new SyntaxError('Unexpected token'); } }));
  await assert.rejects(request('GET', '/api/schema'), /keine lesbare JSON-Antwort/);
});
test('server approval error and validation details are preserved', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ error: 'Der Import wurde nicht freigegeben.', details: ['Titel fehlt.'] }) }));
  await assert.rejects(request('POST', '/api/import', []), error => {
    assert.match(error.message, /nicht freigegeben/);
    assert.deepEqual(error.details, ['Titel fehlt.']); return true;
  });
});
test('successful imports send exactly the approved payload once', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++; assert.equal(url, '/api/import');
    assert.equal(options.headers['X-Winner-Import-Approved'], 'true');
    assert.deepEqual(JSON.parse(options.body), [{ title: 'Belegt' }]);
    return { ok: true, json: async () => ({ added: 1 }) };
  });
  assert.deepEqual(await request('POST', '/api/import', [{ title: 'Belegt' }], { 'X-Winner-Import-Approved': 'true' }), { added: 1 });
  assert.equal(calls, 1);
});
