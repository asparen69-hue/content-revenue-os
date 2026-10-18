// Content Revenue OS - Winner Library V1 (browser UI)
// Field definitions come from /api/schema (config/winner-fields.json), so the UI follows the schema automatically.
'use strict';

const state = {
  schema: null,
  items: [],
  filters: { q: '', platform: '', contentType: '', status: '', niche: '' },
  sort: 'score-desc',
};

const app = document.getElementById('app');

// ------------------------------------------------------------ helpers

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }

function field(key) { return state.schema.fields.find(f => f.key === key); }

function scoreFields() { return state.schema.fields.filter(f => f.type === 'score'); }

// Display name for a stored option value (stored values stay English, see optionLabels in the schema).
function optionLabel(key, value) {
  if (isBlank(value)) return '';
  const labels = field(key)?.optionLabels || {};
  return labels[value] || String(value);
}

function formatNumber(v) { return isBlank(v) ? '' : Number(v).toLocaleString('de-DE'); }

function formatValue(f, v) {
  if (isBlank(v)) return '';
  if (f.type === 'number') return formatNumber(v);
  if (f.type === 'money') return Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (f.type === 'select') return optionLabel(f.key, v);
  return String(v);
}

function scoreBadge(score) {
  if (isBlank(score)) return '<span class="score none">–</span>';
  const cls = score >= 70 ? 'high' : score >= 50 ? 'mid' : '';
  return `<span class="score ${cls}">${esc(score)}</span>`;
}

function statusChip(status) {
  if (isBlank(status)) return '';
  return `<span class="chip status-${esc(status.replace(/\s+/g, '-'))}">${esc(optionLabel('status', status))}</span>`;
}

// Same formula as the server (see config/winner-fields.json -> scoreFormula). Used for the live preview only.
function computeOverall(values) {
  const nums = scoreFields().map(f => values[f.key]).filter(v => !isBlank(v)).map(Number);
  if (!nums.length) return { score: null, count: 0 };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { score: Math.round(avg * 10), count: nums.length };
}

