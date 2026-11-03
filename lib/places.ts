import { haversineKm, type Point } from "./geo";

export type PlaceKind = "restaurant" | "bar" | "pub";

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  cuisine?: string;
  town?: string;
};

const OVERPASS_URLS = (
  process.env.OVERPASS_URL ??
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter"
).split(",");

export const USER_AGENT = "CenaInToscana/1.0 (+https://github.com/TTranchese/BuberDinner)";

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Restaurants, bars and pubs (from OpenStreetMap) around each seed point.
 * Keeps the `perSeed` nearest ones for every seed so candidates are spread
 * over all the areas instead of piling up in one busy town.
 */
export async function findPlaces(seeds: Point[], radiusM = 4000, perSeed = 10): Promise<Place[]> {
  if (seeds.length === 0) return [];
  const around = seeds
    .map((s) => `nwr["amenity"~"^(restaurant|bar|pub)$"]["name"](around:${radiusM},${s.lat.toFixed(5)},${s.lng.toFixed(5)});`)
    .join("\n");
  const query = `[out:json][timeout:40];(\n${around}\n);out center tags 1500;`;

  // Public Overpass servers are often slow or down: ask all of them at once and
  // take the first answer, within the route's 60 s budget.
  const ask = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    return ((await res.json()) as { elements: OverpassElement[] }).elements;
  };
  const elements = await Promise.any(OVERPASS_URLS.map(ask)).catch(() => {
    throw new Error("Overpass unavailable");
  });

  const all = new Map<string, Place>();
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const t = e.tags ?? {};
    if (lat == null || lng == null || !t.name) continue;
    if (t.disused === "yes" || t["disused:amenity"]) continue;
    all.set(`${e.type}/${e.id}`, {
      id: `${e.type}/${e.id}`,
      name: t.name,
      kind: (t.amenity as PlaceKind) ?? "restaurant",
      lat,
      lng,
      cuisine: t.cuisine?.replace(/;/g, ", ").replace(/_/g, " "),
      town: t["addr:city"] ?? t["addr:town"] ?? t["addr:village"],
    });
  }

  const list = [...all.values()];
  const picked = new Map<string, Place>();
  for (const seed of seeds) {
    list
      .map((p) => ({ p, d: haversineKm(seed, p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, perSeed)
      .forEach(({ p }) => picked.set(p.id, p));
  }
  return [...picked.values()];
}
