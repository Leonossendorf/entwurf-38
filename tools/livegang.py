"""Schaltet die Website von der Entwurfsadresse auf www.golfclub-euregio.de um.

Aufruf im Repo-Ordner:  python tools/livegang.py
Danach: bauen, prüfen, committen, pushen, dann die Domain in GitHub Pages setzen
(gh api -X PUT repos/Leonossendorf/entwurf-38/pages -f cname=www.golfclub-euregio.de)
und erst dann die DNS-Einträge bei Hetzner ändern (Liste unten).

Was das Skript ändert:
- noindex aus dem Seitenkopf (Basis.astro) entfernen
- robots.txt: Suchmaschinen erlauben, Sitemap-Adresse
- astro.config: site = https://www.golfclub-euregio.de
- public/CNAME = www.golfclub-euregio.de
- Testschalter für die Kopfleiste entfernen (Komponente, Einbindung, Kopfzeile, CSS-Block),
  die gewählte Variante bleibt als feste Gestaltung (VARIANTE unten)

DNS bei Hetzner (Zone golfclub-euregio.de, nur diese Einträge ändern, Mail-Einträge MX/TXT/DKIM nicht anfassen):
  @    A      185.199.108.153
  @    A      185.199.109.153
  @    A      185.199.110.153
  @    A      185.199.111.153
  www  CNAME  leonossendorf.github.io.
Der Eintrag wwwalt (alter Server) bleibt, damit die alte Seite zum Nachschauen erreichbar ist.
"""
import pathlib, re, sys

VARIANTE = sys.argv[1] if len(sys.argv) > 1 else None  # '1', '2' oder '3' (Testschalter-Wahl)
if VARIANTE not in ('1', '2', '3'):
    sys.exit('Bitte die gewählte Variante der Trennlinie angeben: python tools/livegang.py 1|2|3')

R = pathlib.Path(__file__).resolve().parent.parent
def lies(p): return (R / p).read_text(encoding='utf-8')
def schreib(p, s): (R / p).write_text(s, encoding='utf-8')

b = lies('src/layouts/Basis.astro')
b = b.replace('    <meta name="robots" content="noindex, nofollow" />\n', '')
b = b.replace("import TestSchalter from '../components/TestSchalter.astro';\n", '')
b = b.replace('    <TestSchalter />\n', '')
b = re.sub(r"      try \{ document\.documentElement\.setAttribute\('data-trenner'.*\n", '', b)
b = b.replace('<html lang="de">', f'<html lang="de" data-trenner="{VARIANTE}">')
schreib('src/layouts/Basis.astro', b)
(R / 'src/components/TestSchalter.astro').unlink(missing_ok=True)

c = lies('src/styles/global.css')
c = re.sub(r'\n/\* --- Testschalter \(nur zum Testen, vor Livegang entfernen\) --- \*/.*?@media print \{ \.testschalter \{ display: none; \} \}\n', '\n', c, flags=re.S)
schreib('src/styles/global.css', c)

schreib('public/robots.txt', 'User-agent: *\nAllow: /\n')
schreib('public/CNAME', 'www.golfclub-euregio.de\n')
a = lies('astro.config.mjs')
a = a.replace("site: 'https://golfeuregio.leonossendorf.de'", "site: 'https://www.golfclub-euregio.de'")
schreib('astro.config.mjs', a)
print('Umgestellt. Jetzt bauen, prüfen, committen und pushen.')
