// Gemeinsame Termin-Logik: läuft beim Bauen (Node) und im Browser.
// Quellen: drei öffentliche iCal-Kalender aus PC CADDIE plus eigene Einträge (src/data/termine.json).

export const PCC_BASIS = 'https://www.golfcloud.com/clubs/0493312/app.php';
export const FEEDS = [
  { quelle: 'turniere', url: `${PCC_BASIS}?cat=ts_calendar&sub=ics`, link: 'https://www.pccaddie.net/clubs/0493312/app.php?cat=ts_calendar' },
  { quelle: 'kurse', url: `${PCC_BASIS}?cat=ts_calendar_course&sub=ics`, link: 'https://www.pccaddie.net/clubs/0493312/app.php?cat=ts_calendar_course' },
  { quelle: 'events', url: `${PCC_BASIS}?cat=ts_calendar_event&sub=ics`, link: 'https://www.pccaddie.net/clubs/0493312/app.php?cat=ts_calendar_event' },
];

export const KATEGORIEN = [
  { id: 'turniere', name: 'Turniere', farbe: 'petrol' },
  { id: 'damengolf', name: 'Damengolf', farbe: 'rot' },
  { id: 'herrengolf', name: 'Herrengolf', farbe: 'petrol2' },
  { id: 'einsteiger', name: 'Einsteiger', farbe: 'gruen' },
  { id: 'kurse', name: 'Kurse der Golfschule', farbe: 'gruen2' },
  { id: 'jugend', name: 'Kinder und Jugend', farbe: 'gelb' },
  { id: 'clubleben', name: 'Clubleben', farbe: 'grau' },
  { id: 'restaurant', name: 'Restaurant', farbe: 'braun' },
  { id: 'anlage', name: 'Platz und Anlage', farbe: 'hell' },
];
export const kategorieName = (id) => (KATEGORIEN.find((k) => k.id === id) || { name: id }).name;

// --- iCal lesen -------------------------------------------------------------
function entfalten(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}
function unescape(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
function icsDatum(v) {
  // 20261110T100000Z oder 20261110T100000 oder 20261110
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  // ohne Z: als Ortszeit Bad Bentheim lesen (Annäherung über Winter-/Sommerzeit)
  return lokalNachUtc(+y, +mo, +d, +h, +mi);
}
function lokalNachUtc(y, mo, d, h, mi) {
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const teile = zeitteile(probe);
  const diff = (teile.stunde - h) * 60 + (teile.minute - mi);
  return new Date(probe.getTime() - diff * 60000);
}

export function parseICS(text, quelle, link) {
  const zeilen = entfalten(text).split('\n');
  const termine = [];
  let akt = null;
  for (const z of zeilen) {
    if (z === 'BEGIN:VEVENT') akt = {};
    else if (z === 'END:VEVENT') {
      if (akt && akt.start) termine.push(akt);
      akt = null;
    } else if (akt) {
      const i = z.indexOf(':');
      if (i < 0) continue;
      const schluessel = z.slice(0, i).split(';')[0];
      const wert = unescape(z.slice(i + 1));
      if (schluessel === 'SUMMARY') akt.titel = wert.trim();
      if (schluessel === 'DESCRIPTION') akt.beschreibung = wert;
      if (schluessel === 'DTSTART') akt.start = icsDatum(wert);
      if (schluessel === 'DTEND') akt.ende = icsDatum(wert);
      if (schluessel === 'UID') akt.uid = wert;
    }
  }
  return termine.map((t) => aufbereiten(t, quelle, link));
}

// Zeit in Bad Bentheim
export function zeitteile(datum) {
  const f = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(datum).map((x) => [x.type, x.value]));
  return { jahr: +p.year, monat: +p.month, tag: +p.day, stunde: +p.hour % 24, minute: +p.minute, wochentag: p.weekday };
}
const iso = (t) => `${t.jahr}-${String(t.monat).padStart(2, '0')}-${String(t.tag).padStart(2, '0')}`;
const uhr = (t) => `${String(t.stunde).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

function kategorisieren(titel, quelle) {
  const t = titel.toLowerCase();
  if (/di ?da ?go|damen/.test(t)) return 'damengolf';
  if (/herrengolf|mihego|amigo/.test(t)) return 'herrengolf';
  if (/platzreife|golfentdeck|schnupper|rabbit|einsteiger/.test(t)) return 'einsteiger';
  if (/jugend|kinder/.test(t)) return 'jugend';
  if (quelle === 'kurse') return 'kurse';
  if (quelle === 'events') return 'clubleben';
  return 'turniere';
}

function aufbereiten(t, quelle, link) {
  const s = zeitteile(t.start);
  const ganztags = s.stunde === 0 && s.minute === 0;
  const beschreibung = (t.beschreibung || '').split('\n').map((x) => x.trim()).filter(Boolean);
  // erste Zeile wiederholt meist den Titel, zweite enthält Spielform, Löcher, Spielleitung
  const details = beschreibung.filter((x) => x !== t.titel && !/^golfclub euregio|^am hauptdiek|^48455|^tel:/i.test(x)).slice(0, 2).join(' · ');
  return {
    id: `${quelle}-${t.uid || iso(s) + t.titel}`,
    titel: (t.titel || '').replace(/\s+Start\s+\d{1,2}:\d{2}\s*Uhr$/i, ''),
    kategorie: kategorisieren(t.titel || '', quelle),
    datum: iso(s),
    uhrzeit: ganztags ? '' : uhr(s),
    ende: '',
    text: details.replace(/\s+-\s+/g, ' · '),
    link,
    linktext: 'Anmelden in PC CADDIE',
    quelle: 'pccaddie',
  };
}

// --- eigene Einträge (mit wöchentlicher Wiederholung) -----------------------
export function eigeneAufklappen(liste, heute = new Date()) {
  const raus = [];
  const heuteIso = iso(zeitteile(heute));
  for (const e of liste) {
    if (e.wiederholung && e.wiederholung.wochentage && e.wiederholung.wochentage.length) {
      const von = new Date(`${e.wiederholung.von || heuteIso}T12:00:00Z`);
      const bis = new Date(`${e.wiederholung.bis}T12:00:00Z`);
      for (let d = new Date(von); d <= bis; d = new Date(d.getTime() + 86400000)) {
        if (e.wiederholung.wochentage.includes(d.getUTCDay())) {
          const datum = d.toISOString().slice(0, 10);
          raus.push({ ...e, id: `eigen-${e.titel}-${datum}`, datum, quelle: 'club' });
        }
      }
    } else {
      raus.push({ ...e, id: `eigen-${e.titel}-${e.datum}`, quelle: 'club' });
    }
  }
  return raus;
}

export function zusammenfuehren(pcc, eigene, heute = new Date(), tageVoraus = 400) {
  const heuteIso = iso(zeitteile(heute));
  const grenze = iso(zeitteile(new Date(heute.getTime() + tageVoraus * 86400000)));
  const alle = [...pcc, ...eigeneAufklappen(eigene, heute)].filter((t) => (t.bis || t.datum) >= heuteIso && t.datum <= grenze);
  alle.sort((a, b) => (a.datum + (a.uhrzeit || '00:00')).localeCompare(b.datum + (b.uhrzeit || '00:00')));
  return alle;
}

// --- Darstellung --------------------------------------------------------------
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export function datumTeile(isoDatum) {
  const d = new Date(`${isoDatum}T12:00:00Z`);
  return { tag: d.getUTCDate(), monat: MONATE[d.getUTCMonth()], monatKurz: MONATE[d.getUTCMonth()].slice(0, 3), wochentag: TAGE[d.getUTCDay()], jahr: d.getUTCFullYear() };
}
export function monatsSchluessel(isoDatum) {
  const t = datumTeile(isoDatum);
  return `${t.monat} ${t.jahr}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
