// Verhalten der Seite: Menüs, Barrierefreiheit, Kopf auf der Startseite, Formulare, Wetter, Öffnungszeiten heute.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

// --- Hauptmenü: Klappmenüs bleiben offen, bis man woanders klickt oder Esc drückt
const knoepfe = $$('.nav__knopf');
function schliesseAlle(ausser) {
  knoepfe.forEach((k) => {
    if (k === ausser) return;
    k.setAttribute('aria-expanded', 'false');
    const p = document.getElementById(k.getAttribute('aria-controls'));
    if (p) p.hidden = true;
  });
}
knoepfe.forEach((k) => {
  k.addEventListener('click', () => {
    const offen = k.getAttribute('aria-expanded') === 'true';
    schliesseAlle(k);
    k.setAttribute('aria-expanded', String(!offen));
    document.getElementById(k.getAttribute('aria-controls')).hidden = offen;
  });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.nav__eintrag')) schliesseAlle(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const offen = knoepfe.find((k) => k.getAttribute('aria-expanded') === 'true');
  if (offen) { schliesseAlle(); offen.focus(); }
});

// --- Dialoge (Menü auf dem Handy, Barrierefreiheit)
function dialog(id, oeffnen, schliessen) {
  const d = document.getElementById(id);
  if (!d) return;
  $$(oeffnen).forEach((b) => b.addEventListener('click', () => {
    $$('dialog[open]').forEach((x) => x !== d && x.close());
    d.showModal();
  }));
  $$(schliessen, d).forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $$('a', d).forEach((a) => a.addEventListener('click', () => d.close()));
}
dialog('menue', '[data-menue-oeffnen]', '[data-menue-schliessen]');
dialog('zugang', '[data-zugang-oeffnen]', '[data-zugang-schliessen]');

// --- Barrierefreiheit: Einstellungen merken
function lesen() { try { return JSON.parse(localStorage.getItem('gce-zugang') || '{}'); } catch { return {}; } }
function schreiben(e) { try { localStorage.setItem('gce-zugang', JSON.stringify(e)); } catch {} }
function setzen(schluessel, wert) {
  const e = lesen();
  if (wert) { html.setAttribute(`data-${schluessel}`, wert); e[schluessel] = wert; }
  else { html.removeAttribute(`data-${schluessel}`); delete e[schluessel]; }
  schreiben(e);
  anzeigen();
}
function anzeigen() {
  $$('[data-einstellung="schrift"]').forEach((b) => b.setAttribute('aria-pressed', String((html.getAttribute('data-schrift') || '1') === b.dataset.wert)));
  $$('[data-schalter]').forEach((b) => b.setAttribute('aria-pressed', String(html.getAttribute(`data-${b.dataset.schalter}`) === b.dataset.an)));
  const film = $('.held video');
  if (film) html.getAttribute('data-bewegung') === 'aus' ? film.pause() : film.play().catch(() => {});
}
$$('[data-einstellung="schrift"]').forEach((b) => b.addEventListener('click', () => setzen('schrift', b.dataset.wert === '1' ? '' : b.dataset.wert)));
$$('[data-schalter]').forEach((b) => b.addEventListener('click', () => {
  const an = html.getAttribute(`data-${b.dataset.schalter}`) === b.dataset.an;
  setzen(b.dataset.schalter, an ? '' : b.dataset.an);
}));
anzeigen();

// --- Startseite: Kopf erst zeigen, wenn der Film nicht mehr den Bildschirm füllt
const kopf = $('#kopf');
const held = $('.held');
if (kopf && kopf.dataset.startseite && held) {
  let imHeld = true;
  let letztesY = window.scrollY;
  const pruefen = () => {
    const unten = held.getBoundingClientRect().bottom;
    imHeld = unten > window.innerHeight * 0.35;
    const hoch = window.scrollY < letztesY;
    const zeigen = !imHeld || kopf.contains(document.activeElement);
    kopf.classList.toggle('kopf--versteckt', !zeigen);
    kopf.classList.toggle('kopf--schatten', zeigen);
    letztesY = window.scrollY;
    return hoch;
  };
  window.addEventListener('scroll', pruefen, { passive: true });
  kopf.addEventListener('focusin', () => kopf.classList.remove('kopf--versteckt'));
  kopf.addEventListener('focusout', () => setTimeout(pruefen, 0));
  pruefen();
}

// --- Ruhiges Einblenden beim Scrollen
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('ist-sichtbar'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.einblenden').forEach((el) => io.observe(el));
} else $$('.einblenden').forEach((el) => el.classList.add('ist-sichtbar'));

// --- Öffnungszeiten von heute
const tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const heute = tage[new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })).getDay()];
$$('[data-heute-zeiten]').forEach((el) => {
  try {
    const t = JSON.parse(el.dataset.heuteZeiten).find((x) => x.tag === heute);
    if (t) el.textContent = `${heute}: ${t.zeit}`;
  } catch {}
});
$$('tr[data-tag]').forEach((tr) => { if (tr.dataset.tag === heute) tr.classList.add('ist-heute'); });

// --- Wetter am Platz (Open-Meteo, ohne Schlüssel)
const wetterFelder = $$('[data-wetter]');
if (wetterFelder.length) {
  const codes = { 0: 'klar', 1: 'heiter', 2: 'leicht bewölkt', 3: 'bewölkt', 45: 'Nebel', 48: 'Nebel', 51: 'Niesel', 53: 'Niesel', 55: 'Niesel', 61: 'Regen', 63: 'Regen', 65: 'starker Regen', 71: 'Schnee', 73: 'Schnee', 75: 'Schnee', 80: 'Schauer', 81: 'Schauer', 82: 'starke Schauer', 95: 'Gewitter' };
  fetch('https://api.open-meteo.com/v1/forecast?latitude=52.2995&longitude=7.1336&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBerlin')
    .then((r) => r.json())
    .then((d) => {
      const c = d.current;
      const text = `: ${Math.round(c.temperature_2m)} °C, ${codes[c.weather_code] || 'aktuell'}`;
      wetterFelder.forEach((f) => { f.textContent = text; });
    })
    .catch(() => {});
}

// --- Formulare (Entwurf: zeigt nur die Bestätigung)
$$('[data-formular]').forEach((f) => {
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const kontakt = f.querySelector('[name="kontakt"]');
    const fehler = f.querySelector('.formular__fehler');
    if (!kontakt.value.trim()) {
      fehler.textContent = 'Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an, damit der Club antworten kann.';
      kontakt.setAttribute('aria-invalid', 'true');
      kontakt.focus();
      return;
    }
    kontakt.removeAttribute('aria-invalid');
    fehler.textContent = '';
    const ok = f.parentElement.querySelector('[data-bestaetigung]');
    f.hidden = true;
    ok.hidden = false;
    ok.focus();
  });
});

// --- Galerie: Großansicht
const kasten = $('#leuchtkasten');
if (kasten) {
  $$('[data-gross]').forEach((b) => b.addEventListener('click', () => {
    $('img', kasten).src = b.dataset.gross;
    $('img', kasten).alt = b.dataset.alt || '';
    $('p', kasten).textContent = b.dataset.text || '';
    kasten.showModal();
  }));
  $('.schliessen', kasten).addEventListener('click', () => kasten.close());
  kasten.addEventListener('click', (e) => { if (e.target === kasten) kasten.close(); });
}