async function api(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Anfrage fehlgeschlagen (${res.status})`);
    err.details = (data && data.details) || [];
    throw err;
  }
  return data;
}

async function loadItems() {
  const data = await api('GET', '/api/items');
  state.items = Array.isArray(data) ? data : [];
}

function toast(message, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), isError ? 7000 : 3500);
}

function confirmDialog(title, bodyHtml, confirmLabel) {
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const ok = document.getElementById('modal-confirm');
    const cancel = document.getElementById('modal-cancel');
    ok.textContent = confirmLabel || 'Bestätigen';
    modal.classList.remove('hidden');
    const close = result => {
      modal.classList.add('hidden');
      ok.onclick = cancel.onclick = null;
      resolve(result);
    };
    ok.onclick = () => close(true);
    cancel.onclick = () => close(false);
  });
}

// ------------------------------------------------------------ routing

function route() {
  const hash = location.hash || '#/';
  document.getElementById('nav-dashboard').classList.toggle('active', hash === '#/');
  let m;
  if (hash === '#/new') return renderForm(null);
  if ((m = hash.match(/^#\/edit\/([\w-]+)$/))) return renderForm(m[1]);
  if ((m = hash.match(/^#\/item\/([\w-]+)$/))) return renderDetail(m[1]);
  return renderDashboard();
}

// ------------------------------------------------------------ dashboard

function renderDashboard() {
  const items = state.items;
  const scored = items.filter(i => !isBlank(i.overallScore));
  const avg = scored.length ? Math.round(scored.reduce((a, i) => a + Number(i.overallScore), 0) / scored.length) : null;
  const count = s => items.filter(i => i.status === s).length;

  const opt = (list, selected, key) => list.map(o => `<option value="${esc(o)}"${o === selected ? ' selected' : ''}>${esc(key ? optionLabel(key, o) : o)}</option>`).join('');
  const niches = [...new Set(items.map(i => i.niche).filter(n => !isBlank(n)))].sort((a, b) => a.localeCompare(b));
  const f = state.filters;

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">Content, Accounts, Ads, Hooks, Funnels und Angebote mit Belegen, dass sie funktionieren.</p>
      </div>
      <a class="btn btn-primary" href="#/new">+ Winner hinzufügen</a>
    </div>

    <section class="kpis">
      <div class="kpi"><div class="kpi-label">Einträge gesamt</div><div class="kpi-value" id="kpi-total">${items.length}</div><div class="kpi-sub">in der Winner Library</div></div>
      <div class="kpi accent"><div class="kpi-label">Für Tests freigegeben</div><div class="kpi-value" id="kpi-approved">${count('Approved for test')}</div><div class="kpi-sub">Status „Für Tests freigegeben“ · ${count('Testing')} aktuell im Test</div></div>
      <div class="kpi accent"><div class="kpi-label">Winner</div><div class="kpi-value" id="kpi-winners">${count('Winner')}</div><div class="kpi-sub">Status „Winner“</div></div>
      <div class="kpi"><div class="kpi-label">Ø Opportunity Score</div><div class="kpi-value" id="kpi-avg">${avg === null ? '–' : avg}</div><div class="kpi-sub">0-100 · ${scored.length} von ${items.length} Einträgen bewertet</div></div>
    </section>

    <section class="toolbar">
      <div><label for="flt-q">Suche</label><input type="search" id="flt-q" placeholder="Titel, Hook, Creator, Notizen durchsuchen…" value="${esc(f.q)}"></div>
      <div><label for="flt-platform">Plattform</label><select id="flt-platform"><option value="">Alle</option>${opt(field('platform').options, f.platform, 'platform')}</select></div>
      <div><label for="flt-contentType">Content-Typ</label><select id="flt-contentType"><option value="">Alle</option>${opt(field('contentType').options, f.contentType, 'contentType')}</select></div>
      <div><label for="flt-status">Status</label><select id="flt-status"><option value="">Alle</option>${opt(field('status').options, f.status, 'status')}</select></div>
      <div><label for="flt-niche">Nische</label><select id="flt-niche"><option value="">Alle</option>${opt(niches, f.niche)}</select></div>
      <div><label for="sort">Sortieren nach</label><select id="sort">
        <option value="score-desc">Opportunity Score (hoch → niedrig)</option>
        <option value="score-asc">Opportunity Score (niedrig → hoch)</option>
        <option value="newest">Neueste zuerst</option>
        <option value="title">Titel (A → Z)</option>
      </select></div>
      <div><button type="button" class="btn btn-ghost-dark" id="flt-reset">Zurücksetzen</button></div>
    </section>

    <p class="result-count" id="result-count"></p>
    <div class="table-wrap">
      <table class="items">
        <thead><tr>
          <th>Score</th><th>Titel</th><th>Plattform</th><th>Content-Typ</th><th>Nische</th><th>Status</th><th>Evidenz</th><th>Entdeckt</th><th></th>
        </tr></thead>
        <tbody id="items-body"></tbody>
      </table>
    </div>`;

  document.getElementById('sort').value = state.sort;
  const bind = (id, key) => document.getElementById(id).addEventListener('input', e => { state.filters[key] = e.target.value; updateTable(); });
  bind('flt-q', 'q'); bind('flt-platform', 'platform'); bind('flt-contentType', 'contentType'); bind('flt-status', 'status'); bind('flt-niche', 'niche');
  document.getElementById('sort').addEventListener('input', e => { state.sort = e.target.value; updateTable(); });
  document.getElementById('flt-reset').addEventListener('click', () => {
    state.filters = { q: '', platform: '', contentType: '', status: '', niche: '' };
    state.sort = 'score-desc';
    renderDashboard();
  });
  document.getElementById('items-body').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]');
    if (edit) { e.stopPropagation(); location.hash = '#/edit/' + edit.dataset.edit; return; }
    const row = e.target.closest('tr[data-id]');
    if (row) location.hash = '#/item/' + row.dataset.id;
  });
  updateTable();
}

