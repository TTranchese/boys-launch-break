import { haversineKm, type Point } from "./geo";

export const USER_AGENT = "CenaInToscana/1.0 (+https://github.com/TTranchese/BuberDinner)";

// Public OSRM demo server: free, no key, car profile. Fine for light use.
const OSRM_URL = process.env.OSRM_URL ?? "https://router.project-osrm.org";

export type Leg = { durationS: number; distanceM: number };

const coordList = (pts: Point[]) => pts.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");

/** Rough fallback when the router is down: road ≈ 1.35× straight line at 55 km/h. */
export function estimateLeg(a: Point, b: Point): Leg {
  const distanceM = haversineKm(a, b) * 1.35 * 1000;
  return { distanceM, durationS: (distanceM / 1000 / 55) * 3600 };
}

/**
 * Driving time/distance from every source to every destination.
 * Returns legs[source][destination], null where no road route exists.
 */
export async function drivingMatrix(sources: Point[], destinations: Point[]): Promise<(Leg | null)[][]> {
  const n = sources.length;
  const coords = coordList([...sources, ...destinations]);
  const src = sources.map((_, i) => i).join(";");
  const dst = destinations.map((_, i) => n + i).join(";");
  const url = `${OSRM_URL}/table/v1/driving/${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`;

  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = (await res.json()) as {
    code: string;
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  if (json.code !== "Ok" || !json.durations) throw new Error(`OSRM ${json.code}`);

  return json.durations.map((row, i) =>
    row.map((d, j) => {
      const m = json.distances?.[i]?.[j];
      return d == null ? null : { durationS: d, distanceM: m ?? estimateLeg(sources[i], destinations[j]).distanceM };
    }),
  );
}

export type Route = Leg & { path: [number, number][] }; // [lat, lng] pairs

/** The actual road route from a to b (simplified geometry for drawing). */
export async function drivingRoute(a: Point, b: Point): Promise<Route> {
  const url = `${OSRM_URL}/route/v1/driving/${coordList([a, b])}?overview=simplified&geometries=geojson`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = (await res.json()) as {
    code: string;
    routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[];
  };
  const r = json.routes?.[0];
  if (json.code !== "Ok" || !r) throw new Error(`OSRM ${json.code}`);
  return {
    durationS: r.duration,
    distanceM: r.distance,
    path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}
