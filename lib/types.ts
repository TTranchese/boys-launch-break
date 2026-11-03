import type { Participant } from "./db";
import type { DinnerResult, ParticipantRoute } from "./dinner";
import type { Point } from "./geo";

export type { DinnerPlace, DinnerResult, ParticipantRoute } from "./dinner";

export type GroupResponse = {
  groupId: string;
  participants: Participant[];
  idealPoint: Point | null;
};

export type DinnerResponse = DinnerResult | { error: string };
export type RoutesResponse = { routes: ParticipantRoute[] };

// CSS variables work for both DOM swatches and Leaflet's SVG strokes.
export const COLORS = Array.from({ length: 10 }, (_, i) => `var(--color-person-${i + 1})`);
export const colorFor = (i: number) => COLORS[i % COLORS.length];

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
