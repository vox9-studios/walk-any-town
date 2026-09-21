// Turns towns.txt into data/<slug>.json files the site can load from its own address.
// Runs inside GitHub Actions (Node 20+). Towns already in data/ are skipped; set FORCE=1 to refetch all.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const UA = `walk-any-town (https://github.com/${process.env.GITHUB_REPOSITORY || 'unknown/unknown'})`;
const HALF_M = 200;   // half the side of the square, in metres (the site's map is 400 m across)
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const FILTERS = ['way[building]', 'relation[building]', 'way[highway]', 'way[natural=water]', 'relation[natural=water]',
  'way[natural=wood]', 'way[waterway]', 'way[landuse=forest]', 'way[amenity=parking]', 'node[natural=tree]',
  'node[shop][name]', 'node[amenity][name]'];
const KEEP = ['building', 'building:levels', 'building:material', 'building:facade:material', 'building:colour',
  'height', 'roof:shape', 'roof:levels', 'roof:height', 'roof:material', 'roof:colour',
  'highway', 'name', 'area', 'tunnel', 'natural', 'waterway', 'landuse', 'amenity', 'shop', 'tourism', 'historic'];

const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);
const round = g => ({ lat: +g.lat.toFixed(6), lon: +g.lon.toFixed(6) });

async function geocode(q) {
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q),
    { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('place search answered ' + r.status);
  const hit = (await r.json())[0];
  if (!hit) throw new Error('no such place found');
  return { lat: +hit.lat, lon: +hit.lon };
}

async function overpass(lat, lon) {
  const dLat = HALF_M / 110540, dLon = HALF_M / (111320 * Math.cos(lat * Math.PI / 180));
  const bb = `(${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon})`;
  const ql = '[out:json][timeout:60];(' + FILTERS.map(f => f + bb + ';').join('') + ');out geom;';
  let last = 'no server tried';
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
      });
      if (r.ok) return (await r.json()).elements || [];
      last = url + ' answered ' + r.status;
    } catch (e) { last = url + ': ' + e.message; }
    await sleep(2000);
  }
  throw new Error(last);
}

function slim(e) {   // keep only what the renderer reads, so the files stay small
  const tags = {};
  for (const k of KEEP) if (e.tags && e.tags[k] !== undefined) tags[k] = e.tags[k];
  const out = { type: e.type, id: e.id, tags };
  if (e.type === 'node') Object.assign(out, round(e));
  if (e.geometry) out.geometry = e.geometry.map(round);
  if (e.members) out.members = e.members.filter(m => m.geometry).map(m => ({ role: m.role, geometry: m.geometry.map(round) }));
  return out;
}

const lines = (await readFile('towns.txt', 'utf8')).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
await mkdir('data', { recursive: true });
const index = [];
for (const name of lines) {
  const s = slug(name), file = `data/${s}.json`;
  try {
    if (!process.env.FORCE && await exists(file)) {
      const old = JSON.parse(await readFile(file, 'utf8'));
      index.push({ slug: s, name, lat: old.lat, lon: old.lon });
      console.log('kept    ', name);
      continue;
    }
    const { lat, lon } = await geocode(name);
    await sleep(1200);   // the place search allows one request a second
    const elements = (await overpass(lat, lon)).map(slim);
    if (!elements.some(e => e.tags.building || e.tags.highway)) throw new Error('nothing is mapped there yet');
    await writeFile(file, JSON.stringify({ name, lat, lon, elements }));
    index.push({ slug: s, name, lat, lon });
    console.log('fetched ', name, '-', elements.length, 'map features');
  } catch (e) {
    console.log(`::warning::Skipped "${name}": ${e.message}`);
  }
}
await writeFile('data/index.json', JSON.stringify(index, null, 1));
console.log(index.length + ' of ' + lines.length + ' towns ready');
