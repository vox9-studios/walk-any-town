// Turns towns.txt into data/<slug>.json files the site can load from its own address.
// Runs inside GitHub Actions (Node 20+). Towns already in data/ are skipped; set FORCE=1 to refetch all.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const UA = `walk-any-town (https://github.com/${process.env.GITHUB_REPOSITORY || 'unknown/unknown'})`;
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ELEVATION = 'https://api.opentopodata.org/v1';
const DEM = ['eudem25m', 'mapzen', 'srtm30m'];   // the first that covers the whole square wins
const ELE_N = 33;                                // ground is sampled on a 33 by 33 grid
const DEFAULT_HALF = 200;                        // half the side of the square, in metres
const MAX_HALF = 400;                            // the page draws half a metre to a cell, so this is 1600 cells across

const FILTERS = ['way[building]', 'relation[building]', 'way["building:part"]', 'relation["building:part"]',
  'way[man_made=tower]', 'way[highway]', 'way[natural=water]', 'relation[natural=water]',
  'way[natural=wood]', 'way[waterway]', 'way[landuse=forest]', 'way[amenity=parking]', 'node[natural=tree]',
  'node[shop][name]', 'node[amenity][name]'];
const KEEP = ['building', 'building:levels', 'building:material', 'building:facade:material', 'building:colour',
  'building:part', 'height', 'min_height', 'building:min_level', 'roof:shape', 'roof:levels', 'roof:height',
  'roof:material', 'roof:colour',
  'highway', 'name', 'area', 'tunnel', 'bridge', 'layer', 'lanes', 'width', 'oneway', 'surface', 'sidewalk',
  'natural', 'waterway', 'landuse', 'amenity', 'shop', 'tourism', 'historic', 'man_made', 'tower:type'];

const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);
const round = g => ({ lat: +g.lat.toFixed(6), lon: +g.lon.toFixed(6) });

// A line is "Place", and may carry " | half-metres" to widen the square, " | lat,lon" to recentre it,
// " | @lat,lon" to say where a walk begins, " | metres-a-cell" as mNN, and " | >lat,lon" for each
// turning point of a flight over it.
function readLine(line) {
  const parts = line.split('|').map(s => s.trim());
  const town = { name: parts[0], half: DEFAULT_HALF, centre: null, start: null, cell: 0, route: [] };
  const coords = /^[@>]?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
  for (const p of parts.slice(1)) {
    const c = p.match(coords);
    if (c) {
      const at = { lat: +c[1], lon: +c[2] };
      if (p.startsWith('@')) town.start = at;
      else if (p.startsWith('>')) town.route.push(at);
      else town.centre = at;
    } else if (/^m\d+(?:\.\d+)?$/.test(p)) town.cell = Math.min(12, Math.max(0.5, +p.slice(1)));
    else if (/^\d+$/.test(p)) town.half = Math.min(MAX_HALF, Math.max(100, +p));
  }
  return town;
}

async function geocode(q) {
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q),
    { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('place search answered ' + r.status);
  const hit = (await r.json())[0];
  if (!hit) throw new Error('no such place found');
  return { lat: +hit.lat, lon: +hit.lon };
}

async function overpass(lat, lon, half) {
  const dLat = half / 110540, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  const bb = `(${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon})`;
  const ql = '[out:json][timeout:90];(' + FILTERS.map(f => f + bb + ';').join('') + ');out geom;';
  let last = 'no server tried';
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
      });
      const body = await r.text();
      if (r.ok && body.trimStart().startsWith('{')) return JSON.parse(body).elements || [];
      last = url + (r.ok ? ' was busy' : ' answered ' + r.status);
    } catch (e) { last = url + ': ' + e.message; }
    await sleep(2000);
  }
  throw new Error(last);
}

