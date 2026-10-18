'use strict';
(function (root) {
  function problem(message, details = []) {
    const error = new Error(message);
    error.details = details;
    return error;
  }
  function parseJson(text, allowFence = false) {
    let value = text.trim();
    if (!value) throw problem('Bitte zuerst die vollständige JSON-Antwort einfügen.');
    // Only remove one enclosing code block. Never guess, repair or extract partial data.
    if (allowFence) {
      const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(value);
      if (fenced) value = fenced[1].trim();
    }
    try { return JSON.parse(value); } catch {
      throw problem('Das JSON ist nicht gültig. Bitte die vollständige Antwort kopieren und doppelte Anführungszeichen, Kommas sowie geschlossene Klammern prüfen. Zusätzlichen Erklärungstext entfernen.');
    }
  }
  async function request(method, url, body, headers = {}) {
    let response;
    try {
      response = await fetch(url, {
        method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw problem(method === 'GET'
        ? 'Keine Verbindung zur Winner Library. Bitte das Server-Fenster prüfen und erneut versuchen.'
        : 'Die Antwort der Winner Library ist ausgeblieben. Bitte zuerst in der Library prüfen, ob die Änderung gespeichert wurde. Nicht ungeprüft erneut senden.');
    }
    let data;
    try { data = await response.json(); } catch {
      throw problem('Die Winner Library hat keine lesbare JSON-Antwort geliefert. Bitte den Stand in der Library und das Server-Fenster prüfen.');
    }
    if (!response.ok) throw problem(data.error || 'Die Anfrage konnte nicht ausgeführt werden. Bitte das Server-Fenster prüfen.', Array.isArray(data.details) ? data.details : []);
    return data;
  }
  async function readJsonFile(file) {
    let text;
    try { text = await file.text(); } catch {
      throw problem('Die Datei konnte nicht gelesen werden. Bitte die Datei erneut auswählen.');
    }
    return parseJson(text);
  }
  root.WinnerUi = { parseJson, request, readJsonFile };
  if (typeof module !== 'undefined') module.exports = root.WinnerUi;
})(globalThis);
