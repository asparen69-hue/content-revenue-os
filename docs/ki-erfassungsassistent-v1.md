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

## Nächste Implementierung
Zuerst die genaue Feldliste aus `config/winner-fields.json` und die Importstruktur aus `server.ps1` prüfen; danach einen **separaten** Eingabe- und Vorschauworkflow mit Tests entwickeln. Keine bestehende UI ersetzen.
