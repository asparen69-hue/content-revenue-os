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
      const label = f.label;
      const value = typeof original === 'string' ? original.trim() : original;
      if (['score', 'number', 'money'].includes(f.type)) {
        // Match the server's decimal formats; never coerce booleans, arrays or objects.
        const numericText = typeof value === 'string' ? value.replace(/\s/g, '') : '';
        const n = typeof value === 'number' ? value
          : /^(?:\d+(?:\.\d+)?|\d+,\d{1,2})$/.test(numericText) ? Number(numericText.replace(',', '.')) : NaN;
        if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER ||
            (f.type !== 'money' && !Number.isSafeInteger(n)) ||
            (f.type === 'score' && (n < 1 || n > 10))) {
          const hint = n > Number.MAX_SAFE_INTEGER ? ': Der Wert ist zu groß für eine zuverlässige Übernahme.'
            : f.type === 'score' ? ': Bitte eine ganze Zahl zwischen 1 und 10 eingeben.'
              : f.type === 'number' ? ': Bitte eine nicht negative ganze Zahl eingeben.'
                : ': Bitte einen nicht negativen Geldbetrag eingeben (zum Beispiel 49,90).';
          errors.push(label + hint); continue;
        }
        // Keep the accepted input; the server applies its existing money rounding.
        clean[key] = n;
        continue;
      }
      if (typeof value !== 'string') { errors.push(label + ': Text erwartet'); continue; }
      if (f.options && !f.options.includes(value)) {
        errors.push(label + ': Diese Auswahl ist nicht erlaubt. Für das JSON bitte einen dieser Werte verwenden: ' + f.options.join(', '));
        continue;
      }
      if (f.type === 'url') {
        let valid = /^https?:\/\/\S+$/i.test(value) && value.length <= 2000;
        try { valid = valid && Boolean(new URL(value).hostname); } catch { valid = false; }
        if (!valid) { errors.push(label + ': gültige http(s)-URL erforderlich'); continue; }
      }
      if (f.type === 'date') {
        const date = new Date(value + 'T00:00:00Z');
        if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          errors.push(label + ': gültiges Datum JJJJ-MM-TT erforderlich'); continue;
        }
      }
      if (value.length > 20000) { errors.push(label + ': zu lang (maximal 20000 Zeichen)'); continue; }
      clean[key] = value;
    }
    for (const f of byKey.values()) {
      if (f.required && !Object.hasOwn(clean, f.key)) errors.push(f.label + ': Bitte ausfüllen.');
    }
    // This workflow captures discoveries, not approvals, tests or measured winners.
    if (clean.status && clean.status !== 'Discovered') errors.push('Unser Status: Neue Entwürfe müssen den Status „Entdeckt“ haben (Discovered).');
    if (errors.length) throw Error(errors.join(' | '));
    clean.status = 'Discovered';
    // Do not guess the research source, discovery date, scores or missing metrics.
    return clean;
  }
  root.WinnerAssistant = { validateDraft };
  if (typeof module !== 'undefined') module.exports = root.WinnerAssistant;
})(globalThis);
