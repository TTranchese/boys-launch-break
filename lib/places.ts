import { haversineKm, type Point } from "./geo";
import snapshot from "./places-tuscany.json";

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

/**
 * Restaurants, bars and pubs across Tuscany, from a bundled OpenStreetMap
 * snapshot (`npm run places:update` refreshes it). Searching it in memory
 * means a dinner search never waits on, or fails because of, a public
 * Overpass server.
 */
type Row = [id: string, name: string, kind: number, lat: number, lng: number, cuisine?: string | 0, town?: string];

const KINDS = snapshot.kinds as PlaceKind[];
const PLACES: Place[] = (snapshot.places as Row[]).map(([id, name, kind, lat, lng, cuisine, town]) => ({
  id,
  name,
  kind: KINDS[kind] ?? "restaurant",
  lat,
  lng,
  ...(cuisine ? { cuisine } : {}),
  ...(town ? { town } : {}),
}));

/** When the OpenStreetMap data in the snapshot was taken. */
export const PLACES_AS_OF: string | undefined = snapshot.osmBase;

// Cheap pre-filter before the exact distance: degrees of latitude per km.
const DEG_LAT_PER_KM = 1 / 111.2;

/**
 * Places around each seed point. Keeps the `perSeed` nearest ones within
 * `radiusM` of every seed so candidates are spread over all the areas instead
 * of piling up in one busy town.
 */
export function findPlaces(seeds: Point[], radiusM = 4000, perSeed = 10): Place[] {
  const radiusKm = radiusM / 1000;
  const picked = new Map<string, Place>();
  for (const seed of seeds) {
    const dLat = radiusKm * DEG_LAT_PER_KM;
    const dLng = dLat / Math.cos((seed.lat * Math.PI) / 180);
    PLACES.filter((p) => Math.abs(p.lat - seed.lat) <= dLat && Math.abs(p.lng - seed.lng) <= dLng)
      .map((p) => ({ p, d: haversineKm(seed, p) }))
      .filter(({ d }) => d <= radiusKm)
      .sort((a, b) => a.d - b.d)
      .slice(0, perSeed)
      .forEach(({ p }) => picked.set(p.id, p));
  }
  return [...picked.values()];
}