function filteredItems() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  const textKeys = state.schema.fields.filter(x => ['text', 'longtext', 'url', 'select', 'date'].includes(x.type)).map(x => x.key);
  let list = state.items.filter(i =>
    (!f.platform || i.platform === f.platform) &&
    (!f.contentType || i.contentType === f.contentType) &&
    (!f.status || i.status === f.status) &&
    (!f.niche || i.niche === f.niche) &&
    (!q || textKeys.some(k => !isBlank(i[k]) && (String(i[k]).toLowerCase().includes(q) || optionLabel(k, i[k]).toLowerCase().includes(q)))));

  const byScore = dir => (a, b) => {
    const sa = isBlank(a.overallScore) ? null : Number(a.overallScore);
    const sb = isBlank(b.overallScore) ? null : Number(b.overallScore);
    if (sa === sb) return String(b.createdAt).localeCompare(String(a.createdAt));
    if (sa === null) return 1;   // unscored items always at the bottom
    if (sb === null) return -1;
    return dir * (sa - sb);
  };
  const sorters = {
    'score-desc': byScore(-1),
    'score-asc': byScore(1),
    'newest': (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    'title': (a, b) => String(a.title).localeCompare(String(b.title)),
  };
  return list.sort(sorters[state.sort] || sorters['score-desc']);
}

function updateTable() {
  const list = filteredItems();
  const body = document.getElementById('items-body');
  document.getElementById('result-count').textContent = `${list.length} von ${state.items.length} Einträgen angezeigt`;
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty">${state.items.length ? 'Keine Einträge passen zu deiner Suche oder deinen Filtern.' : 'Noch keine Einträge. Klicke auf „+ Winner hinzufügen“, um den ersten zu speichern.'}</td></tr>`;
    return;
  }
  body.innerHTML = list.map(i => `
    <tr data-id="${esc(i.id)}">
      <td>${scoreBadge(i.overallScore)}</td>
      <td><div class="cell-title">${esc(i.title)}</div><div class="cell-sub">${esc(i.creator)}</div></td>
      <td>${esc(optionLabel('platform', i.platform))}</td>
      <td>${esc(optionLabel('contentType', i.contentType))}</td>
      <td>${esc(i.niche)}</td>
      <td>${statusChip(i.status)}</td>
      <td>${esc(optionLabel('evidenceStrength', i.evidenceStrength))}</td>
      <td>${esc(i.dateDiscovered)}</td>
      <td><button type="button" class="btn btn-ghost-dark btn-small" data-edit="${esc(i.id)}">Bearbeiten</button></td>
    </tr>`).join('');
}

// ------------------------------------------------------------ add / edit form

