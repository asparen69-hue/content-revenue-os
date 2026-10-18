# Windows-/Edge-Abnahme des KI-Erfassungsassistenten V1

## Geprüfter Stand

- Datum: 18.10.2026.
- Repository: `asparen69-hue/content-revenue-os`.
- Entwicklungszweig: `feature/ki-erfassungsassistent-v1`.
- Getesteter Commit: `696448925c4a3507a38a7cb7039e0dbd20a5bbb0`.
- Laufzeit: Windows PowerShell 5.1.19041.6456.
- Browser: lokal installiertes Microsoft Edge. Die genaue Browserversion wurde
  nicht erfasst.
- Ausführung auf dem Windows-PC durch den Nutzer mit den im Chat vorbereiteten
  PowerShell-Blöcken; Ergebnisprüfung anhand seiner Screenshots. Der Cloud-Agent
  hatte keinen direkten Zugriff auf den PC.

## Isolation und Ablauf

1. Den Entwicklungszweig in einen neuen Ordner unter
   `%TEMP%\winner-v1-test-<Zufallskennung>` klonen und den vollständigen Commit
   auschecken. Vor den Tests wird die Commit-ID geprüft.
2. `tests\run-isolated.ps1 -IncludeUi` aus dieser Testkopie ausführen. Der Starter
   kopiert nur Code, Konfiguration und Tests in einen weiteren temporären Ordner.
   Er startet seinen eigenen Server auf einem freien Port, führt API- und
   Library-UI-Tests aus und beendet den Server anschließend.
3. Für den gezielten Assistententest eine weitere Unterkopie
   `assistant-final-<Zufallskennung>` anlegen. Nur `server.ps1`, `public` und
   `config` werden übernommen; vorhandene Nutzerdaten werden nicht kopiert.
4. Der zusätzliche Testblock verwendet die vorhandenen PowerShell-/Edge-
   Testhilfen aus `tests\ui-test.ps1`. Er bedient den Assistenten über das
   DevTools-Protokoll mit einem eigenen Edge-Profil und prüft den Direktimport
   mit selbst erzeugten Testdaten. Er verzögert die Importanfrage gezielt, um
   Sperren und Doppelklickschutz zu prüfen.
5. Der zusätzliche Testserver wird im `finally`-Block beendet. Testdateien,
   Importsicherung und Screenshot bleiben im temporären Assistenten-Testordner.

Der zusätzliche Assistenten-Testblock wurde im Chat bereitgestellt und im
Testordner erzeugt; er ist kein Bestandteil des getesteten Commits. Die dortige
Screenshot-Datei heißt `ergebnisse\assistent-ergebnis.png`.

Die Testskripte verwenden `D:\CONTENT-REVENUE-OS` nicht. Sie starten oder ändern
die bestehende Winner Library nicht. Es werden keine neuen Dienste installiert,
API-Schlüssel benötigt oder kostenpflichtigen Angebote verwendet.

## Ergebnisse

Die erste vom Nutzer gezeigte Ergebnisansicht meldet `ALL CHECKS PASSED` für die
API-Suite und `ALL UI CHECKS PASSED` für die 28 bestehenden Library-UI-Prüfungen.
Die API-Suite des geprüften Commits enthält 41 Prüfungen.

Die zweite Ergebnisansicht bestätigt alle 15 gezielten Assistentenprüfungen:

| Prüfung | Ergebnis |
| --- | --- |
| Deutsche Benutzerführung | Bestanden |
| Ungültiges JSON blockiert Freigabe und Import | Bestanden |
| JSON-Vorschau erfindet keine unbekannten Werte | Bestanden |
| Feldvorschau verwendet deutsche Anzeigenamen | Bestanden |
| Ohne Quellenfreigabe kein Import | Bestanden |
| Eigener Bestätigungsdialog erscheint | Bestanden |
| Abbrechen speichert nichts | Bestanden |
| Quellenänderung setzt Freigabe und Dialog zurück | Bestanden |
| Vor Bestätigung keine Schreibanfrage | Bestanden |
| Doppelklick sendet genau eine freigegebene Anfrage | Bestanden |
| Während ausstehender Anfrage keine Datenveränderung | Bestanden |
| Direktimport legt genau einen neuen Eintrag an | Bestanden |
| Vorhandene Testeinträge bleiben unverändert | Bestanden |
| Weiterer Import bleibt gesperrt | Bestanden |
| Keine JavaScript- oder CSP-Fehler | Bestanden |

Zusätzlich wurde die Existenz der vor dem Import erstellten Sicherungsdatei
geprüft: `PASS Importsicherung vorhanden`. Die Abschlussmeldung lautet
`ALLE ASSISTENTEN-PRUEFUNGEN BESTANDEN`; danach kehrt PowerShell zum Prompt zurück.

## Aussage und Grenzen

Der bezeichnete Commit hat die genannten automatisierten Prüfungen auf Windows
mit PowerShell 5.1 und Edge bestanden. Es sind aus diesen Prüfungen keine Fehler
offen. Die Screenshots wurden vom Nutzer im Chat bereitgestellt; sie werden mit
diesem Dokument nicht als Bilddateien ins Repository übernommen.

Die Prüfungen belegen die getesteten Abläufe. Sie ersetzen nicht den fachlichen
Quellenabgleich bei echten KI-Antworten und prüfen nicht sämtliche Edge-Versionen
oder jede mögliche manuelle Bedienfolge.

Diese Dokumentation ändert keinen Anwendungscode und keine Daten. Ein Push dieses
Berichts, ein Merge nach `main`, ein Deployment oder die Übernahme in
`D:\CONTENT-REVENUE-OS` sind jeweils getrennt freizugeben.
