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
    // Das Menü klappt direkt unter der Kopfleiste auf (oder oben, wenn die Kopfleiste verborgen ist)
    const k = document.getElementById('kopf');
    const unten = k && !k.classList.contains('kopf--versteckt') ? k.getBoundingClientRect().bottom : 0;
    d.style.setProperty('--menue-oben', `${Math.max(8, unten + 6)}px`);
    d.showModal();
  }));
  $$(schliessen, d).forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $$('a', d).forEach((a) => a.addEventListener('click', () => d.close()));
}
dialog('menue', '[data-menue-oeffnen]', '[data-menue-schliessen]');

// --- Imagefilm auf der Startseite: läuft stumm im Hintergrund.
// Anhalten, Ton an und „Film mit Ton ansehen“ (Vollbild von vorn, mit Bedienleiste).
const film = $('[data-film]');
let filmVonHand = false; // jemand hat den Film selbst angehalten
function filmKnoepfe() {
  if (!film) return;
  const steht = film.paused;
  const pk = $('[data-film-pause]');
  if (pk) {
    pk.dataset.zustand = steht ? 'steht' : 'laeuft';
    $('[data-film-pause-text]').textContent = steht ? 'Abspielen' : 'Anhalten';
  }
  const tk = $('[data-film-ton]');
  if (tk) {
    tk.dataset.zustand = film.muted ? 'stumm' : 'ton';
    $('[data-film-ton-text]').textContent = film.muted ? 'Ton an' : 'Ton aus';
  }
}
function filmPruefen() {
  if (!film) return;
  const ruhe = html.getAttribute('data-bewegung') === 'aus';
  const sparen = navigator.connection && navigator.connection.saveData;
  if (ruhe || filmVonHand || sparen) film.pause();
  else film.play().catch(() => {});
  filmKnoepfe();
}
if (film) {
  ['play', 'pause', 'volumechange'].forEach((e) => film.addEventListener(e, filmKnoepfe));
  $('[data-film-pause]')?.addEventListener('click', () => {
    if (film.paused) {
      filmVonHand = false;
      if (html.getAttribute('data-bewegung') === 'aus') setzen('bewegung', '');
      film.play().catch(() => {});
    } else { filmVonHand = true; film.pause(); }
  });
  $('[data-film-ton]')?.addEventListener('click', () => {
    film.muted = !film.muted;
    if (!film.muted && film.paused) { filmVonHand = false; film.play().catch(() => {}); }
  });
  const vollbildEnde = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    film.controls = false; film.muted = true; film.setAttribute('aria-hidden', 'true');
    filmPruefen();
  };
  document.addEventListener('fullscreenchange', vollbildEnde);
  document.addEventListener('webkitfullscreenchange', vollbildEnde);
  film.addEventListener('webkitendfullscreen', () => setTimeout(vollbildEnde, 0));
  $('[data-film-vollbild]')?.addEventListener('click', () => {
    film.removeAttribute('aria-hidden');
    film.controls = true; film.muted = false;
    filmVonHand = false;
    film.play().catch(() => {});
    if (film.requestFullscreen) film.requestFullscreen().catch(() => {});
    else if (film.webkitEnterFullscreen) film.webkitEnterFullscreen();
  });
}

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
  $$('[data-schalter]').forEach((b) => b.setAttribute('aria-pressed', String(html.getAttribute(`data-${b.dataset.schalter}`) === b.dataset.an)));
  filmPruefen();
}
$$('[data-schalter]').forEach((b) => b.addEventListener('click', () => {
  const an = html.getAttribute(`data-${b.dataset.schalter}`) === b.dataset.an;
  setzen(b.dataset.schalter, an ? '' : b.dataset.an);
}));
anzeigen();