function inputHtml(f, value) {
  const id = `f-${f.key}`;
  const v = isBlank(value) ? '' : value;
  switch (f.type) {
    case 'longtext': return `<textarea id="${id}" name="${f.key}" rows="3">${esc(v)}</textarea>`;
    case 'select':
      return `<select id="${id}" name="${f.key}"><option value="">— auswählen —</option>${f.options.map(o => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(optionLabel(f.key, o))}</option>`).join('')}</select>`;
    case 'score': {
      const opts = Array.from({ length: 10 }, (_, n) => n + 1).map(n => `<option value="${n}"${Number(v) === n ? ' selected' : ''}>${n}</option>`).join('');
      return `<select id="${id}" name="${f.key}" class="score-input"><option value="">–</option>${opts}</select>`;
    }
    case 'number': return `<input type="number" id="${id}" name="${f.key}" min="0" step="1" value="${esc(v)}">`;
    case 'money': return `<input type="number" id="${id}" name="${f.key}" min="0" step="0.01" value="${esc(v)}">`;
    case 'date': return `<input type="date" id="${id}" name="${f.key}" value="${esc(v)}">`;
    case 'url': return `<input type="url" id="${id}" name="${f.key}" placeholder="https://…" value="${esc(v)}">`;
    default: return `<input type="text" id="${id}" name="${f.key}" value="${esc(v)}"${f.required ? ' required' : ''}>`;
  }
}

function renderForm(id) {
  const existing = id ? state.items.find(i => i.id === id) : null;
  if (id && !existing) { app.innerHTML = '<p class="empty">Eintrag nicht gefunden. <a href="#/">Zurück zum Dashboard</a></p>'; return; }

  const values = {};
  state.schema.fields.forEach(f => {
    if (existing) values[f.key] = existing[f.key];
    else if (f.default === 'today') values[f.key] = new Date().toISOString().slice(0, 10);
    else values[f.key] = f.default ?? '';
  });

  const groups = state.schema.groups.map((g, gi) => {
    const fields = state.schema.fields.filter(f => f.group === g && f.type !== 'computed');
    const isScores = g === 'Scores';
    const body = fields.map(f => `
      <div class="field${f.type === 'longtext' ? ' wide' : ''}">
        <label for="f-${f.key}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
        ${inputHtml(f, values[f.key])}
        ${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}
      </div>`).join('');
    const preview = isScores ? `
      <div class="overall-preview">
        <div class="big" id="overall-preview">–</div>
        <div><strong>Opportunity Score (0-100)</strong> <span id="overall-count"></span>
          <div class="formula">Durchschnitt der ausgefüllten Scores × 10. Alle 8 Kriterien zählen gleich; leere werden ignoriert.</div></div>
      </div>` : '';
    const open = gi === 0 || isScores || g === 'Unser Test';
    return `<details class="group"${open ? ' open' : ''}><summary>${esc(g)}</summary>
      <div class="group-body${isScores ? ' scores-grid' : ''}">${body}${preview}</div></details>`;
  }).join('');

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${existing ? 'Eintrag bearbeiten' : 'Neuen Winner hinzufügen'}</h1>
        <p class="muted">${existing ? esc(existing.title) : 'Nur der Titel ist Pflicht. Fülle aus, was du weißt — Zahlen nicht schätzen.'}</p>
      </div>
      <div class="form-top-actions">
        <button type="button" class="btn btn-ghost-dark" id="expand-all">Alle Bereiche aufklappen</button>
      </div>
    </div>
    <div id="form-errors"></div>
    <form id="item-form" novalidate>
      ${groups}
      <div class="form-actions">
        <a class="btn btn-ghost-dark" href="${existing ? '#/item/' + esc(existing.id) : '#/'}">Abbrechen</a>
        <button type="submit" class="btn btn-primary" id="save-btn">${existing ? 'Änderungen speichern' : 'Winner speichern'}</button>
      </div>
    </form>`;

  const form = document.getElementById('item-form');
  const updatePreview = () => {
    const vals = {};
    scoreFields().forEach(f => { vals[f.key] = form.elements[f.key].value; });
    const r = computeOverall(vals);
    document.getElementById('overall-preview').textContent = r.score === null ? '–' : r.score;
    document.getElementById('overall-count').textContent = `(${r.count} von 8 Kriterien bewertet)`;
  };
  form.querySelectorAll('.score-input').forEach(s => s.addEventListener('input', updatePreview));
  updatePreview();

  document.getElementById('expand-all').addEventListener('click', () => form.querySelectorAll('details').forEach(d => { d.open = true; }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errorsBox = document.getElementById('form-errors');
    errorsBox.innerHTML = '';
    const payload = {};
    state.schema.fields.filter(f => f.type !== 'computed').forEach(f => { payload[f.key] = form.elements[f.key].value; });
    if (isBlank(payload.title)) {
      errorsBox.innerHTML = '<div class="errors"><strong>Bitte Folgendes korrigieren:</strong><ul><li>Titel ist ein Pflichtfeld.</li></ul></div>';
      document.getElementById('f-title').focus();
      return;
    }
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    try {
      const saved = existing
        ? await api('PUT', `/api/items/${encodeURIComponent(existing.id)}`, payload)
        : await api('POST', '/api/items', payload);
      await loadItems();
      toast(existing ? 'Änderungen gespeichert.' : 'Winner gespeichert.');
      location.hash = '#/item/' + saved.id;
    } catch (err) {
      errorsBox.innerHTML = `<div class="errors"><strong>${esc(err.message)}</strong>${err.details.length ? `<ul>${err.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      btn.disabled = false;
    }
  });
}

// ------------------------------------------------------------ detail view

