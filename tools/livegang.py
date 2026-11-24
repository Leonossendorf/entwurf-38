"""ERLEDIGT am 24.11.2026. Schaltet die Website von der Entwurfsadresse auf www.golfclub-euregio.de um.

Aufruf im Repo-Ordner:  python tools/livegang.py
Danach: bauen, prüfen, committen, pushen, dann die Domain in GitHub Pages setzen
(gh api -X PUT repos/Leonossendorf/entwurf-38/pages -f cname=www.golfclub-euregio.de)
und erst dann die DNS-Einträge bei Hetzner ändern (Liste unten).

Was das Skript ändert:
- noindex aus dem Seitenkopf (Basis.astro) entfernen
- robots.txt: Suchmaschinen erlauben, Sitemap-Adresse
- astro.config: site = https://www.golfclub-euregio.de
- public/CNAME = www.golfclub-euregio.de

DNS bei Hetzner (Zone golfclub-euregio.de, nur diese Einträge ändern, Mail-Einträge MX/TXT/DKIM nicht anfassen):
  @    A      185.199.108.153
  @    A      185.199.109.153
  @    A      185.199.110.153
  @    A      185.199.111.153
  @    AAAA   2606:50c0:8000::153 / 8001 / 8002 / 8003 ::153 (alter AAAA 2a01:4f8:d0a:281c::2 weg)
  www  CNAME  leonossendorf.github.io.
Der Eintrag wwwalt (alter Server) bleibt, damit die alte Seite zum Nachschauen erreichbar ist.
"""
import pathlib

R = pathlib.Path(__file__).resolve().parent.parent
def lies(p): return (R / p).read_text(encoding='utf-8')
def schreib(p, s): (R / p).write_text(s, encoding='utf-8')

b = lies('src/layouts/Basis.astro')
b = b.replace('    <meta name="robots" content="noindex, nofollow" />\n', '')
schreib('src/layouts/Basis.astro', b)
schreib('public/robots.txt', 'User-agent: *\nAllow: /\n')
schreib('public/CNAME', 'www.golfclub-euregio.de\n')
a = lies('astro.config.mjs')
a = a.replace("site: 'https://golfeuregio.leonossendorf.de'", "site: 'https://www.golfclub-euregio.de'")
schreib('astro.config.mjs', a)
print('Umgestellt. Jetzt bauen, prüfen, committen und pushen.')
