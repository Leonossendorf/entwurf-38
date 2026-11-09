# Website Golfclub Euregio Bad Bentheim (Entwurf)

Gebaut mit Astro. Online: https://golfeuregio.leonossendorf.de (noindex, Entwurf von Leon Ossendorf).

- Inhalte bearbeiten: https://golfeuregio.leonossendorf.de/admin/ (Sveltia CMS, Anmeldung mit GitHub-Token)
- Texte: src/content/texte, Neuigkeiten: src/content/aktuelles
- Daten (Termine, Preise, Zeiten, Personen, Platzstatus): src/data
- Termine aus PC CADDIE: werden beim Bauen und im Browser live aus drei iCal-Kalendern geladen (src/lib/termine.js)
- Bilder: public/bilder (WebP), Quellen in material/QUELLEN.md
- Bauen: npm install, npm run build; GitHub Actions baut bei jedem Speichern und alle drei Stunden neu.
