// Cloudflare Pages: kleines Programm nur für den Ordner /film/ (siehe _routes.json).
// Cloudflare liefert große Dateien bei Teilabrufen (Range) sonst ganz aus; Safari und iPhone spielen den Film dann nicht ab
// (https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/, „Range requests“). Vorlage: Engelshove.
const teilstueck = async (env, request, url) => {
  const voll = await env.ASSETS.fetch(new Request(url.toString()));
  if (!voll.ok) return voll;
  const k = new Headers(voll.headers);
  k.set('Accept-Ranges', 'bytes');
  k.set('Cache-Control', 'public, max-age=2592000');
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!m || (m[1] === '' && m[2] === '')) return new Response(request.method === 'HEAD' ? null : voll.body, { status: 200, headers: k });
  const ganz = await voll.arrayBuffer(), lang = ganz.byteLength;
  const von = m[1] === '' ? Math.max(0, lang - Number(m[2])) : Number(m[1]);
  const bis = m[1] === '' || m[2] === '' ? lang - 1 : Math.min(Number(m[2]), lang - 1);
  if (von > bis || von >= lang) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + lang } });
  k.set('Content-Range', `bytes ${von}-${bis}/${lang}`);
  k.set('Content-Length', String(bis - von + 1));
  return new Response(request.method === 'HEAD' ? null : ganz.slice(von, bis + 1), { status: 206, headers: k });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (/\.(mp4|webm|mp3)$/i.test(url.pathname)) return teilstueck(env, request, url);
    return env.ASSETS.fetch(request);
  },
};
