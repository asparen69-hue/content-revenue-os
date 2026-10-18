# KI-Erfassungsassistent V1 – Entwurf und sichere Übergabe

## Ziel
Aus einem vom Nutzer bereitgestellten Videotranskript, einer Beschreibung oder einer manuellen Analyse einen **prüfbaren Datensatz** für die bestehende Winner Library erzeugen. Kein autonomes Auslesen von TikTok/Instagram und keine erfundenen Kennzahlen.

## V1-Ablauf
1. Nutzer liefert Quell-URL (optional), Titel und Transkript/Beschreibung.
2. KI erstellt einen JSON-Entwurf mit ausschließlich **belegbaren** Angaben.
3. Nicht beobachtbare Performancewerte, Followerzahlen, Umsätze, Scores und Angebotsdaten bleiben leer.
4. Nutzer prüft den Entwurf gegen die Quelle und genehmigt ausdrücklich den Import.
5. Die bestehende App importiert den geprüften JSON-Datensatz über **Daten → JSON importieren**. Keine automatische Schreibaktion ohne Freigabe.

## Datenschema
Die verbindlichen Schlüssel und Optionswerte stehen in `config/winner-fields.json` (Schema 2).
Vor dem Import muss der Entwurf dagegen geprüft werden. Feldschlüssel und Optionswerte bleiben Englisch, die Oberfläche Deutsch.
Mindestens `title` muss vorhanden sein. `sourceUrl` nur mit http(s)-URL, falls tatsächlich bekannt.
`researchSource` dokumentiert den tatsächlichen Analyseweg. `status` beginnt mit `Discovered`.
`performanceSignals` nur mit beobachteten Fakten; keine vermuteten Views oder Verkäufe.

## Sicherheit
- Bestehende Einträge und `data/winners.json` nicht verändern.
- Keine API-Schlüssel, Logins oder personenbezogenen Zugangsdaten speichern.
- Keine Scraper, Plattform-Umgehungen, kostenpflichtigen APIs oder automatischen Veröffentlichungen.
- Der Import ist ein manueller Freigabeschritt. Die vorhandene Importvalidierung und Sicherung bleiben maßgeblich.

## Abnahmekriterien
- Ein nachvollziehbarer Entwurf lässt sich als JSON exportieren.
- Ungültige Werte werden vor dem Import erkannt.
- Unbekannte Informationen bleiben leer.
- Der Testeintrag kann importiert und wieder gelöscht werden.
- Der bestehende Hauptzweig `main` bleibt unverändert.

## Umsetzung und Grenzen der Prüfung

- `/assistant.html` lädt JavaScript und CSS als lokale Dateien. Die bestehende
  Content Security Policy bleibt erhalten; Inline-Code wird nicht freigeschaltet.
- Die Vorschau verwendet `/api/schema`: englische Schlüssel und Optionswerte bleiben
  unverändert. Unbekannte/berechnete Felder, IDs, ungültige Zahlen, Kalendertage,
  URLs und zu lange Texte werden abgewiesen. Zähler sind ganzzahlig; Dezimalkomma
  für Geldwerte wird wie im Server akzeptiert. Entwürfe beginnen mit `Discovered`.
- Fehlende Kennzahlen, Scores, Forschungsquelle und Datumsangaben werden nicht ergänzt.
  Die Library setzt beim tatsächlichen Import weiterhin ihre bestehenden Standardwerte
  für `dateDiscovered` (heute) und `researchSource` (`Manual`); die Vorschau weist darauf hin.
- Nach erfolgreicher Strukturprüfung muss der Nutzer den Quellenabgleich per Checkbox
  bestätigen, bevor ein Download möglich ist. Änderungen an Quelle oder JSON sowie
  erneute Prüfung setzen diese Freigabe zurück. Verspätete Schemaantworten dürfen
  keinen veralteten Entwurf zum Export freischalten.
- Der Assistent führt ausschließlich lesende Schemaanfragen aus. Der JSON-Download
  enthält ein Array mit genau einem Datensatz ohne ID und überschreibt daher keinen
  vorhandenen Eintrag. Der Import erfolgt weiterhin separat in der Winner Library.
- `/api/import` verlangt zusätzlich den Header `X-Winner-Import-Approved: true`.
  Die Library sendet ihn erst nach Bestätigung der ausgewählten Datei. Externe lokale
  Importwerkzeuge müssen ihn ebenfalls erst nach ausdrücklicher Nutzerfreigabe setzen;
  der Header dokumentiert diese Freigabe, ist aber kein Authentifizierungsnachweis.
- Die JSON-Body-Verarbeitung erhält leere, einzelne und verschachtelte Arrays ohne
  PowerShell-Pipeline-Abflachung. Ungültige Importdaten werden vor jeder Schreibaktion
  zurückgewiesen. Sicherungen und bestehende Import-/Update-Semantik bleiben erhalten.
- Eine Strukturprüfung erkennt keine erfundenen, aber formal gültigen Fakten. Der
  Analyseauftrag fordert Belege, trennt fremde Kennzahlen von eigenen Testergebnissen
  und behandelt Quelltext als Datenmaterial. Der Quellenabgleich bleibt erforderlich.

## Reproduzierbare Tests

Siehe die Befehle in `README.md`. `tests/run-isolated.ps1` kopiert ausschließlich Code,
Schema, Beispielkonfiguration und Tests in ein temporäres Verzeichnis. Vorhandene
`data/`-Inhalte werden weder gelesen noch kopiert oder geändert. Der zusätzliche
Playwright-Test startet ebenfalls seinen eigenen temporären Server.

Am 18.10.2026 in der Linux-Cloud erfolgreich geprüft:

- 43 Offline-Tests für die Validierung einschließlich des ASCII-Formats von `server.ps1`.
- Erweiterte API-Suite: CRUD, Score, Unicode, Export, Importfreigabe, atomare
  Validierung, Array-Strukturen, Zahlenüberlauf und bestehende Sicherheitsprüfungen.
- Alle 28 bisherigen UI-Prüfungen mit Chromium; der Sandbox-Teststarter blieb
  außerhalb des Repositorys. Windows-Starter und Windows-Edge-Test bleiben unverändert.
- Browserablauf des Assistenten einschließlich CSP, Prompt, Freigabe, Download,
  Rücksetzen nach Änderungen, verspäteter Schemaantwort, Textdarstellung sowie
  Importabbruch und bestätigtem Import mit Sicherung.

Die Laufzeit in der Cloud war PowerShell 7.4.21. Ein echter Lauf unter **Windows
PowerShell 5.1 und Microsoft Edge** bleibt offen. Der Server bleibt ASCII-only und
verwendet keine PowerShell-7-spezifischen Parameter oder Sprachkonstrukte.
Es wurden keine kostenpflichtigen APIs, Abonnements oder Produktabhängigkeiten ergänzt.
