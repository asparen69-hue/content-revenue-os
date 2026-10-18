# Winner Library V1 — UI terminology corrections

The Winner Library V1 structure is approved.

## Rules
- Do not change the data model.
- Do not change stored field keys.
- Do not break existing data.
- Do not add features.
- Keep the dark-blue + orange design.
- Only improve the visible German UI labels and terminology.
- After the changes, run the existing tests again.

## Replace these visible UI labels
- Armaturenbrett -> Dashboard
- Gewinnerbibliothek -> Winner Library
- Zugelassene Tests -> Für Tests freigegeben
- Chancenbewertung -> Opportunity Score
- Ersteller / Konto -> Creator / Account
- Haken und Öffnung -> Hook & Einstieg
- Problem / Pain Point -> Problem / Schmerzpunkt
- Desired outcome -> Gewünschtes Ergebnis
- Proof / credibility mechanism -> Glaubwürdigkeitsbeleg
- Objection handling -> Einwandbehandlung
- Visible performance signals -> Sichtbare Performance-Signale
- Why it probably worked -> Warum es vermutlich funktioniert
- Reusable underlying mechanism -> Wiederverwendbarer Mechanismus
- Evidence strength -> Evidenzstärke
- Research source -> Forschungsquelle
- Schmerzintensitätsskala -> Schmerzintensität
- Dringlichkeitsgrad -> Dringlichkeit
- Kaufabsichtsbewertung -> Kaufabsicht
- Inhaltspotenzialbewertung -> Content-Potenzial
- Differenzierungsgrad -> Differenzierung
- Produktionsfreundlichkeit -> Produktionsaufwand / Umsetzbarkeit
- Monetarisierungspotenzial -> Monetarisierungspotenzial
- Stärke der Evidenz -> Evidenzstärke
- Gesamtbewertung der Chancen -> Opportunity Score
- Rezension status -> Review

## Verification
After making the label changes:
1. Run the existing tests.
2. Confirm the app still loads.
3. Confirm the existing data is unchanged.
4. Report exactly which files were modified.


## 2026-10-18 – KI-Erfassungsassistent: deutsche Meldungen und direkter Import

- Deutsche Hinweise für JSON-, Datei-, Verbindungs- und Importfreigabefehler;
  unverarbeitete Laufzeitfehler erscheinen nicht mehr als Fehlermeldung im Browser.
- Automatische Strukturprüfung nach Eingabe mit optionaler manueller Wiederholung.
  Deutsche Feldvorschau, sichere Erkennung umschließender JSON-Codeblöcke und
  manueller Kopierweg bei gesperrter Zwischenablage.
- Direkter Import aus dem Assistenten nach Quellenabgleich und abschließender
  Dialogbestätigung. Datei-Export/-Import bleiben verfügbar. Keine automatischen
  Importe oder Wiederholungen, keine neuen Dienste oder API-Schlüssel.
- Während eines Importversuchs sind Eingaben gesperrt; Doppelklicks senden nicht
  erneut. Quelltext- oder Entwurfsänderungen setzen die Freigabe zurück.
- Isoliert geprüft: 43 Validierungstests, 7 Hilfsfunktionstests, 41 API-Prüfungen,
  28 bestehende UI-Prüfungen und der erweiterte Assistenten-Browsertest.
- Windows-/Edge-Abnahme von Commit `6964489` am 18.10.2026 erfolgreich:
  API-/Library-UI-Tests sowie gezielter Assistententest in separaten temporären
  Testordnern. Nachweis: vom Nutzer bereitgestellte Screenshots der Testausgabe.
  Details in `docs/windows-abnahme-6964489.md`.
- Schema, Nutzerdaten und Windows-Starter unverändert. Keine Merge- oder
  Deployment-Freigabe durch diese Abnahme.


## 2026-10-18 – Vorbereitung der sicheren lokalen Übernahme

- Datei-, Sicherungs- und Rücksetzplan für den getesteten Anwendungscode `6964489`.
- Manifest mit Prüfsummen für acht Laufzeitdateien und drei geschützte Vergleichsdateien.
- Lesendes PowerShell-Prüfskript; Bericht außerhalb der Library. Keine Installation,
  kein Start/Stop der Anwendung und kein Einlesen oder Ändern von Nutzerdaten.
- Acht isolierte Tests der Prüfsummen, Dateierkennung, Konflikte und Schreibfreiheit
  unter Linux/PowerShell 7.4.21 bestanden. Windows-Ausführung dieser neuen
  Vorbereitung ist der nächste Schritt; vorhandene Windows-Abnahme bleibt gültig.
- Anwendungscode, Konfiguration und Nutzerdaten unverändert. Keine Übernahme
  in `D:\CONTENT-REVENUE-OS`, kein Merge und kein Deployment ausgeführt.
