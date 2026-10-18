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
  assert.equal(await race.locator('#approval').isDisabled(), true);
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
});