// The lie of the land, on a square grid running west to east along each row, south to north down the rows.
async function terrain(lat, lon, half) {
  const dLat = half / 110540, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  const pts = [];
  for (let j = 0; j < ELE_N; j++) for (let i = 0; i < ELE_N; i++) {
    const fx = (i / (ELE_N - 1)) * 2 - 1, fy = (j / (ELE_N - 1)) * 2 - 1;
    pts.push((lat + fy * dLat).toFixed(6) + ',' + (lon + fx * dLon).toFixed(6));
  }
  for (const set of DEM) {
    try {
      const out = [];
      for (let k = 0; k < pts.length; k += 100) {
        const r = await fetch(`${ELEVATION}/${set}?locations=` + pts.slice(k, k + 100).join('|'), { headers: { 'User-Agent': UA } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.results) throw new Error(j.error || 'answered ' + r.status);
        for (const res of j.results) {
          if (typeof res.elevation !== 'number') throw new Error('no cover here');
          out.push(res.elevation);
        }
        await sleep(1100);   // the free service asks for no more than one request a second
      }
      const min = Math.min(...out), max = Math.max(...out);
      console.log(`         ground from ${set}: ${min.toFixed(0)} m to ${max.toFixed(0)} m, a fall of ${(max - min).toFixed(0)} m`);
      return { n: ELE_N, base: +min.toFixed(1), dataset: set, v: out.map(e => Math.round((e - min) * 10)) };
    } catch (e) {
      console.log(`::notice::${set} could not give ground heights here (${e.message})`);
    }
  }
  console.log('::warning::No ground heights available, so this town will be flat.');
  return null;
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

// ---- flights: a corridor along a route, kilometres long, drawn several metres to the cell ----
const FLIGHT_FILTERS = ['way[building]', 'relation[building]', 'way["building:part"]', 'way[man_made=tower]',
  'way[natural=water]', 'relation[natural=water]', 'way[waterway]', 'way[landuse=forest]', 'way[natural=wood]',
  'way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"]'];

async function corridor(poly) {
  const ql = '[out:json][timeout:120];(' + FLIGHT_FILTERS.map(f => f + '(poly:"' + poly + '");').join('') + ');out geom;';
  let last = 'no server tried';
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
      });
      const body = await r.text();
      if (r.ok && body.trimStart().startsWith('{')) return JSON.parse(body).elements || [];
      last = url + (r.ok ? ' was busy' : ' answered ' + r.status);
    } catch (e) { last = url + ': ' + e.message; }
    await sleep(2500);
  }
  throw new Error(last);
}

// At several metres to the cell a node every half metre is wasted weight, so drop the ones that
// cannot move a cell, and round what is left to about a metre.
function thin(geom, step) {
  if (!geom || geom.length < 3) return geom;
  const out = [geom[0]];
  let last = geom[0];
  for (let i = 1; i < geom.length - 1; i++) {
    const dy = (geom[i].lat - last.lat) * 110540;
    const dx = (geom[i].lon - last.lon) * 111320 * Math.cos(geom[i].lat * Math.PI / 180);
    if (dx * dx + dy * dy >= step * step) { out.push(geom[i]); last = geom[i]; }
  }
  out.push(geom[geom.length - 1]);
  return out;
}
const coarse = g => ({ lat: +g.lat.toFixed(5), lon: +g.lon.toFixed(5) });

async function buildFlight(f) {
  const lat0 = f.route.reduce((s, p) => s + p.lat, 0) / f.route.length;
  const lon0 = f.route.reduce((s, p) => s + p.lon, 0) / f.route.length;
  const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
  const xy = p => [(p.lon - lon0) * kx, (p.lat - lat0) * ky];
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of f.route) { const [x, y] = xy(p); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const half = Math.ceil((Math.max(maxx - minx, maxy - miny) / 2 + f.wide) / 100) * 100;
  const lat = lat0 + (miny + maxy) / 2 / ky, lon = lon0 + (minx + maxx) / 2 / kx;

  const seen = new Map();
  for (let i = 0; i + 1 < f.route.length; i++) {     // one query a leg, each a little wider than the leg
    const a = f.route[i], b = f.route[i + 1];
    const dx = (b.lon - a.lon) * kx, dy = (b.lat - a.lat) * ky, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * f.wide, ny = dx / L * f.wide, ex = dx / L * f.wide * .4, ey = dy / L * f.wide * .4;
    const at = (p, ox, oy) => (p.lat + oy / ky).toFixed(6) + ' ' + (p.lon + ox / kx).toFixed(6);
    const poly = [at(a, nx - ex, ny - ey), at(b, nx + ex, ny + ey), at(b, -nx + ex, -ny + ey), at(a, -nx - ex, -ny - ey)].join(' ');
    const got = await corridor(poly);
    for (const e of got) if (!seen.has(e.type + e.id)) seen.set(e.type + e.id, e);
    console.log(`         leg ${i + 1} of ${f.route.length - 1}: ${got.length} features, ${seen.size} so far`);
    await sleep(2500);
  }
  const elements = [...seen.values()].map(e => {
    const o = slim(e);
    if (o.geometry) o.geometry = thin(o.geometry, f.cell / 2).map(coarse);
    if (o.members) o.members = o.members.map(m => ({ role: m.role, geometry: thin(m.geometry, f.cell / 2).map(coarse) }));
    if (o.lat !== undefined) Object.assign(o, coarse(o));
    return o;
  });
  const ele = await terrain(lat, lon, half);
  return { name: f.title, lat, lon, half, cell: f.cell, route: f.route, ele, elements };
}

