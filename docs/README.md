# Minigame — GitHub Pages ready

Diese Version ist statisch und nutzt PeerJS (öffentlichen Peer-Server) für WebRTC-Datenkanäle, sodass kein eigener Server nötig ist.

Wie benutzen:
1. Gehe auf https://<dein-github-username>.github.io/minigame/ (GitHub Pages muss aktiviert sein und auf `docs/` als Quelle zeigen oder die Seite auf `main`/`docs` veröffentlicht werden).
2. Öffne die Hauptseite (Bildschirm). Scanne den QR-Code mit dem Handy oder öffne `/controller.html?peer=<ID>`.

Hinweis: Falls die PeerJS-Cloud nicht erreichbar ist, funktioniert die Verbindung nicht. In dem Fall kann man alternativ eigene Signalisierungs-Server oder andere Dienste nutzen.
