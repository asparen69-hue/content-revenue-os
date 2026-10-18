# Sichere Übernahme des getesteten KI-Erfassungsassistenten V1

## Stand und Freigaben

Vorbereitung vom 18.10.2026. Getesteter Anwendungscode:
`696448925c4a3507a38a7cb7039e0dbd20a5bbb0`. Die erfolgreiche Windows-/Edge-Abnahme
ist in [windows-abnahme-6964489.md](windows-abnahme-6964489.md) dokumentiert.
Commit `95877eb` ergänzt nur diese Abnahmedokumentation.

Ziel einer späteren Übernahme ist `D:\CONTENT-REVENUE-OS`. Der tatsächliche
Dateistand dieses Ordners ist hier noch unbekannt. Der frühere Repository-Stand
`e834f80` dient nur als Vergleichsbasis, nicht als Behauptung über den PC.

Dieser Plan autorisiert keine Änderung am Zielordner. Bisher wurden weder eine
Sicherung noch eine Installation dort ausgeführt. Push der Vorbereitungsdateien,
Sicherung und tatsächlicher Dateiaustausch brauchen die jeweils vereinbarte
Freigabe. Ein Merge nach `main` ist dafür nicht notwendig und wird nicht ausgeführt.

## Dateiplan

Nur diese acht Laufzeitdateien werden für einen späteren Austausch vorbereitet:

| Datei | Gegenüber `e834f80` | Zweck |
| --- | --- | --- |
| `server.ps1` | Geändert | Deutsche Meldungen, Importfreigabe und Validierung |
| `public/app.js` | Geändert | Gemeinsame Meldungen und bestätigter Dateiimport |
| `public/index.html` | Geändert | Assistenten-Link und gemeinsame Hilfsdatei |
| `public/assistant.html` | Neu | Assistenten-Oberfläche |
| `public/assistant.css` | Neu | Darstellung des Assistenten |
| `public/assistant.js` | Neu | Prüfung, Quellenfreigabe und bestätigter Direktimport |
| `public/assistant-validation.js` | Neu | Schema-Prüfung |
| `public/ui-helpers.js` | Neu | Deutsche JSON-, Datei- und Verbindungsmeldungen |

Nicht austauschen: `data/` einschließlich aller Backups, `config/`,
`Start-WinnerLibrary.bat`, `public/styles.css`, Medien, Zugangsdaten und lokale
Einstellungen. Auch `.git`, Tests und Dokumentation werden bei diesem minimalen
Laufzeitupdate nicht in den bestehenden Ordner kopiert. Es gibt keine Datenmigration.

Das [Manifest](../tools/windows-uebernahme-manifest.json) enthält die vollständigen
Commit-IDs sowie SHA-256-Prüfsummen des Ausgangs- und Zielstands. Für den lesenden
Vergleich werden UTF-8-BOM und CRLF/LF-Unterschiede ausgeglichen; sonstige
Änderungen bleiben sichtbar. Der zusätzliche `targetSha256` beschreibt die exakten
Bytes des Git-Zielblobs für eine spätere Prüfung des Bereitstellungsordners.

## Nächster Schritt: nur lesender Vergleich am PC

