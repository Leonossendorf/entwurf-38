// Holt beim Bauen die Termine aus PC CADDIE und legt einen Schnappschuss ab.
// Fällt PC CADDIE aus, bleibt der letzte Schnappschuss stehen; die Seite lädt im Browser ohnehin neu.
import { writeFile, readFile } from 'node:fs/promises';
import { FEEDS, parseICS } from '../src/lib/termine.js';

const ziel = new URL('../src/data/termine-pccaddie.json', import.meta.url);
const termine = [];
let fehler = 0;
for (const f of FEEDS) {
  try {
    const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; site-build)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    termine.push(...parseICS(await r.text(), f.quelle, f.link));
  } catch (e) {
    fehler++;
    console.warn(`PC CADDIE (${f.quelle}) nicht erreichbar: ${e.message}`);
  }
}
if (fehler === FEEDS.length) {
  try {
    await readFile(ziel);
    console.warn('Behalte den letzten Termin-Schnappschuss.');
  } catch {
    await writeFile(ziel, JSON.stringify({ stand: null, termine: [] }, null, 1));
  }
} else {
  await writeFile(ziel, JSON.stringify({ stand: new Date().toISOString(), termine }, null, 1));
  console.log(`Termine aus PC CADDIE: ${termine.length}`);
}

// Stand der Veröffentlichung (zum Prüfen, ob die neue Fassung online ist)
await writeFile(new URL('../public/stand.txt', import.meta.url), `${new Date().toISOString()}\n`);
