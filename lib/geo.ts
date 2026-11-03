import { TOWNS } from "./towns";

export type Point = { lat: number; lng: number };
export type Strategy = "total" | "fair";

// Rough bounding box of Tuscany, used to validate input and constrain the map.
export const TUSCANY_BOUNDS = {
  south: 42.2,
  west: 9.6,
  north: 44.5,
  east: 12.4,
};
export const TUSCANY_CENTER: Point = { lat: 43.45, lng: 11.0 };

export function inTuscany(p: Point): boolean {
  const b = TUSCANY_BOUNDS;
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

const R = 6371; // km

/** Great-circle distance in km. */
export function haversineKm(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Local equirectangular projection (km). Accurate enough at regional scale.
const REF_LAT = (TUSCANY_CENTER.lat * Math.PI) / 180;
const KM_PER_DEG_LAT = (Math.PI * R) / 180;
const KM_PER_DEG_LNG = KM_PER_DEG_LAT * Math.cos(REF_LAT);
const toXY = (p: Point) => ({ x: p.lng * KM_PER_DEG_LNG, y: p.lat * KM_PER_DEG_LAT });
const toLatLng = (x: number, y: number): Point => ({ lat: y / KM_PER_DEG_LAT, lng: x / KM_PER_DEG_LNG });

/** Geometric median (Weiszfeld): the point minimizing the SUM of distances. */
export function geometricMedian(points: Point[]): Point {
  const xy = points.map(toXY);
  let x = xy.reduce((s, p) => s + p.x, 0) / xy.length;
  let y = xy.reduce((s, p) => s + p.y, 0) / xy.length;
  for (let iter = 0; iter < 500; iter++) {
    let num_x = 0, num_y = 0, den = 0;
    for (const p of xy) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 1e-9) continue; // sitting on a point: skip its singular term
      num_x += p.x / d;
      num_y += p.y / d;
      den += 1 / d;
    }
    if (den === 0) break;
    const nx = num_x / den, ny = num_y / den;
    const moved = Math.hypot(nx - x, ny - y);
    x = nx;
    y = ny;
    if (moved < 1e-6) break;
  }
  return toLatLng(x, y);
}

/** Center of the minimum enclosing circle: minimizes the MAX distance (fairest). */
export function minimaxCenter(points: Point[]): Point {
  const xy = points.map(toXY);
  let cx = xy[0].x, cy = xy[0].y;
  // Bădoiu–Clarkson iteration: step toward the farthest point with shrinking steps.
  for (let i = 1; i <= 5000; i++) {
    let far = xy[0], best = -1;
    for (const p of xy) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > best) { best = d; far = p; }
    }
    cx += (far.x - cx) / (i + 1);
    cy += (far.y - cy) / (i + 1);
  }
  return toLatLng(cx, cy);
}

export type Suggestion = {
  name: string;
  lat: number;
  lng: number;
  totalKm: number;
  maxKm: number;
  distances: { participantId: string; km: number }[];
};

export type MeetingResult = {
  strategy: Strategy;
  idealPoint: Point; // the mathematical optimum (may be in a field!)
  towns: Suggestion[]; // real places, best first
};

export function findMeetingPlace(
  people: (Point & { id: string })[],
  strategy: Strategy,
  limit = 5,
): MeetingResult | null {
  if (people.length === 0) return null;
  const idealPoint = strategy === "fair" ? minimaxCenter(people) : geometricMedian(people);

  const scored: Suggestion[] = TOWNS.map((t) => {
    const distances = people.map((p) => ({ participantId: p.id, km: haversineKm(p, t) }));
    const totalKm = distances.reduce((s, d) => s + d.km, 0);
    const maxKm = Math.max(...distances.map((d) => d.km));
    return { ...t, totalKm, maxKm, distances };
  });

  // Primary metric depends on strategy; the other one breaks ties.
  scored.sort((a, b) =>
    strategy === "fair"
      ? a.maxKm - b.maxKm || a.totalKm - b.totalKm
      : a.totalKm - b.totalKm || a.maxKm - b.maxKm,
  );

  return { strategy, idealPoint, towns: scored.slice(0, limit) };
}