function renderDetail(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) { app.innerHTML = '<p class="empty">Eintrag nicht gefunden. <a href="#/">Zurück zum Dashboard</a></p>'; return; }

  const headerKeys = ['title', 'overallScore'];
  const sections = state.schema.groups.map(g => {
    const rows = state.schema.fields
      .filter(f => f.group === g && !headerKeys.includes(f.key) && !isBlank(item[f.key]))
      .map(f => {
        let val;
        if (f.type === 'url') val = `<a href="${esc(item[f.key])}" target="_blank" rel="noopener noreferrer">${esc(item[f.key])}</a>`;
        else if (f.type === 'score') val = `<progress class="bar" max="10" value="${esc(item[f.key])}"></progress>${esc(item[f.key])} / 10`;
        else if (f.key === 'status') val = statusChip(item.status);
        else val = esc(formatValue(f, item[f.key]));
        return `<dt>${esc(f.label)}</dt><dd>${val}</dd>`;
      }).join('');
    return rows ? `<section class="detail-section"><h2>${esc(g)}</h2><dl>${rows}</dl></section>` : '';
  }).join('');

  const emptyCount = state.schema.fields.filter(f => f.type !== 'computed' && isBlank(item[f.key])).length;

  app.innerHTML = `
    <p><a href="#/">← Zurück zum Dashboard</a></p>
    <div class="detail-head">
      <div>
        <h1 id="detail-title">${esc(item.title)}</h1>
        <div class="meta">
          ${item.platform ? `<span class="chip">${esc(optionLabel('platform', item.platform))}</span>` : ''}
          ${item.contentType ? `<span class="chip">${esc(optionLabel('contentType', item.contentType))}</span>` : ''}
          ${item.status ? `<span class="chip">${esc(optionLabel('status', item.status))}</span>` : ''}
          ${item.creator ? `<span>von ${esc(item.creator)}</span>` : ''}
        </div>
      </div>
      <div class="detail-score">
        <div class="big">${isBlank(item.overallScore) ? '–' : esc(item.overallScore)}</div>
        <div class="small">Opportunity Score · ${esc(item.scoredCount || 0)}/8 bewertet</div>
      </div>
      <div class="detail-actions">
        <a class="btn btn-primary" href="#/edit/${esc(item.id)}" id="detail-edit">Bearbeiten</a>
        <button type="button" class="btn btn-danger" id="detail-delete">Löschen</button>
      </div>
    </div>
    ${sections}
    <p class="muted">${emptyCount} leere Felder ausgeblendet. Angelegt ${esc(item.createdAt)} · zuletzt geändert ${esc(item.updatedAt)} (UTC) · ID ${esc(item.id)}</p>`;

  document.getElementById('detail-delete').addEventListener('click', async () => {
    const ok = await confirmDialog('Diesen Eintrag löschen?', `<p><strong>${esc(item.title)}</strong></p><p class="muted">Das kann nicht rückgängig gemacht werden (außer durch Wiederherstellen einer Sicherung aus dem Ordner data\\backups).</p>`, 'Löschen');
    if (!ok) return;
    try {
      await api('DELETE', `/api/items/${encodeURIComponent(item.id)}`);
      await loadItems();
      toast('Eintrag gelöscht.');
      location.hash = '#/';
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ------------------------------------------------------------ import

function setupDataMenu() {
  const btn = document.getElementById('menu-data');
  const panel = document.getElementById('menu-data-panel');
  btn.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('hidden'); });
  document.addEventListener('click', () => panel.classList.add('hidden'));

  const fileInput = document.getElementById('import-file');
  document.getElementById('import-json').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { toast('Diese Datei ist kein gültiges JSON. Es wurde nichts importiert.', true); return; }
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
    const ok = await confirmDialog('JSON importieren?',
      `<p>Die Datei <strong>${esc(file.name)}</strong> enthält <strong>${list.length}</strong> Einträge.</p>
       <ul class="muted"><li>Neue Einträge werden hinzugefügt.</li><li>Einträge mit bereits vorhandener ID werden aktualisiert.</li>
       <li>Jeder Eintrag wird vorher geprüft. Ist etwas ungültig, wird nichts importiert.</li><li>Vorher wird automatisch eine Sicherung deiner aktuellen Daten erstellt.</li></ul>`, 'Importieren');
    if (!ok) return;
    try {
      const r = await api('POST', '/api/import', data, { 'X-Winner-Import-Approved': 'true' });
      await loadItems();
      toast(`Import abgeschlossen: ${r.added} hinzugefügt, ${r.updated} aktualisiert.`);
      route();
    } catch (err) {
      const extra = err.details.length ? ' ' + err.details.slice(0, 5).join(' | ') + (err.details.length > 5 ? ` (+${err.details.length - 5} weitere)` : '') : '';
      toast(err.message + extra, true);
    }
  });
}

// ------------------------------------------------------------ start

async function init() {
  try {
    state.schema = await api('GET', '/api/schema');
    await loadItems();
  } catch (err) {
    app.innerHTML = `<div class="errors"><strong>Daten konnten nicht geladen werden.</strong> Ist das Server-Fenster noch geöffnet? (${esc(err.message)})</div>`;
    return;
  }
  setupDataMenu();
  window.addEventListener('hashchange', route);
  route();
}

init();
