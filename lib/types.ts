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

export const COLORS = [
  "#e4572e", "#2e86ab", "#7b2cbf", "#2a9d8f", "#f4a261",
  "#d62f6b", "#3a5a40", "#6d597a", "#0077b6", "#bc6c25",
];
export const colorFor = (i: number) => COLORS[i % COLORS.length];

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export const KIND_ICON: Record<string, string> = { restaurant: "🍝", bar: "🍸", pub: "🍺" };