// --- Startseite: Die Kopfleiste liegt über dem Film wie ein Teil der Seite.
// Beim Laden ist so weit gescrollt, dass der Film den Bildschirm füllt; wer hochscrollt,
// sieht die Leiste, wer wieder runterscrollt, ist zurück im Vollbild.
// Ab etwa der Hälfte des Films bleibt die Leiste oben angeheftet.
const kopf = $('#kopf');
const held = $('.held');
let kopfZeigen = () => {};
if (kopf && kopf.dataset.startseite && held) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let h = kopf.offsetHeight;
  const platz = () => { h = kopf.offsetHeight; held.style.marginTop = `${h}px`; };
  const pruefen = () => {
    const y = window.scrollY;
    const halbWeg = held.getBoundingClientRect().bottom < window.innerHeight * 0.5;
    const feld = $('#bedienhilfen');
    const offen = kopf.contains(document.activeElement) || (feld && !feld.hidden);
    if (halbWeg || offen) {
      // angeheftet
      kopf.classList.remove('kopf--folgt', 'kopf--versteckt');
      kopf.classList.add('kopf--schatten');
      kopf.style.transform = '';
    } else if (y < h) {
      // läuft mit der Seite mit, als stünde sie über dem Film
      kopf.classList.add('kopf--folgt');
      kopf.classList.remove('kopf--versteckt', 'kopf--schatten');
      kopf.style.transform = `translateY(${-y}px)`;
    } else {
      // im Film: weg
      kopf.style.transform = '';
      kopf.classList.remove('kopf--schatten');
      kopf.classList.add('kopf--versteckt');
      requestAnimationFrame(() => kopf.classList.remove('kopf--folgt'));
    }
  };
  platz();
  window.scrollTo({ top: h, behavior: 'instant' });
  pruefen();
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const imFilm = window.scrollY >= h - 1 && held.getBoundingClientRect().top <= 1;
      const alt = h; platz();
      if (imFilm && h !== alt) window.scrollTo({ top: window.scrollY + (h - alt), behavior: 'instant' });
      pruefen();
    }).observe(kopf);
  }
  window.addEventListener('scroll', pruefen, { passive: true });
  window.addEventListener('resize', pruefen, { passive: true });
  kopf.addEventListener('focusin', pruefen);
  kopf.addEventListener('focusout', () => setTimeout(pruefen, 0));
  kopfZeigen = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

// --- Bedienhilfen: klappen unter dem Knopf auf, kein eigenes Fenster
const bhKnopf = $('[data-bedienhilfen]');
const bhFeld = $('#bedienhilfen');
if (bhKnopf && bhFeld) {
  const auf = (offen) => { bhFeld.hidden = !offen; bhKnopf.setAttribute('aria-expanded', String(offen)); };
  bhKnopf.addEventListener('click', () => auf(bhFeld.hidden));
  $('[data-bedienhilfen-zu]', bhFeld).addEventListener('click', () => { auf(false); bhKnopf.focus(); });
  document.addEventListener('click', (e) => {
    if (!bhFeld.hidden && !e.target.closest('.werkzeug--zugang') && !e.target.closest('[data-bedienhilfen-held]')) auf(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bhFeld.hidden) { auf(false); bhKnopf.focus(); } });
  $$('[data-bedienhilfen-held]').forEach((b) => b.addEventListener('click', () => {
    kopfZeigen(); auf(true); setTimeout(() => $('.schalter', bhFeld).focus(), 360);
  }));
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
// Wird bei jedem Seitenaufruf neu geladen; Open-Meteo aktualisiert die Werte etwa alle 15 Minuten.
const wetterKnopf = $('[data-wetter-knopf]');
if (wetterKnopf) {
  const codes = { 0: ['klar', 'sonne'], 1: ['heiter', 'sonne'], 2: ['leicht bewölkt', 'wolkesonne'], 3: ['bewölkt', 'wolke'], 45: ['Nebel', 'nebel'], 48: ['Nebel', 'nebel'], 51: ['Nieselregen', 'regen'], 53: ['Nieselregen', 'regen'], 55: ['Nieselregen', 'regen'], 61: ['Regen', 'regen'], 63: ['Regen', 'regen'], 65: ['starker Regen', 'regen'], 71: ['Schnee', 'schnee'], 73: ['Schnee', 'schnee'], 75: ['Schnee', 'schnee'], 80: ['Regenschauer', 'regen'], 81: ['Regenschauer', 'regen'], 82: ['starke Schauer', 'regen'], 95: ['Gewitter', 'gewitter'] };
  fetch('https://api.open-meteo.com/v1/forecast?latitude=52.2995&longitude=7.1336&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBerlin')
    .then((r) => r.json())
    .then((d) => {
      const c = d.current;
      const [text, symbol] = codes[c.weather_code] || ['aktuell', 'wolkesonne'];
      const grad = Math.round(c.temperature_2m);
      const vorlage = $(`[data-wetter-vorlage="${symbol}"]`);
      if (vorlage) $('[data-wetter-symbol]').innerHTML = vorlage.innerHTML;
      $('[data-wetter-kurz]').textContent = `${grad}°`;
      $('[data-wetter-lang]').textContent = `Wetter am Platz: ${grad} °C, ${text}, Wind ${Math.round(c.wind_speed_10m)} km/h. Antippen für die Vorhersage für Bad Bentheim.`;
      wetterKnopf.setAttribute('aria-label', `Wetter am Platz: ${grad} Grad, ${text}. Vorhersage öffnen`);
    })
    .catch(() => {});
}
// Hinweisfelder mit Esc ausblenden
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const w = document.activeElement && document.activeElement.closest('.werkzeug'); if (w) w.classList.add('tipp-aus'); }
});
$$('.werkzeug').forEach((w) => w.addEventListener('mouseleave', () => w.classList.remove('tipp-aus')));
$$('.werkzeug').forEach((w) => w.addEventListener('focusout', () => w.classList.remove('tipp-aus')));

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

