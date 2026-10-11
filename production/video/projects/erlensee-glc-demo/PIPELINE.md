# Erlensee Demo – Render Pipeline

## Ziel
Aus 5 vorhandenen 9:16-Bildern automatisch ein 20-Sekunden-MP4 erzeugen.

## Input
Die fünf Canva-Assets sind in `render-config.json` referenziert.

## Verarbeitung
1. Assets lokal oder über verfügbare Verbindung materialisieren.
2. Je Szene 4 Sekunden Standbild.
3. Dezente Bewegung laut `motion` anwenden.
4. Textlayer im unteren Drittel platzieren.
5. Zwischen Szene 1–4 Crossfade; letzte Szene ohne Ausblendzwang.
6. MP4 in 1080×1920, H.264, 30 fps rendern.

## Audio
V1 zunächst ohne Voiceover und ohne Musik rendern. Danach optional:
- ElevenLabs Voiceover
- lizenzierte Musik

## Output
`output/erlensee-glc-demo-v1.mp4`

## QA
- keine abgeschnittenen Fahrzeuge
- keine falschen technischen Behauptungen ergänzen
- Text vollständig lesbar
- Gesamtdauer 20 Sekunden ± 0,2 s
- keine Veröffentlichung ohne ausdrückliche Freigabe des Nutzers
