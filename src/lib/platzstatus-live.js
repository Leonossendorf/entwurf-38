// Holt den aktuellen Platzstatus vom Platzwart-Portal (Cloudflare-Worker) und aktualisiert alle Anzeigen.
// Beim Bauen steht der Stand aus src/data/platzstatus.json in der Seite; das hier überschreibt ihn sofort.
export const STATUS_URL = 'https://golfclub-euregio-platz.leon-ossendorf.workers.dev/status';

export function platzstatusLive() {
  fetch(STATUS_URL, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((s) => {
      const alle = (sel) => document.querySelectorAll(sel);
      alle('[data-ps-marke]').forEach((e) => {
        const ok = !!s[e.dataset.psMarke];
        e.classList.toggle('werkzeug__marke--ja', ok);
        e.classList.toggle('werkzeug__marke--nein', !ok);
        e.textContent = ok ? '✓' : '✕';
      });
      alle('[data-ps-b]').forEach((e) => {
        const ok = !!s[e.dataset.psB];
        e.classList.toggle('ja', ok);
        e.classList.toggle('nein', !ok);
        e.textContent = ok ? '✓' : '✕';
      });
      alle('[data-ps-text]').forEach((e) => { e.textContent = s[e.dataset.psText] ? e.dataset.ja : e.dataset.nein; });
      alle('[data-ps-label]').forEach((e) => e.setAttribute('aria-label', e.dataset.vorlage.replace('{}', s[e.dataset.psLabel] ? 'erlaubt' : 'nicht erlaubt')));
      alle('[data-ps-stand]').forEach((e) => { e.textContent = e.dataset.psStand.replace('{}', s.stand); });
      alle('[data-ps-kachel]').forEach((e) => {
        const ok = !!s[e.dataset.psKachel];
        e.classList.toggle('kachel--ja', ok);
        e.classList.toggle('kachel--nein', !ok);
      });
    })
    .catch(() => {});
}