// --- Bildbetrachter: ganzer Bildschirm, zoomen mit Mausrad, zwei Fingern, Doppelklick oder + und −
const grossKnoepfe = $$('[data-gross]');
if (grossKnoepfe.length) {
  const d = document.createElement('dialog');
  d.className = 'betrachter';
  d.setAttribute('aria-label', 'Bild in Großansicht');
  d.innerHTML = `<div class="betrachter__flaeche"><img alt="" draggable="false"></div>
    <p class="betrachter__titel"></p>
    <button type="button" class="schliessen">✕ Schließen</button>
    <p class="betrachter__hinweis">Zum Vergrößern: Finger auseinanderziehen, Mausrad oder +</p>
    <div class="betrachter__leiste" role="group" aria-label="Zoom">
      <button type="button" data-zoom="-1" aria-label="Verkleinern">−</button>
      <button type="button" class="betrachter__einpassen" data-zoom="0">Ganzes Bild</button>
      <button type="button" data-zoom="1" aria-label="Vergrößern">+</button>
    </div>`;
  document.body.appendChild(d);
  const flaeche = $('.betrachter__flaeche', d), bild = $('img', d), hinweis = $('.betrachter__hinweis', d);
  let s = 1, x = 0, y = 0, minS = 1;
  const anwenden = () => { bild.style.transform = `translate(${x}px, ${y}px) scale(${s})`; };
  const begrenzen = () => {
    const w = bild.naturalWidth * s, h = bild.naturalHeight * s, W = flaeche.clientWidth, H = flaeche.clientHeight;
    x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, x));
    y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, y));
  };
  const einpassen = () => {
    minS = Math.min(flaeche.clientWidth / bild.naturalWidth, flaeche.clientHeight / bild.naturalHeight);
    s = minS; begrenzen(); anwenden();
  };
  const zoom = (faktor, px = flaeche.clientWidth / 2, py = flaeche.clientHeight / 2) => {
    const neu = Math.min(Math.max(s * faktor, minS), 6);
    x = px - ((px - x) * neu) / s; y = py - ((py - y) * neu) / s; s = neu;
    begrenzen(); anwenden(); hinweis.hidden = true;
  };
  grossKnoepfe.forEach((b) => b.addEventListener('click', () => {
    bild.onload = einpassen;
    bild.src = b.dataset.gross; bild.alt = b.dataset.alt || '';
    $('.betrachter__titel', d).textContent = b.dataset.text || '';
    hinweis.hidden = false;
    d.showModal();
    if (bild.complete && bild.naturalWidth) einpassen();
  }));
  $('.schliessen', d).addEventListener('click', () => d.close());
  $$('[data-zoom]', d).forEach((b) => b.addEventListener('click', () => {
    const z = Number(b.dataset.zoom); z === 0 ? einpassen() : zoom(z > 0 ? 1.5 : 1 / 1.5);
  }));
  flaeche.addEventListener('wheel', (e) => { e.preventDefault(); const r = flaeche.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  flaeche.addEventListener('dblclick', (e) => { const r = flaeche.getBoundingClientRect(); s > minS * 1.5 ? einpassen() : zoom(2.5, e.clientX - r.left, e.clientY - r.top); });
  const zeiger = new Map(); let abstand = 0;
  flaeche.addEventListener('pointerdown', (e) => { flaeche.setPointerCapture(e.pointerId); zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY }); flaeche.classList.add('zieht'); });
  flaeche.addEventListener('pointermove', (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const alt = zeiger.get(e.pointerId); zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zeiger.size === 1) { x += e.clientX - alt.x; y += e.clientY - alt.y; begrenzen(); anwenden(); }
    else if (zeiger.size === 2) {
      const [a, b] = [...zeiger.values()]; const neu = Math.hypot(a.x - b.x, a.y - b.y);
      const r = flaeche.getBoundingClientRect();
      if (abstand) zoom(neu / abstand, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      abstand = neu;
    }
  });
  const loslassen = (e) => { zeiger.delete(e.pointerId); if (zeiger.size < 2) abstand = 0; if (!zeiger.size) flaeche.classList.remove('zieht'); };
  flaeche.addEventListener('pointerup', loslassen); flaeche.addEventListener('pointercancel', loslassen);
  d.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') zoom(1.5);
    if (e.key === '-') zoom(1 / 1.5);
    if (e.key === '0') einpassen();
    const schritt = 80;
    if (e.key === 'ArrowLeft') { x += schritt; begrenzen(); anwenden(); }
    if (e.key === 'ArrowRight') { x -= schritt; begrenzen(); anwenden(); }
    if (e.key === 'ArrowUp') { y += schritt; begrenzen(); anwenden(); }
    if (e.key === 'ArrowDown') { y -= schritt; begrenzen(); anwenden(); }
  });
  window.addEventListener('resize', () => { if (d.open) einpassen(); });
}
