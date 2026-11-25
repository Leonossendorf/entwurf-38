"""Schreibt public/sitemap.xml aus dem fertigen Bau (dist) und trägt sie in robots.txt ein.
Aufruf nach dem Bauen, wenn Seiten dazukommen oder wegfallen:  python tools/sitemap.py  (danach neu bauen und pushen)."""
import datetime, pathlib, re

R = pathlib.Path(__file__).resolve().parent.parent
D = R / 'dist'
alt = re.findall(r"'([^']+)': '/", (R / 'src/pages/[...alt].astro').read_text(encoding='utf-8'))
urls = []
for p in sorted(D.rglob('index.html')):
    rel = p.parent.relative_to(D).as_posix()
    rel = '' if rel == '.' else rel
    if rel.startswith('admin') or rel in alt:
        continue
    if 'noindex' in p.read_text(encoding='utf-8', errors='ignore')[:4000]:
        continue
    urls.append('https://www.golfclub-euregio.de/' + (rel + '/' if rel else ''))
heute = datetime.date.today().isoformat()
x = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
x += ''.join(f'  <url><loc>{u}</loc><lastmod>{heute}</lastmod></url>\n' for u in urls) + '</urlset>\n'
(R / 'public/sitemap.xml').write_text(x, encoding='utf-8')
(R / 'public/robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: https://www.golfclub-euregio.de/sitemap.xml\n', encoding='utf-8')
print(len(urls), 'Seiten in der Sitemap')