export function terminHtml(t) {
  const d = datumTeile(t.datum);
  const zeit = t.uhrzeit ? `${t.uhrzeit}${t.ende ? `–${t.ende}` : ''} Uhr` : (t.bis ? `bis ${datumTeile(t.bis).tag}. ${datumTeile(t.bis).monat}` : 'ganztägig');
  const knopf = t.link ? `<a class="termin__link" href="${esc(t.link)}"${/^https?:/.test(t.link) ? ' rel="noopener"' : ''}>${esc(t.linktext || 'Mehr erfahren')}</a>` : '';
  return `<li class="termin" data-kategorie="${esc(t.kategorie)}">
  <p class="termin__datum" aria-hidden="true"><span class="termin__tag">${d.tag}</span><span class="termin__monat">${d.monatKurz}</span></p>
  <div class="termin__inhalt">
    <p class="termin__meta"><span class="marke marke--${esc(t.kategorie)}">${esc(kategorieName(t.kategorie))}</span> <span class="visuell-versteckt">${d.wochentag}, ${d.tag}. ${d.monat} ${d.jahr},</span><span aria-hidden="true">${d.wochentag}</span> · ${esc(zeit)}</p>
    <h3 class="termin__titel">${esc(t.titel)}</h3>
    ${t.text ? `<p class="termin__text">${esc(t.text)}</p>` : ''}
    <p class="termin__aktionen">${knopf}<button type="button" class="termin__kalender" data-id="${esc(t.id)}">In meinen Kalender</button></p>
  </div>
</li>`;
}
export function listeHtml(termine, { gruppieren = true } = {}) {
  if (!termine.length) return '<p class="termine__leer">Für diese Auswahl stehen gerade keine Termine an.</p>';
  if (!gruppieren) return `<ol class="termine__liste">${termine.map(terminHtml).join('')}</ol>`;
  const gruppen = new Map();
  for (const t of termine) {
    const k = monatsSchluessel(t.datum);
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(t);
  }
  return [...gruppen].map(([monat, liste]) => `<section class="termine__monat" aria-label="${esc(monat)}"><h2 class="termine__monatstitel">${esc(monat)}</h2><ol class="termine__liste">${liste.map(terminHtml).join('')}</ol></section>`).join('');
}

// Einzelnen Termin als .ics erzeugen (für "In meinen Kalender")
export function terminAlsIcs(t) {
  const p = (x) => String(x).padStart(2, '0');
  const [y, m, d] = t.datum.split('-');
  let start, ende;
  if (t.uhrzeit) {
    const [h, mi] = t.uhrzeit.split(':');
    start = `DTSTART;TZID=Europe/Berlin:${y}${m}${d}T${p(h)}${p(mi)}00`;
    const [eh, emi] = (t.ende || `${p(+h + 2)}:${mi}`).split(':');
    ende = `DTEND;TZID=Europe/Berlin:${y}${m}${d}T${p(eh)}${p(emi)}00`;
  } else {
    start = `DTSTART;VALUE=DATE:${y}${m}${d}`;
    const n = new Date(`${t.datum}T12:00:00Z`);
    n.setUTCDate(n.getUTCDate() + 1);
    ende = `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const text = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Golfclub Euregio//Termine//DE', 'BEGIN:VEVENT', `UID:${text(t.id)}@golfclub-euregio.de`, start, ende, `SUMMARY:${text(t.titel)}`, `DESCRIPTION:${text(t.text)}`, 'LOCATION:Golfclub Euregio Bad Bentheim\\, Am Hauptdiek 8\\, 48455 Bad Bentheim', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