Aus einer separaten Kopie mit diesen Vorbereitungsdateien:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\windows-uebernahme-pruefen.ps1
```

Das Skript liest ausschließlich die acht Laufzeitdateien und drei geschützten
Vergleichsdateien (`config/winner-fields.json`, `config/seed.json`, Windows-Starter).
Für `data/winners.json` prüft es nur die Existenz; Nutzerdaten werden nicht gelesen.
Es startet oder beendet keine Anwendung, ruft keine API auf und schreibt nur einen
neuen Bericht unter `%TEMP%\winner-preflight-<Zufallskennung>`.

Bekannte Ausgangsdateien, bereits vorhandene Zieldateien und erwartete neue Dateien
werden unterschieden. Unbekannte Änderungen, fehlende geschützte Dateien,
abweichende Konfiguration oder vorhandene Konflikte an neuen Dateipfaden führen zu
Exitcode 2. Dann zuerst vergleichen und klären; nichts überschreiben. Exitcode 0
besagt nur, dass der verglichene Dateistand bekannt ist, und ist keine Updatefreigabe.

## Sicherungsplan – erst nach Freigabe

1. Nur den Server der bestehenden Library geordnet beenden. Keine anderen
   PowerShell-Prozesse oder Browser pauschal schließen. Die passende Instanz muss
   eindeutig zu `D:\CONTENT-REVENUE-OS\server.ps1` gehören.
2. Sicherstellen, dass dieser Server beendet ist und während Sicherung und Austausch
   keine Eingaben gespeichert werden. Der lesende Dateivergleich ist zu wiederholen,
   falls seit seiner Ausführung Dateien verändert wurden.
3. Eine vollständige lokale Sicherung in einem neuen, noch nicht vorhandenen
   Nachbarordner anlegen, beispielsweise
   `D:\CONTENT-REVENUE-OS-SICHERUNGEN\<Zeitstempel>-<Zufallskennung>`.
   Nie vorhandene Sicherungen überschreiben. Keine Daten auf GitHub hochladen.
4. Dateiliste und SHA-256-Werte der Sicherung gegen das Original prüfen. Insbesondere
   `data/`, Konfiguration und die drei zu ersetzenden Dateien müssen gesichert sein.
   Zusätzlich festhalten, welche der fünf neuen Dateien vorher bereits vorhanden
   waren. Bei jeder fehlgeschlagenen Kopie oder Prüfung abbrechen.

## Austauschplan – erst nach eigener ausdrücklicher Freigabe

1. Die acht Dateien aus dem festgelegten Commit in einem separaten
   Bereitstellungsordner vorbereiten und ihre exakten Hashwerte gegen das Manifest
   prüfen. Dafür ein Git-Archiv des festen Commits verwenden; ein normaler Checkout
   kann unter Windows die Zeilenenden verändern. Keine Dateien aus `main` oder einem
   ungeprüften aktuellen Branchstand verwenden.
2. Bei weiterhin beendetem Zielserver nur diese acht Dateien einzeln übernehmen.
   Kein rekursives Überschreiben des gesamten Projekt- oder `public`-Ordners.
3. Die acht Zielwerte und die unveränderten Roh-Hashwerte der Konfiguration,
   des Windows-Starters und sämtlicher Dateien unter `data/` prüfen.
4. Nur die bestehende Library mit ihrem bisherigen Starter neu starten.
   Scheitert der Start, keine Daten neu erzeugen oder ersetzen; Rücksetzplan nutzen.
5. In der echten Library ausschließlich lesend prüfen: Health-/Schemaanfragen,
   Dashboard und Assistentenseite. Keine Smoke-Tests, Testimporte, Testeinträge oder
   Löschtests gegen echte Nutzerdaten ausführen. Schreibende Tests bleiben in der
   bereits abgenommenen separaten Testkopie.

## Rücksetzplan

- Den Zielserver vor dem Rücksetzen wieder geordnet beenden.
- Die zuvor vorhandenen Laufzeitdateien aus der verifizierten Sicherung
  wiederherstellen. Das gilt auch für Dateien, die bereits auf Zielstand waren.
- Nur solche neuen Dateien entfernen, die vor dem Austausch nachweislich fehlten
  und noch exakt dem von uns eingespielten Stand entsprechen. Keine unbekannten
  oder zwischenzeitlich bearbeiteten Dateien löschen.
- `data/` und Konfiguration bleiben auch beim Rücksetzen unangetastet. Eine
  Wiederherstellung älterer Nutzerdaten wäre ein eigener, ausdrücklich freizugebender
  Vorgang; sie könnte nachträgliche Eingaben verlieren.
- Die alten Laufzeitwerte gegen die Sicherung prüfen und mit dem bisherigen
  Windows-Starter starten. Danach nur lesend prüfen.

## Noch offen

Der Vergleich des tatsächlichen PC-Dateistands, die Freigabe der Sicherung und die
Freigabe des Austauschs stehen aus. Es wurde keine zusätzliche Software oder ein
kostenpflichtiger Dienst vorgesehen. Vorbereitungsskripte nehmen keinen Austausch
vor; ein installierendes Skript ist nicht Bestandteil dieses Schritts.

## Prüfung dieser Vorbereitung

Am 18.10.2026 wurden acht isolierte Entwicklertests unter Linux mit PowerShell
7.4.21 erfolgreich ausgeführt:

- Manifest und Prüfsummen entsprechen den festgelegten Git-Commits.
- Bekannter Ausgangsstand mit Windows-Zeilenenden und BOM wird erkannt.
- Bereits vorhandener Zielstand wird erkannt.
- Lokale Programmänderungen bleiben erhalten und blockieren die Übernahmeplanung.
- Geänderte Feldkonfiguration bleibt erhalten und blockiert die Planung.
- Unbekannte vorhandene Assistentendateien werden nicht überschrieben.
- Fehlende Nutzerdaten verhindern die Freigabe des Dateiplans.
- Ein Berichtsordner innerhalb der Library wird ohne Schreibaktion abgewiesen.

Die Tests vergleichen jeweils die Dateiinhalte des gesamten künstlichen
Library-Ordners vor und nach der Prüfung, einschließlich Testdaten, Sicherungen
und zusätzlichen lokalen Dateien. Es wurden keine echten PC-Daten verwendet.

Entwickleraufruf (Node und PowerShell erforderlich; keine Anwendungsabhängigkeit):

```sh
node tests/windows-uebernahme-pruefen.test.js
```

Unter Linux kann `WINNER_TEST_POWERSHELL` auf `pwsh` zeigen. Diese neuen
Vorbereitungsskripte sind noch nicht auf dem Windows-PC ausgeführt worden; die
Windows-Abnahme des Anwendungscodes `6964489` bleibt davon unberührt.
