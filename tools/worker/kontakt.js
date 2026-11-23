// Mail-Dienst für das Kontaktformular der Golfclub-Website, als Cloudflare Worker „golfclub-euregio-kontakt“.
// Enthält keine Geheimnisse. Einstellungen im Worker:
//   RESEND_API_KEY (Secret)  Schlüssel für den Versand über Resend
//   CONTACT_FROM             Absender, z. B. „Website Golfclub Euregio <formular@leonossendorf.de>“
//   UMLEITUNG (optional)     schickt zum Testen alle Nachrichten an diese eine Adresse statt an die Postfächer
// Die Zuordnung Thema → Postfach muss zu src/data/postfaecher.json passen.
// Spamschutz: nur Aufrufe von der eigenen Website, verstecktes Feld (firma), Mindestzeit seit Seitenaufruf, höchstens 5 Versuche je Viertelstunde.
// Es wird nichts gespeichert: Die Angaben gehen als E-Mail an den Club, die Antwortadresse ist die des Absenders.
const ERLAUBT = ['https://www.golfclub-euregio.de', 'https://golfclub-euregio.de', 'https://golfeuregio.leonossendorf.de'];
const POSTFACH = {
  service: ['Service-Pavillon', 'service@golfclub-euregio.de'],
  golfschule: ['Golfschule', 'rehbock-golfschule@web.de'],
  restaurant: ['Restaurant', 'restaurant@golfclub-euregio.de'],
  spielbetrieb: ['Spielbetrieb', 'spielfuehrer@golfclub-euregio.de'],
  jugend: ['Kinder und Jugend', 'jugendwart@golfclub-euregio.de'],
  buchhaltung: ['Beitrag und Rechnung', 'buchhaltung@golfclub-euregio.de'],
  presse: ['Fotos und Berichte', 'pressewart@golfclub-euregio.de'],
  vorstand: ['Vorstand', 'vorstand@golfclub-euregio.de'],
  info: ['Allgemeine Frage', 'info@golfclub-euregio.de'],
};
const TELEFON = '05922 9044310';
const zaehler = new Map();
function cors(o) { return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' }; }
function antwort(body, status, o) { return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors(o)) }); }
function sauber(v, max) { return String(v == null ? '' : v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, max); }

export default { async fetch(request, env) {
  const o = request.headers.get('Origin') || '';
  if (!ERLAUBT.includes(o)) return new Response('Nicht erlaubt', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/anfrage') return antwort({ error: 'Nicht gefunden.' }, 404, o);

  const ip = request.headers.get('CF-Connecting-IP') || 'x', jetzt = Date.now();
  if (zaehler.size > 5000) zaehler.clear();
  const z = zaehler.get(ip) || { n: 0, bis: jetzt + 900000 };
  if (z.bis < jetzt) { z.n = 0; z.bis = jetzt + 900000; }
  z.n++; zaehler.set(ip, z);
  if (z.n > 5) return antwort({ error: 'Das waren mehrere Versuche hintereinander. Bitte in einer Viertelstunde noch einmal oder rufen Sie an: ' + TELEFON + '.' }, 429, o);
  if (+(request.headers.get('Content-Length') || 0) > 20000) return antwort({ error: 'Die Nachricht ist zu lang.' }, 413, o);

  let f;
  try { f = await request.json(); } catch (e) { return antwort({ error: 'Die Nachricht konnte nicht gelesen werden.' }, 400, o); }
  if (sauber(f.firma, 50) || +(f.dauer || 0) < 3000) return antwort({ state: 'accepted' }, 202, o);

  const [titel, an] = POSTFACH[f.thema] || POSTFACH.info;
  const name = sauber(f.name, 80).replace(/[\r\n]/g, ' ');
  const kontakt = sauber(f.kontakt, 160).replace(/[\r\n]/g, ' ');
  const text = sauber(f.nachricht, 4000);
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontakt);
  const telZ = kontakt.replace(/\D/g, '').length;
  const telOk = !mailOk && /^\+?[\d\s().\/-]+$/.test(kontakt) && telZ >= 6 && telZ <= 15;
  if (!mailOk && !telOk) return antwort({ error: 'Bitte eine gültige E-Mail-Adresse oder Telefonnummer eintragen.' }, 422, o);
  const id = sauber(f.id, 60);
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM) return antwort({ error: 'Der Versand ist noch nicht eingerichtet.' }, 503, o);

  const zeilen = ['Thema: ' + titel, 'Name: ' + (name || '(nicht angegeben)'), (mailOk ? 'E-Mail: ' : 'Telefon: ') + kontakt];
  if (!mailOk) zeilen.push('(Keine E-Mail-Adresse angegeben, bitte anrufen.)');
  const m = {
    from: env.CONTACT_FROM,
    to: [env.UMLEITUNG || an],
    subject: 'Website: ' + titel + (name ? ' von ' + name : ''),
    text: zeilen.join('\n') + '\n\n' + (text || '(keine weitere Nachricht)') + '\n\n--\nGesendet über das Kontaktformular der Website (Seite ' + sauber(f.seite, 80) + ').' + (env.UMLEITUNG ? '\n[Testumleitung, eigentlich an ' + an + ']' : ''),
  };
  if (mailOk) m.reply_to = kontakt;
  let ok = false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', ...(id ? { 'Idempotency-Key': id } : {}) }, body: JSON.stringify(m) });
    ok = r.ok;
  } catch (e) { ok = false; }
  if (!ok) return antwort({ error: 'Der Versand hat leider nicht geklappt.' }, 502, o);
  return antwort({ state: 'accepted' }, 202, o);
} };
