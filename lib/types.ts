import type { Participant } from "./db";
import type { MeetingResult } from "./geo";

export type GroupResponse = {
  groupId: string;
  participants: Participant[];
  meeting: MeetingResult | null;
};

export type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cuisine?: string;
};

export const COLORS = [
  "#e4572e", "#2e86ab", "#7b2cbf", "#2a9d8f", "#f4a261",
  "#d62f6b", "#3a5a40", "#6d597a", "#0077b6", "#bc6c25",
];
export const colorFor = (i: number) => COLORS[i % COLORS.length];
