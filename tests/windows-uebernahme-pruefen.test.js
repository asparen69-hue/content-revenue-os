'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const manifest = require('../tools/windows-uebernahme-manifest.json');
const target = '696448925c4a3507a38a7cb7039e0dbd20a5bbb0';
const base = 'e834f80f08d0cbca039c60c701eabd8e14bad1e7';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = bytes => Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
function blob(ref, file) {
  const result = spawnSync('git', ['show', ref + ':' + file], { cwd: project });
  return result.status === 0 ? result.stdout : null;
}
function fixture(t, ref = base) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'winner-preflight-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const library = path.join(root, 'library');
  for (const file of manifest.files) {
    const bytes = blob(ref, file.path);
    if (!bytes) continue;
    const name = path.join(library, file.path);
    fs.mkdirSync(path.dirname(name), { recursive: true });
    // Windows checkouts may use CRLF and a BOM; neither is a local code change.
    fs.writeFileSync(name, '\uFEFF' + bytes.toString('utf8').replace(/\r?\n/g, '\r\n'));
  }
  fs.mkdirSync(path.join(library, 'data/backups'), { recursive: true });
  fs.writeFileSync(path.join(library, 'data/winners.json'), '[{"private":"untouched test data"}]');
  fs.writeFileSync(path.join(library, 'data/backups/keep.json'), 'original backup');
  fs.writeFileSync(path.join(library, '.env'), 'test secret, never report');
  fs.writeFileSync(path.join(library, 'public/styles.css'), 'custom styles must stay untouched');
  return { root, library, report: path.join(root, 'report') };
}
function inventory(dir) {
  const result = {};
  for (const item of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!item.isFile()) continue;
    const full = path.join(item.parentPath, item.name);
    result[path.relative(dir, full)] = sha(fs.readFileSync(full));
  }
  return result;
}
function run(f, expectedCode) {
  const before = inventory(f.library);
  const result = spawnSync(process.env.WINNER_TEST_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh'),
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(project, 'tools/windows-uebernahme-pruefen.ps1'),
      '-LibraryPath', f.library, '-ReportDirectory', f.report], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, expectedCode, result.stdout + result.stderr);
  assert.deepEqual(inventory(f.library), before, 'No application, config, data or local files may change');
  if (expectedCode === 1) return;
  const text = fs.readFileSync(path.join(f.report, 'pruefbericht.json'), 'utf8');
  assert.ok(!text.includes('untouched test data') && !text.includes('test secret'));
  return JSON.parse(text);
}
test('manifest pins the tested commit, eight runtime files and exact Git hashes', () => {
  assert.equal(manifest.targetCommit, target);
  assert.equal(manifest.baseCommit, base);
  assert.equal(manifest.files.filter(f => f.role === 'runtime').length, 8);
  assert.equal(manifest.files.filter(f => f.role === 'protected').length, 3);
  for (const file of manifest.files) {
    const bytes = blob(target, file.path), old = blob(base, file.path);
    assert.equal(sha(bytes), file.targetSha256);
    assert.equal(sha(normalize(bytes)), file.targetNormalizedSha256);
    assert.equal(old ? sha(normalize(old)) : null, file.baseNormalizedSha256);
  }
});
test('known legacy code with Windows line endings can be planned without any writes', t => {
  const report = run(fixture(t), 0);
  assert.equal(report.blocked, false);
  assert.equal(report.files.filter(f => f.state === 'Neue Datei; Anlage planbar').length, 5);
});
test('already installed target files need no replacement', t => {
  const report = run(fixture(t, target), 0);
  assert.ok(report.files.every(f => f.state === 'Entspricht bereits dem Zielstand'));
});
test('local code modification blocks the plan and is preserved', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.library, 'server.ps1'), '\n# local change');
  assert.equal(run(f, 2).blocked, true);
});
test('custom field configuration blocks the plan and is preserved', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.library, 'config/winner-fields.json'), ' ');
  assert.equal(run(f, 2).blocked, true);
});
test('existing unknown assistant file is never overwritten', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.library, 'public/assistant.html'), 'local assistant');
  assert.equal(run(f, 2).blocked, true);
});
test('missing user data prevents accidental initialization from seed', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.library, 'data/winners.json'));
  assert.equal(run(f, 2).dataFileExists, false);
});
test('report path inside the library is refused without writing there', t => {
  const f = fixture(t);
  f.report = path.join(f.library, 'do-not-create');
  run(f, 1);
  assert.equal(fs.existsSync(f.report), false);
});
