/**
 * Refresh the bundled snapshot of restaurants, bars and pubs (OpenStreetMap).
 *
 * The app searches this file in memory instead of calling Overpass on every
 * request: public Overpass servers are often slow or down, but a snapshot only
 * has to be fetched successfully once. Run it now and then:
 *
 *   npm run places:update
 *
 * It tries each server in turn (OVERPASS_URL can list others, comma separated)
 * and leaves the existing snapshot untouched if none of them answers.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../lib/places-tuscany.json", import.meta.url);
// Same box as TUSCANY_BOUNDS in lib/geo.ts: every search seed falls inside it.
const BBOX = { south: 42.2, west: 9.6, north: 44.5, east: 12.4 };
const KINDS = ["restaurant", "bar", "pub"];
const URLS = (
  process.env.OVERPASS_URL ??
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter"
).split(",");
const ATTEMPTS_PER_SERVER = 2;

const query = `[out:json][timeout:240];
nwr["amenity"~"^(${KINDS.join("|")})$"]["name"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
out center tags;`;

async function fetchElements() {
  for (let attempt = 1; attempt <= ATTEMPTS_PER_SERVER; attempt++) {
    for (const url of URLS) {
      const started = Date.now();
      try {
        process.stdout.write(`Asking ${url} (attempt ${attempt})… `);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "CenaInToscana/1.0 places snapshot" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark) throw new Error(json.remark); // Overpass reports timeouts here with a 200
        console.log(`${json.elements.length} elements in ${((Date.now() - started) / 1000).toFixed(0)} s`);
        return { elements: json.elements, osmBase: json.osm3s?.timestamp_osm_base };
      } catch (e) {
        console.log(`failed: ${e.message}`);
      }
    }
  }
  throw new Error("No Overpass server answered. The existing snapshot was left as it is.");
}

const clean = (s) => s?.replace(/;/g, ", ").replace(/_/g, " ").trim() || undefined;

const { elements, osmBase } = await fetchElements();
const rows = [];
for (const e of elements) {
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  const t = e.tags ?? {};
  const kind = KINDS.indexOf(t.amenity);
  if (lat == null || lng == null || !t.name || kind < 0) continue;
  if (t.name.length > 80) continue; // vandalism / pasted junk, not a real venue name
  if (t.disused === "yes" || t["disused:amenity"]) continue;
  const row = [`${e.type}/${e.id}`, t.name.trim(), kind, +lat.toFixed(5), +lng.toFixed(5)];
  const cuisine = clean(t.cuisine);
  const town = t["addr:city"] ?? t["addr:town"] ?? t["addr:village"];
  if (cuisine || town) row.push(cuisine ?? 0);
  if (town) row.push(town.trim());
  rows.push(row);
}
rows.sort((a, b) => a[3] - b[3] || a[4] - b[4]); // stable output → readable diffs

// A suspiciously small answer is more likely a broken server than a real change.
let previous = 0;
try {
  previous = JSON.parse(readFileSync(OUT, "utf8")).places.length;
} catch {}
if (previous && rows.length < previous * 0.8 && !process.argv.includes("--force")) {
  throw new Error(`Only ${rows.length} places (was ${previous}). Re-run with --force if that's expected.`);
}

const snapshot = {
  source: "© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
  osmBase,
  bbox: BBOX,
  kinds: KINDS,
  fields: ["id", "name", "kind", "lat", "lng", "cuisine", "town"],
  places: rows,
};
// One place per line keeps the file diffable.
writeFileSync(
  OUT,
  JSON.stringify({ ...snapshot, places: [] }, null, 2).replace(
    '"places": []',
    `"places": [\n${rows.map((r) => "    " + JSON.stringify(r)).join(",\n")}\n  ]`,
  ) + "\n",
);
console.log(`Wrote ${rows.length} places (OSM data as of ${osmBase}) to lib/places-tuscany.json`);
