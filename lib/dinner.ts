import type { Participant } from "./db";
import { idealPointFor, searchSeeds, type Point, type Strategy } from "./geo";
import { findPlaces, type Place } from "./places";
import { drivingMatrix, drivingRoute, estimateLeg, type Leg, type Route } from "./routing";

export type DinnerPlace = Place & {
  totalS: number; // sum of everyone's driving time
  maxS: number; // longest single drive
  legs: ({ participantId: string } & Leg)[];
};

export type DinnerResult = {
  strategy: Strategy;
  routing: "road" | "estimate"; // "estimate" if the router was unreachable
  idealPoint: Point | null;
  places: DinnerPlace[];
};

const OSRM_MAX_COORDS = 100; // the public OSRM server rejects bigger tables

// --- small in-memory cache so polling friends don't hammer free services ---
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  if (!keep(value)) return value;
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return value;
}

const peopleKey = (people: Participant[]) =>
  people.map((p) => `${p.id}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).sort().join("|");

export async function computeDinner(
  people: Participant[],
  strategy: Strategy,
  limit = 10,
): Promise<DinnerResult> {
  const idealPoint = idealPointFor(people, strategy);
  if (people.length === 0) return { strategy, routing: "road", idealPoint, places: [] };

  return cached(`dinner|${strategy}|${peopleKey(people)}`, async () => {
    const seeds = searchSeeds(people, strategy);
    let candidates = await cached(`places|${seeds.map((s) => `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`).join(";")}`, () =>
      findPlaces(seeds),
    );
    candidates = candidates.slice(0, Math.max(0, OSRM_MAX_COORDS - people.length));

    let matrix: (Leg | null)[][];
    let routing: DinnerResult["routing"] = "road";
    try {
      matrix = await drivingMatrix(people, candidates);
    } catch {
      routing = "estimate";
      matrix = people.map((p) => candidates.map((c) => estimateLeg(p, c)));
    }

    const scored: DinnerPlace[] = [];
    candidates.forEach((c, j) => {
      const legs = people.map((p, i) => ({ participantId: p.id, ...matrix[i][j] }));
      if (legs.some((l) => l.durationS == null)) return; // unreachable by car
      const ok = legs as ({ participantId: string } & Leg)[];
      const totalS = ok.reduce((s, l) => s + l.durationS, 0);
      const maxS = Math.max(...ok.map((l) => l.durationS));
      scored.push({ ...c, totalS, maxS, legs: ok });
    });

    scored.sort((a, b) =>
      strategy === "fair" ? a.maxS - b.maxS || a.totalS - b.totalS : a.totalS - b.totalS || a.maxS - b.maxS,
    );
    return { strategy, routing, idealPoint, places: scored.slice(0, limit) };
  }, (r) => r.routing === "road"); // don't keep fallback estimates around
}

export type ParticipantRoute = { participantId: string } & (Route | { error: true });

export async function computeRoutes(people: Participant[], to: Point): Promise<ParticipantRoute[]> {
  return Promise.all(
    people.map(async (p) => {
      try {
        const r = await cached(`route|${p.lat.toFixed(4)},${p.lng.toFixed(4)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`, () =>
          drivingRoute(p, to),
        );
        return { participantId: p.id, ...r };
      } catch {
        return { participantId: p.id, error: true as const };
      }
    }),
  );
}
