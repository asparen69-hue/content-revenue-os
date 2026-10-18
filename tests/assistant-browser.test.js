// Developer test only: Node + Playwright + Chromium + PowerShell, no product dependencies.
// WINNER_TEST_POWERSHELL may point to pwsh on Linux. Tests use a disposable store.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

test('real browser: CSP, evidence prompt, draft approval, invalidation and confirmed import', async t => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'winner-browser-'));
  let server, browser;
  t.after(async () => {
    if (browser) await browser.close();
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill(); await exited;
    }
    await fs.rm(temp, { recursive: true, force: true });
  });
  for (const name of ['server.ps1', 'public', 'config']) await fs.cp(path.join(root, name), path.join(temp, name), { recursive: true });
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const base = `http://localhost:${port}`;
  server = spawn(process.env.WINNER_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell' : 'pwsh'),
    ['-NoProfile', '-File', path.join(temp, 'server.ps1'), '-NoBrowser', '-Port', String(port)]);
  let output = '', startError;
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  server.on('error', error => { startError = error; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (startError) throw startError;
    if (server.exitCode !== null) throw Error(output);
    try { ready = (await fetch(base + '/api/health')).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  const store = path.join(temp, 'data', 'winners.json');
  const before = await fs.readFile(store, 'utf8');
  browser = await chromium.launch({ executablePath: process.env.WINNER_TEST_CHROMIUM || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined), headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  await context.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('request', req => { if (req.method() !== 'GET') writes.push(req); });
  await page.goto(base + '/assistant.html');
  await page.locator('#source').fill('Titel: Belegter Titel. Aufrufe unbekannt.');
  await page.locator('#prompt').click();
  await page.waitForFunction(() => document.getElementById('result').textContent === 'Analyseauftrag kopiert.');
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(prompt, /niemals durch 0 ersetzen/);
  assert.match(prompt, /own\*-Felder/);
  assert.match(prompt, /scorePain \[score\]/);
  assert.match(prompt, /Belegter Titel/);

  const draft = { title: 'Belegter Titel', views: null, scorePain: '', researchSource: 'ChatGPT' };
  const check = async data => {
    await page.locator('#json').fill(JSON.stringify(data));
    await page.locator('#check').click();
    await page.waitForFunction(() => document.getElementById('result').textContent.length > 0);
  };
  await check({ title: 'x', views: true });
  assert.equal(await page.locator('#export').isDisabled(), true);
  await check(draft);
  assert.equal(await page.locator('#export').isDisabled(), true);
  await page.locator('#approval').check();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported, [{ title: draft.title, researchSource: 'ChatGPT', status: 'Discovered' }]);
  assert.equal(await fs.readFile(store, 'utf8'), before);
  assert.equal(writes.length, 0);
  await page.locator('#json').fill('{"title":"Changed"}');
  assert.equal(await page.locator('#approval').isChecked(), false);
  assert.equal(await page.locator('#export').isDisabled(), true);
  await check(draft);
  await page.locator('#approval').check();
  await page.locator('#source').fill('Neue Quelle');
  assert.equal(await page.locator('#approval').isChecked(), false);
  assert.equal(await page.locator('#export').isDisabled(), true);
  await check({ title: '<img src=x onerror=alert(1)>' });
  assert.equal(await page.locator('#preview img').count(), 0);

  // A response that arrives after an input change must not approve an outdated draft.
  const race = await context.newPage();
  let releaseSchema, schemaRequested;
  const requested = new Promise(resolve => { schemaRequested = resolve; });
  const blocked = new Promise(resolve => { releaseSchema = resolve; });
  await race.route('**/api/schema', async route => { schemaRequested(); await blocked; await route.continue(); });
  await race.goto(base + '/assistant.html');
  await race.locator('#json').fill('{"title":"old"}');
  await race.locator('#check').click();
  await requested;
  await race.locator('#json').fill('{"title":"new"}');
  const schemaResponse = race.waitForResponse('**/api/schema');
  releaseSchema(); await schemaResponse;
  await race.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await race.waitForFunction(() => !document.getElementById('approval').disabled);
  assert.equal(await race.locator('#approval').isChecked(), false);
  assert.match(await race.locator('#preview').textContent(), /new/);
  assert.equal(await race.locator('#export').isDisabled(), true);

  // An upload and a cancelled confirmation never send a write request.
  await page.goto(base + '/');
  await page.waitForSelector('#items-body');
  const payload = { name: 'winner-entwurf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) };
  await page.locator('#import-file').setInputFiles(payload);
  await page.locator('#modal:not(.hidden)').waitFor();
  assert.equal(await fs.readFile(store, 'utf8'), before);
  await page.locator('#modal-cancel').click();
  assert.equal(writes.length, 0);
  await page.locator('#import-file').setInputFiles([]);
  await page.locator('#import-file').setInputFiles(payload);
  await page.locator('#modal:not(.hidden)').waitFor();
  const imported = page.waitForResponse(r => r.url().endsWith('/api/import') && r.request().method() === 'POST');
  await page.locator('#modal-confirm').click();
  assert.equal((await imported).status(), 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].headers()['x-winner-import-approved'], 'true');
  const records = await (await fetch(base + '/api/items')).json();
  assert.equal(records.filter(r => r.title === draft.title).length, 1);
  assert.equal(records.find(r => r.title === draft.title).views, null);
  assert.ok((await fs.readdir(path.join(temp, 'data/backups'))).some(name => name.startsWith('winners-before-import-')));
  assert.deepEqual(errors, []);

  // Direct assistant import removes the file round trip, never the explicit approval.
  const direct = await context.newPage(), directWrites = [], directErrors = [];
  direct.on('request', req => { if (req.method() !== 'GET') directWrites.push(req); });
  direct.on('pageerror', error => directErrors.push(error.message));
  await direct.goto(base + '/assistant.html');
  await direct.locator('#json').fill('{"title":}');
  await direct.waitForFunction(() => document.getElementById('result').textContent.includes('Das JSON ist nicht gültig'));
  assert.equal(await direct.locator('#import').isDisabled(), true);
  await direct.locator('#json').fill('```json\n{"title":"Direkter Entwurf","platform":"Other","views":null}\n```');
  await direct.waitForFunction(() => !document.getElementById('approval').disabled);
  assert.match(await direct.locator('#field-preview').textContent(), /PlattformSonstiges/);
  assert.equal(await direct.locator('#import').isDisabled(), true);
  assert.equal(directWrites.length, 0);
  const beforeDirect = await fs.readFile(store, 'utf8');
  await direct.locator('#approval').check();
  await direct.locator('#import').click();
  await direct.locator('#import-cancel').click();
  assert.equal(directWrites.length, 0);
  await direct.locator('#import').click();
  await direct.keyboard.press('Escape');
  assert.equal(directWrites.length, 0);
  await direct.locator('#import').click();
  await direct.evaluate(() => {
    const input = document.getElementById('json');
    input.value = '{"title":"Aktueller Entwurf"}'; input.dispatchEvent(new Event('input'));
    document.getElementById('import-confirm').click();
  });
  assert.equal(await direct.locator('#import-dialog').evaluate(el => el.open), false);
  assert.equal(directWrites.length, 0);
  await direct.waitForFunction(() => !document.getElementById('approval').disabled);
  await direct.locator('#approval').check();
  let releaseImport, importRequested;
  const waitImport = new Promise(resolve => { importRequested = resolve; });
  const importGate = new Promise(resolve => { releaseImport = resolve; });
  await direct.route('**/api/import', async route => { importRequested(); await importGate; await route.continue(); });
  await direct.locator('#import').click();
  await direct.locator('#import-confirm').click();
  await waitImport;
  assert.equal(await direct.locator('#json').isDisabled(), true);
  assert.equal(await direct.locator('#import').isDisabled(), true);
  assert.equal(await fs.readFile(store, 'utf8'), beforeDirect);
  await direct.evaluate(() => document.getElementById('import-confirm').click());
  const directResponse = direct.waitForResponse('**/api/import');
  releaseImport();
  assert.equal((await directResponse).status(), 200);
  await direct.waitForFunction(() => document.getElementById('import-result').textContent.startsWith('Import abgeschlossen'));
  assert.equal(directWrites.length, 1);
  assert.equal(directWrites[0].headers()['x-winner-import-approved'], 'true');
  assert.deepEqual(JSON.parse(directWrites[0].postData()), [{ title: 'Aktueller Entwurf', status: 'Discovered' }]);
  assert.equal(await direct.locator('#import').isDisabled(), true);
  assert.equal((await (await fetch(base + '/api/items')).json()).filter(r => r.title === 'Aktueller Entwurf').length, 1);

  // Denied clipboard access leaves a usable, local manual-copy fallback.
  await direct.goto(base + '/assistant.html');
  await direct.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('NotAllowedError'); }; });
  await direct.locator('#source').fill('Titel: Belegt');
  await direct.locator('#prompt').click();
  await direct.locator('#prompt-fallback').waitFor({ state: 'visible' });
  assert.match(await direct.locator('#result').textContent(), /Zwischenablage ist gesperrt/);
  assert.match(await direct.locator('#prompt-text').inputValue(), /Titel: Belegt/);
  await direct.locator('#source').fill('Andere Quelle');
  assert.equal(await direct.locator('#prompt-fallback').isHidden(), true);

  // Server refusal or an uncertain network outcome must not trigger an automatic retry.
  await direct.unroute('**/api/import');
  const afterDirect = await fs.readFile(store, 'utf8');
  for (const networkFailure of [false, true]) {
    await direct.goto(base + '/assistant.html');
    await direct.route('**/api/import', route => networkFailure ? route.abort('failed') : route.fulfill({
      status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Der Import wurde nicht freigegeben. Es wurde nichts importiert.' }),
    }));
    await direct.locator('#json').fill('{"title":"Nicht importieren"}');
    await direct.waitForFunction(() => !document.getElementById('approval').disabled);
    await direct.locator('#approval').check();
    await direct.locator('#import').click();
    await direct.locator('#import-confirm').click();
    await direct.waitForFunction(() => document.getElementById('import-result').className === 'error');
    assert.match(await direct.locator('#import-result').textContent(), networkFailure ? /zuerst in der Library prüfen/ : /nicht freigegeben/);
    assert.equal(await direct.locator('#import').isDisabled(), true);
    assert.equal(await fs.readFile(store, 'utf8'), afterDirect);
    await direct.unroute('**/api/import');
  }
  assert.equal(directWrites.length, 3);
  assert.deepEqual(directErrors, []);

});
