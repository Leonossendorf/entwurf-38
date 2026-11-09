// Die acht Zustände, die der Platzwart heute auf /platzwart/ auswählen kann (greenState 01–08).
// Quelle: Bilder platz-icons-01.png bis -08.png der bisherigen Seite.
export const ZUSTAENDE = {
  '01': { platz: true, cart: true, trolley: true, bag: true, range: true },
  '02': { platz: true, cart: false, trolley: true, bag: true, range: true },
  '03': { platz: true, cart: false, trolley: false, bag: true, range: true },
  '04': { platz: false, cart: false, trolley: false, bag: false, range: true },
  '05': { platz: true, cart: true, trolley: true, bag: true, range: false },
  '06': { platz: true, cart: false, trolley: true, bag: true, range: false },
  '07': { platz: true, cart: false, trolley: false, bag: true, range: false },
  '08': { platz: false, cart: false, trolley: false, bag: false, range: false },
};

export const KACHELN = [
  { id: 'platz', name: 'Golfplatz', symbol: 'flagge', ja: 'geöffnet', nein: 'gesperrt' },
  { id: 'range', name: 'Driving Range', symbol: 'range', ja: 'geöffnet', nein: 'gesperrt' },
  { id: 'cart', name: 'Golf Cart', symbol: 'cart', ja: 'erlaubt', nein: 'nicht erlaubt' },
  { id: 'trolley', name: 'Trolley', symbol: 'trolley', ja: 'erlaubt', nein: 'nicht erlaubt' },
  { id: 'bag', name: 'Golf Bag', symbol: 'bag', ja: 'erlaubt', nein: 'nicht erlaubt' },
];

export function kurztext(code) {
  const z = ZUSTAENDE[code] || ZUSTAENDE['01'];
  if (!z.platz) return 'Golfplatz gesperrt';
  const nein = KACHELN.filter((k) => k.id !== 'platz' && !z[k.id]).map((k) => k.name);
  return nein.length ? `Platz offen · ${nein.join(', ')} nicht erlaubt` : 'Platz offen · alles erlaubt';
}
