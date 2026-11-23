// Cloudflare-Worker „golfclub-euregio-platz“ (Konto Leon): Platzstatus für die neue Website.
// GET  /status      -> aktueller Stand als JSON (für Website und Bildschirme, offen für alle)
// GET  /<TOKEN>     -> Platzwart-Portal (TOKEN liegt nur als Secret im Worker, nie in Dateien)
// POST /<TOKEN>     -> speichert {greenState: "01"…"08"}
// Solange das alte Portal noch benutzt wird, gilt der jeweils neuere Stand (alt oder neu).
const ALT_JSON = 'https://golfclub-euregio.de/wp-content/uploads/platz-und-kart-status.json';
const RAW = 'https://raw.githubusercontent.com/Leonossendorf/entwurf-38/main/public/bilder/';
const BILDER = { 'cart.png': 'symbol-cart.png', 'trolley.png': 'symbol-trolley.png', 'bag.png': 'symbol-bag.png', 'logo.png': 'logo-weiss.png' };
// platz, cart, trolley, bag, range
const Z = { '01': [1,1,1,1,1], '02': [1,0,1,1,1], '03': [1,0,0,1,1], '04': [0,0,0,0,1], '05': [1,1,1,1,0], '06': [1,0,1,1,0], '07': [1,0,0,1,0], '08': [0,0,0,0,0] };
const PLATZ = { 1: 'Alles erlaubt', 2: 'Ohne Cart', 3: 'Ohne Cart und Trolley', 4: 'Platz gesperrt' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const fehl = new Map();

const teile = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
const berlin = (ms) => { const p = teile(ms); return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`; };
function altZeit(s) {
  const m = /(\d\d)\.(\d\d)\.(\d{4}) (\d\d):(\d\d)/.exec(s || '');
  if (!m) return 0;
  const utc = Date.UTC(+m[3], m[2] - 1, +m[1], +m[4], +m[5]);
  const p = teile(utc);
  return utc - (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - utc);
}
const kurz = (gs) => { const n = +gs; return `${PLATZ[((n - 1) % 4) + 1]}, Range ${n <= 4 ? 'offen' : 'gesperrt'}`; };

async function aktuell(env) {
  let s = await env.PLATZ.get('status', { type: 'json' });
  try {
    const r = await fetch(ALT_JSON, { cf: { cacheTtl: 60 } });
    if (r.ok) { const j = await r.json(); const t = altZeit(j.date); if (Z[j.greenState] && t && (!s || t > s.zeit)) s = { greenState: j.greenState, zeit: t, quelle: 'altes Portal' }; }
  } catch {}
  if (!s) s = { greenState: '01', zeit: Date.now(), quelle: 'Standard' };
  const z = Z[s.greenState];
  return { greenState: s.greenState, stand: berlin(s.zeit), zeit: s.zeit, quelle: s.quelle || 'neues Portal', text: kurz(s.greenState), platz: !!z[0], cart: !!z[1], trolley: !!z[2], bag: !!z[3], range: !!z[4] };
}

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const pfad = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (pfad === '/status') return json(await aktuell(env));
    if (pfad.startsWith('/bild/') && BILDER[pfad.slice(6)]) {
      const r = await fetch(RAW + BILDER[pfad.slice(6)], { cf: { cacheTtl: 86400 } });
      return new Response(r.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
    }
    const ip = req.headers.get('cf-connecting-ip') || '?';
    if ((fehl.get(ip) || 0) > 30) return new Response('Zu viele Versuche', { status: 429 });
    if (!env.TOKEN || pfad !== '/' + env.TOKEN) { fehl.set(ip, (fehl.get(ip) || 0) + 1); return new Response('Nicht gefunden', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } }); }
    if (req.method === 'POST') {
      let gs;
      try { gs = (await req.json()).greenState; } catch {}
      if (!Z[gs]) return json({ fehler: 'Ungültige Auswahl' }, 400);
      const eintrag = { greenState: gs, zeit: Date.now(), quelle: 'neues Portal' };
      await env.PLATZ.put('status', JSON.stringify(eintrag));
      const verlauf = (await env.PLATZ.get('verlauf', { type: 'json' })) || [];
      verlauf.unshift(eintrag);
      await env.PLATZ.put('verlauf', JSON.stringify(verlauf.slice(0, 100)));
      return json({ ok: true, stand: berlin(eintrag.zeit), text: kurz(gs) });
    }
    const s = await aktuell(env);
    const verlauf = ((await env.PLATZ.get('verlauf', { type: 'json' })) || []).slice(0, 5);
    return new Response(seite(s, verlauf), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
  },
};

const FLAGGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 21V3"/><path d="M7 3.4c1.9-.8 3.7-.8 5.6 0s3.7.8 5.6 0v6.4c-1.9.8-3.7.8-5.6 0s-3.7-.8-5.6 0z" fill="currentColor"/><path d="M3 21h12"/></svg>';
const RANGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="7" r="3.2"/><path d="M12 10.2V16"/><path d="M10 10.5h4"/><path d="M4 20h16"/><path d="M3.5 16h3"/><path d="M17.5 16h3"/></svg>';
const sym = (art, ok, name) => `<span class="sym ${ok ? 'ja' : 'nein'}" title="${name} ${ok ? 'erlaubt' : 'nicht erlaubt'}">${art === 'platz' ? FLAGGE : art === 'range' ? RANGE : `<i class="maske m-${art}"></i>`}<b>${ok ? '✓' : '✕'}</b><small>${name}</small></span>`;

function seite(s, verlauf) {
  const n = +s.greenState, platzWahl = ((n - 1) % 4) + 1, rangeOffen = n <= 4;
  const kachel = (i) => { const z = Z['0' + i]; return `<label class="wahl"><input type="radio" name="platz" value="${i}"${i === platzWahl ? ' checked' : ''}><span class="wahl__name">${PLATZ[i]}</span><span class="syms">${sym('platz', z[0], 'Platz')}${sym('cart', z[1], 'Cart')}${sym('trolley', z[2], 'Trolley')}${sym('bag', z[3], 'Bag')}</span></label>`; };
  const range = (offen) => `<label class="wahl wahl--klein"><input type="radio" name="range" value="${offen ? 'offen' : 'zu'}"${offen === rangeOffen ? ' checked' : ''}><span class="wahl__name">Range ${offen ? 'offen' : 'gesperrt'}</span><span class="syms">${sym('range', offen, 'Range')}</span></label>`;
  const liste = verlauf.length ? verlauf.map((v) => `<li><span>${berlin(v.zeit)}</span>${kurz(v.greenState)}</li>`).join('') : '<li>Noch keine Änderung über das neue Portal.</li>';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#19343f"><title>Platzstatus · Golfclub Euregio</title><link rel="apple-touch-icon" href="/bild/logo.png"><style>
*{box-sizing:border-box}html,body{margin:0;background:#19343f;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:18px}
main{max-width:520px;margin:0 auto;padding:18px 16px 40px}
.kopf{display:flex;align-items:center;justify-content:space-between;gap:12px}.kopf img{height:54px;display:block}
.neu{background:#8cc04b;color:#14262d;font-weight:800;font-size:.72rem;letter-spacing:.08em;padding:.35em .7em;border-radius:99px;white-space:nowrap}
h1{font-weight:500;font-size:1.6rem;margin:18px 0 2px}.unter{margin:0 0 16px;color:#b9cbd1;font-size:.9rem}
.jetzt{background:rgba(255,255,255,.08);border-radius:14px;padding:12px 14px;margin-bottom:22px}.jetzt small{display:block;color:#b9cbd1;font-size:.8rem}.jetzt strong{font-size:1.05rem;font-weight:600}
h2{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#b9cbd1;font-weight:700;margin:0 0 8px}
.gruppe{display:grid;gap:10px;margin-bottom:24px}.gruppe--zwei{grid-template-columns:1fr 1fr}
.wahl{display:block;border:3px solid rgba(255,255,255,.14);border-radius:16px;padding:12px 14px;cursor:pointer;background:rgba(255,255,255,.03)}
.wahl:has(input:checked){border-color:#fff;background:rgba(255,255,255,.12)}.wahl input{position:absolute;opacity:0}
.wahl:has(input:focus-visible){outline:3px solid #8cc04b;outline-offset:2px}
.wahl__name{display:block;font-weight:600;font-size:1.05rem;margin-bottom:8px}
.syms{display:flex;gap:14px}.sym{position:relative;display:flex;flex-direction:column;align-items:center;width:52px;color:#fff}
.sym svg,.maske{width:34px;height:34px;display:block}.maske{background:#fff;-webkit-mask:var(--b) center/contain no-repeat;mask:var(--b) center/contain no-repeat}
.m-cart{--b:url(/bild/cart.png)}.m-trolley{--b:url(/bild/trolley.png)}.m-bag{--b:url(/bild/bag.png)}
.sym b{position:absolute;top:-4px;right:2px;width:18px;height:18px;border-radius:50%;font-size:11px;display:grid;place-items:center;color:#fff}
.sym.ja b{background:#5aa33b}.sym.nein b{background:#d64545}.sym.nein svg,.sym.nein .maske{opacity:.45}
.sym small{font-size:.68rem;color:#d6e2e6;margin-top:3px}
button{width:100%;font-size:1.25rem;font-weight:600;color:#19343f;background:#fff;border:0;border-radius:14px;padding:16px;cursor:pointer}button:disabled{opacity:.6}
.meldung{min-height:1.4em;margin:12px 0 0;text-align:center;font-weight:600}.meldung.ok{color:#a7d97c}.meldung.fehler{color:#ff9b9b}
.verlauf{margin-top:30px}.verlauf ul{list-style:none;margin:0;padding:0;font-size:.85rem;color:#d6e2e6}.verlauf li{padding:6px 0;border-top:1px solid rgba(255,255,255,.1)}.verlauf li span{display:inline-block;min-width:9.5em;color:#b9cbd1}
.fuss{margin-top:26px;font-size:.78rem;color:#8fa6ad;text-align:center}
</style></head><body><main>
<div class="kopf"><img src="/bild/logo.png" alt="Golfclub Euregio Bad Bentheim"><span class="neu">NEUES PORTAL</span></div>
<h1>Platzstatus</h1><p class="unter">Für die neue Website des Golfclubs. Auswählen und speichern.</p>
<div class="jetzt"><small>Gerade auf der Website</small><strong id="jetzt">${s.text}</strong><small id="stand">Stand ${s.stand} Uhr</small></div>
<form id="form">
<h2>Golfplatz</h2><div class="gruppe">${[1, 2, 3, 4].map(kachel).join('')}</div>
<h2>Driving Range</h2><div class="gruppe gruppe--zwei">${range(true)}${range(false)}</div>
<button type="submit" id="knopf">Speichern</button><p class="meldung" id="meldung" role="status"></p>
</form>
<div class="verlauf"><h2>Zuletzt geändert</h2><ul id="verlauf">${liste}</ul></div>
<p class="fuss">Tipp: Über „Zum Home-Bildschirm“ wird diese Seite wie eine App gespeichert.<br>Den Link bitte nicht weitergeben.</p>
</main><script>
var f=document.getElementById('form'),k=document.getElementById('knopf'),m=document.getElementById('meldung');
f.addEventListener('submit',async function(e){e.preventDefault();
var p=+f.querySelector('input[name=platz]:checked').value,r=f.querySelector('input[name=range]:checked').value;
var gs=String(p+(r==='zu'?4:0)).padStart(2,'0');k.disabled=true;k.textContent='Wird gespeichert …';m.textContent='';m.className='meldung';
try{var res=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({greenState:gs})});var j=await res.json();if(!res.ok)throw 0;
document.getElementById('jetzt').textContent=j.text;document.getElementById('stand').textContent='Stand '+j.stand+' Uhr';
var li=document.createElement('li');li.innerHTML='<span>'+j.stand+'</span>'+j.text;var u=document.getElementById('verlauf');if(u.children.length===1&&!u.firstElementChild.querySelector('span'))u.innerHTML='';u.prepend(li);
m.textContent='Gespeichert. Die Website zeigt es in spätestens einer Minute.';m.className='meldung ok';
}catch(x){m.textContent='Nicht gespeichert. Bitte noch einmal versuchen.';m.className='meldung fehler';}
k.disabled=false;k.textContent='Speichern';});
</script></body></html>`;
}