const lines = (await readFile('towns.txt', 'utf8')).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
await mkdir('data', { recursive: true });
const index = [];
for (const line of lines) {
  const want = readLine(line);
  const name = want.name, s = slug(name), file = `data/${s}.json`;
  try {
    if (!process.env.FORCE && await exists(file)) {
      const old = JSON.parse(await readFile(file, 'utf8'));
      const sameSize = (old.half || DEFAULT_HALF) === want.half;
      const sameSpot = !want.centre || (Math.abs(old.lat - want.centre.lat) < 1e-5 && Math.abs(old.lon - want.centre.lon) < 1e-5);
      if (sameSize && sameSpot) {
        index.push({ slug: s, name, lat: old.lat, lon: old.lon, half: old.half || DEFAULT_HALF,
          start: want.start, cell: want.cell, route: want.route.length ? want.route : null });
        console.log('kept    ', name);
        continue;
      }
      console.log('changed ', name, '- refetching');
    }
    let lat, lon;
    if (want.centre) ({ lat, lon } = want.centre);
    else {
      ({ lat, lon } = await geocode(name));
      await sleep(1200);   // the place search allows one request a second
    }
    const elements = (await overpass(lat, lon, want.half)).map(slim);
    if (!elements.some(e => e.tags.building || e.tags.highway)) throw new Error('nothing is mapped there yet');
    const ele = await terrain(lat, lon, want.half);
    await writeFile(file, JSON.stringify({ name, lat, lon, half: want.half, ele, elements }));
    index.push({ slug: s, name, lat, lon, half: want.half, start: want.start,
      cell: want.cell, route: want.route.length ? want.route : null });
    console.log('fetched ', name, '-', elements.length, 'map features across', want.half * 2, 'metres');
  } catch (e) {
    console.log(`::warning::Skipped "${name}": ${e.message}`);
  }
}
// ---- and the flights ----
let flightLines = [];
try { flightLines = (await readFile('scripts/flights.txt', 'utf8')).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')); } catch (e) {}
const flights = [];
for (const l of flightLines) {
  if (l.startsWith('>')) {
    const c = l.slice(1).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (c && flights.length) flights[flights.length - 1].route.push({ lat: +c[1], lon: +c[2] });
  } else {
    const p = l.split('|').map(x => x.trim());
    flights.push({ slug: slug(p[0]), title: p[1] || p[0], cell: +p[2] || 8, wide: +p[3] || 500, route: [] });
  }
}
for (const f of flights) {
  const file = `data/${f.slug}.json`;
  try {
    if (f.route.length < 2) throw new Error('needs at least two turning points');
    if (!process.env.FORCE && await exists(file)) {
      const old = JSON.parse(await readFile(file, 'utf8'));
      index.push({ slug: f.slug, name: f.title, lat: old.lat, lon: old.lon, half: old.half,
        cell: old.cell, start: null, route: f.route });
      console.log('kept    ', f.title);
      continue;
    }
    console.log('flying  ', f.title, '- fetching the corridor leg by leg');
    const out = await buildFlight(f);
    await writeFile(file, JSON.stringify(out));
    index.push({ slug: f.slug, name: f.title, lat: out.lat, lon: out.lon, half: out.half,
      cell: out.cell, start: null, route: f.route });
    console.log('fetched ', f.title, '-', out.elements.length, 'features,', Math.round(JSON.stringify(out).length / 1024), 'KB');
  } catch (e) {
    console.log(`::warning::Skipped flight "${f.title}": ${e.message}`);
  }
}

await writeFile('data/index.json', JSON.stringify(index, null, 1));
console.log(index.length + ' of ' + (lines.length + flights.length) + ' places ready');
