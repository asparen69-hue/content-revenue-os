# Auto Video Studio V1 (Entwicklungszweig)

**Ziel:** Aus realistischen Fahrzeug-Videoclips einen 20–30 Sekunden langen Instagram-/TikTok-Werbefilm in 1080 × 1920 (9:16) erzeugen.

**Wichtig:** Das ist die erste funktionsfähige **Schnitt-/Exportkomponente**, nicht bereits ein KI-Videogenerator. Die bewegten Szenen werden mit ComfyUI + Wan 2.2 (oder einem anderen Image-to-Video-Modell) erzeugt. Eine laufende GPU-Umgebung ist für die KI-Generierung notwendig. GitHub hostet den Quellcode, führt das Modell aber nicht selbst aus.

## Voraussetzungen
- Windows mit Python 3.9+
- FFmpeg mit `ffmpeg` und `ffprobe` im PATH
- 3–5 tatsächlich animierte MP4-Clips; keine statischen Bilder
- Optional: lizenzierte Musikdatei

## Beispiel
1. Projektdatei `project.json` neben die Clips legen.
2. Beispielstruktur:

```json
{
  "clips": [
    {"file": "clips/01_front.mp4", "seconds": 6},
    {"file": "clips/02_detail.mp4", "seconds": 5},
    {"file": "clips/03_door_to_cockpit.mp4", "seconds": 9},
    {"file": "clips/04_hero.mp4", "seconds": 6}
  ],
  "music": "musik.mp3"
}
```

3. Ausführen:

```powershell
python auto_video_studio/assemble.py auto_video_studio/project.json --output fahrzeugvideo.mp4
```

## Qualitätsanforderungen
Ein einziges Fahrzeug; korrekte Proportionen, Felgen, Lack und Interieur; mindestens fünf Sekunden Innenraum; Kamerafahrt durch geöffnete Fahrertür; keine Markenlogos, Fantasietexte oder falschen Fahrzeugangaben. Nur Material verwenden, für das Nutzungsrechte vorliegen.

## Nächster Entwicklungsschritt
ComfyUI-Workflow für Referenzbild → Wan 2.2 Image-to-Video integrieren und die entstandenen Clips automatisiert in die Projektdatei übernehmen. Das ist **noch nicht implementiert**.
