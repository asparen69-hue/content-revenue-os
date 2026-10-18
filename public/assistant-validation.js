// Schema-driven validation shared by the preview and the offline regression tests.
'use strict';
(function (root) {
  function validateDraft(data, schema) {
    if (!data || Array.isArray(data) || typeof data !== 'object') {
      throw Error('Ein einzelnes JSON-Objekt erwartet.');
    }
    const byKey = new Map(schema.fields.filter(f => f.type !== 'computed').map(f => [f.key, f]));
    const errors = [], clean = {};
    for (const [key, original] of Object.entries(data)) {
      const f = byKey.get(key);
      if (!f) { errors.push('Unbekanntes oder berechnetes Feld: ' + key); continue; }
      if (original === null || (typeof original === 'string' && !original.trim())) continue;
      const value = typeof original === 'string' ? original.trim() : original;
      if (['score', 'number', 'money'].includes(f.type)) {
        // Match the server's decimal formats; never coerce booleans, arrays or objects.
        const numericText = typeof value === 'string' ? value.replace(/\s/g, '') : '';
        const n = typeof value === 'number' ? value
          : /^(?:\d+(?:\.\d+)?|\d+,\d{1,2})$/.test(numericText) ? Number(numericText.replace(',', '.')) : NaN;
        if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER ||
            (f.type !== 'money' && !Number.isSafeInteger(n)) ||
            (f.type === 'score' && (n < 1 || n > 10))) {
          errors.push(key + ': ungültige Zahl'); continue;
        }
        // Keep the accepted input; the server applies its existing money rounding.
        clean[key] = n;
        continue;
      }
      if (typeof value !== 'string') { errors.push(key + ': Text erwartet'); continue; }
      if (f.options && !f.options.includes(value)) { errors.push(key + ': nicht erlaubte Auswahl'); continue; }
      if (f.type === 'url') {
        let valid = /^https?:\/\/\S+$/i.test(value) && value.length <= 2000;
        try { valid = valid && Boolean(new URL(value).hostname); } catch { valid = false; }
        if (!valid) { errors.push(key + ': gültige http(s)-URL erforderlich'); continue; }
      }
      if (f.type === 'date') {
        const date = new Date(value + 'T00:00:00Z');
        if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          errors.push(key + ': gültiges Datum JJJJ-MM-TT erforderlich'); continue;
        }
      }
      if (value.length > 20000) { errors.push(key + ': zu lang (maximal 20000 Zeichen)'); continue; }
      clean[key] = value;
    }
    for (const f of byKey.values()) {
      if (f.required && !Object.hasOwn(clean, f.key)) errors.push(f.key + ': Pflichtfeld fehlt.');
    }
    // This workflow captures discoveries, not approvals, tests or measured winners.
    if (clean.status && clean.status !== 'Discovered') errors.push('status: für neue Entwürfe nur Discovered erlaubt.');
    if (errors.length) throw Error(errors.join(' | '));
    clean.status = 'Discovered';
    // Do not guess the research source, discovery date, scores or missing metrics.
    return clean;
  }
  root.WinnerAssistant = { validateDraft };
  if (typeof module !== 'undefined') module.exports = root.WinnerAssistant;
})(globalThis);
