"use client";

import dynamic from "next/dynamic";
import { Share, LoaderCircle, Search } from "lucide-react";
import {
  IconContext, CheckIcon, CrosshairIcon, MapTrifoldIcon,
  NavigationArrowIcon, WarningCircleIcon, ForkKnifeIcon,
  ArrowSquareOutIcon, ArrowClockwiseIcon,
  PlusIcon, CaretDownIcon, CrownIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Point, Strategy } from "@/lib/geo";
import { inTuscany, TUSCANY_BOUNDS } from "@/lib/geo";
import {
  colorFor, formatDuration,
  type DinnerPlace, type DinnerResponse, type DinnerResult, type GroupResponse, type ParticipantRoute, type RoutesResponse,
} from "@/lib/types";

import type { MapFocus } from "./DinnerMap";
import { useI18n } from "./I18nProvider";
import { LOCALES, LOCALE_NAMES, type Messages, type ServerErrorCode } from "@/lib/i18n";

function MapLoading() {
  const { t } = useI18n();
  return <div className="map-loading">{t.map.loading}</div>;
}

const DinnerMap = dynamic(() => import("./DinnerMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

const randomId = (len = 10) => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

const storage = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};

type Box = { south: number; west: number; north: number; east: number };
type SearchResult = { id: number; label: string; lat: number; lng: number; box: Box };

type Me = { id: string; name: string; lat?: number; lng?: number };

/** Resting heights of the mobile sheet over the map. */
type Detent = "low" | "middle" | "full";
const DETENTS: Detent[] = ["low", "middle", "full"];

const directionsUrl = (pl: DinnerPlace) =>
  `https://www.google.com/maps/dir/?api=1&destination=${pl.lat},${pl.lng}&travelmode=driving`;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** OpenStreetMap cuisine tags, tidied: "italian, italian pizza, pizza" reads "Italian pizza". */
const cuisineLabel = (raw: string | undefined, names: Messages["cuisines"]) => {
  if (!raw) return null;
  const tags = [...new Set(raw.split(/[;,]/).map((t) => t.trim().replace(/_/g, " ").toLowerCase()).filter(Boolean))];
  // Drop a tag another tag already says ("pizza" inside "italian pizza").
  const kept = tags.filter((t) => !tags.some((o) => o !== t && o.split(" ").includes(t)));
  // Two tags can translate to the same word ("seafood" and "fish" are both "pesce").
  const named = [...new Set(kept.map((t) => names[t] ?? t))];
  return named.length ? capitalize(named.slice(0, 2).join(", ")) : null;
};
/** Always one line, so every result row has the same shape. */
const placeDescription = (pl: DinnerPlace, t: Messages) =>
  [(pl.kind === "restaurant" && cuisineLabel(pl.cuisine, t.cuisines)) || t.kind[pl.kind], pl.town].filter(Boolean).join(" · ");
const averageS = (pl: DinnerPlace) => pl.totalS / Math.max(1, pl.legs.length);
const minutes = (s: number) => Math.round(s / 60);

export default function DinnerApp() {
  const { t, locale, setLocale } = useI18n();
  const locationField = useRef<HTMLDivElement>(null);
  const positionStatus = useRef<HTMLParagraphElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const sheetTop = useRef<HTMLDivElement>(null);
  const middleDetent = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const sheetTrack = useRef<HTMLDivElement>(null);
  const mapArea = useRef<HTMLElement>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [detent, setDetent] = useState<Detent>("low");
  const [picking, setPicking] = useState(false);
  const beforePicking = useRef<{ draft: Point | null; label: string | null; query: string; detent: Detent } | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [draft, setDraft] = useState<Point | null>(null);
  const [data, setData] = useState<GroupResponse | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("total");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dinner, setDinner] = useState<DinnerResult | null>(null);
  const [dinnerState, setDinnerState] = useState<"idle" | "loading" | "error">("idle");
  const [routes, setRoutes] = useState<ParticipantRoute[]>([]);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  useEffect(() => {
    if (results === null) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!locationField.current?.contains(event.target as Node)) {
        setResults(null);
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [results]);

  // --- mobile sheet: a scroll-snap container over the map; on desktop it has no box and these are no-ops ---
  const detentTop = (d: Detent) =>
    d === "low" ? 0 : d === "middle" ? middleDetent.current?.offsetTop ?? 0 : panel.current?.offsetTop ?? 0;
  const goTo = (d: Detent, instant = false) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheet.current?.scrollTo({ top: detentTop(d), behavior: instant || reduce ? "instant" : "smooth" });
  };
  /** How much of the map the sheet hides when resting at a detent; nothing beside the desktop panel. */
  const sheetCover = (d: Detent) => {
    if (!sheetTrack.current || getComputedStyle(sheetTrack.current).display === "none") return 0;
    const mapHeight = mapArea.current?.getBoundingClientRect().height ?? 0;
    const sheetTopOnScreen = (panel.current?.offsetTop ?? 0) - detentTop(d);
    return Math.max(0, mapHeight - sheetTopOnScreen);
  };
  /** Show a place or the whole group, bringing the map out from under a full-height sheet. */
  const focusMap = (target: MapFocus["target"]) => {
    const resting = detent === "full" ? "middle" : detent;
    if (resting !== detent) goTo(resting);
    setMapFocus({ key: Date.now(), target, bottomInset: sheetCover(resting) });
  };
  const onSheetScroll = () => {
    const top = sheet.current?.scrollTop ?? 0;
    setDetent(top >= detentTop("full") - 1 ? "full" : DETENTS.reduce((a, b) =>
      Math.abs(detentTop(b) - top) < Math.abs(detentTop(a) - top) ? b : a));
  };

  // The low detent shows exactly the sheet's top section, however tall its content or text size makes it.
  const measurePeek = () => {
    const top = sheetTop.current, p = panel.current, root = layout.current;
    if (!top || !p || !root) return;
    const gap = parseFloat(getComputedStyle(p).rowGap) || 0;
    const peek = top.getBoundingClientRect().bottom - p.getBoundingClientRect().top + gap;
    root.style.setProperty("--sheet-peek-height", `${Math.ceil(peek)}px`);
  };
  useLayoutEffect(() => {
    if (!sheetTop.current) return;
    const observer = new ResizeObserver(measurePeek);
    observer.observe(sheetTop.current);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detent positions depend on the peek height, so moves that also change the sheet's
  // top section wait until it has re-rendered and been re-measured.
  const pendingDetent = useRef<Detent | null>(null);
  useLayoutEffect(() => {
    measurePeek();
    if (pendingDetent.current) {
      goTo(pendingDetent.current);
      pendingDetent.current = null;
    }
  });

  // Newcomers start with the form in view; returning members start on the map.
  const placedSheet = useRef(false);
  useEffect(() => {
    if (!me || placedSheet.current) return;
    placedSheet.current = true;
    if (me.lat == null) goTo("middle", true);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- bootstrap group id (from ?g=) and my identity (localStorage) ---
  useEffect(() => {
    const url = new URL(window.location.href);
    let g = url.searchParams.get("g");
    if (!g || !/^[A-Za-z0-9_-]{1,64}$/.test(g)) {
      g = randomId(8);
      url.searchParams.set("g", g);
      window.history.replaceState(null, "", url.toString());
    }
    setGroupId(g);

    const saved = storage.get(`dinner:${g}:me`);
    let mine: Me | null = null;
    if (saved) {
      try { mine = JSON.parse(saved) as Me; } catch { /* ignore */ }
    }
    if (!mine) mine = { id: randomId(12), name: storage.get("dinner:name") ?? "" };
    setMe(mine);
    setNameInput(mine.name);
  }, []);

  // --- load + poll group state ---
  const load = useCallback(async (republished = false) => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups/${groupId}?strategy=${strategy}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const json = (await res.json()) as GroupResponse;

      // The DB is in-memory: if the server restarted and lost my row, re-publish it.
      const mine = meRef.current;
      if (
        !republished &&
        mine?.lat != null && mine.lng != null && mine.name &&
        !json.participants.some((p) => p.id === mine.id)
      ) {
        await fetch(`/api/groups/${groupId}/participants/${mine.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: mine.name, lat: mine.lat, lng: mine.lng }),
        });
        return load(true);
      }
      setData(json);
      setGroupError(null);
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : t.errors.network);
    }
  }, [groupId, strategy, t]);

  useEffect(() => {
    if (!groupId || !me) return;
    load();
    const t = setInterval(() => load(), 5000);
    return () => clearInterval(t);
  }, [groupId, me?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- best places to eat, ranked by real driving time (recomputed only when positions change) ---
  const peopleKey = (data?.participants ?? [])
    .map((p) => `${p.id}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
    .sort()
    .join("|");
  const [retry, setRetry] = useState(0);
  const routesFor = useRef<string | null>(null);
  useEffect(() => {
    if (!groupId || !peopleKey) { setDinner(null); setDinnerState("idle"); return; }
    const ctrl = new AbortController();
    setDinnerState("loading");
    fetch(`/api/groups/${groupId}/dinner?strategy=${strategy}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as DinnerResponse;
        if ("error" in json) throw new Error(json.error);
        // Keep the same restaurant selected across refreshes so the map doesn't jump.
        const prevId = selectedIdRef.current;
        const keep = prevId ? json.places.findIndex((pl) => pl.id === prevId) : -1;
        setDinner(json);
        setSelectedIdx(keep >= 0 ? keep : 0);
        setDinnerState("idle");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setDinnerState("error");
      });
    return () => ctrl.abort();
  }, [groupId, strategy, peopleKey, retry]);

  const selected: DinnerPlace | null = dinner?.places[selectedIdx] ?? null;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;

  // --- road routes from everyone to the selected place ---
  const routeKey = selected ? `${selected.id}|${peopleKey}` : "";
  useEffect(() => {
    if (!groupId || !selected) { setRoutes([]); return; }
    if (routesFor.current !== selected.id) setRoutes([]);
    const forId = selected.id;
    const ctrl = new AbortController();
    // Keep the previous roads on screen until the new ones arrive; clearing them
    // makes every line flash back to dashed and the layers drift out of sync.
    fetch(`/api/groups/${groupId}/routes?lat=${selected.lat}&lng=${selected.lng}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<RoutesResponse>)
      .then((j) => { routesFor.current = forId; setRoutes(j.routes ?? []); })
      .catch(() => { /* lines are a nice-to-have */ });
    return () => ctrl.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- color per participant (stable by join order) ---
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    data?.participants.forEach((p, i) => m.set(p.id, colorFor(i)));
    if (me && !m.has(me.id)) m.set(me.id, colorFor(data?.participants.length ?? 0));
    return m;
  }, [data?.participants, me]);
  const colorOf = useCallback((id: string) => colorMap.get(id) ?? "var(--color-muted)", [colorMap]);

  const onMapClick = (p: Point) => {
    if (!inTuscany(p)) { setError(t.errors.pickInsideTuscany); return; }
    setError(null);
    setDraft(p);
  };
  const onMapTap = (p: Point) => {
    setDraftLabel(null);
    // The field names the chosen place; once the pin moves elsewhere that name would be wrong.
    setQuery("");
    onMapClick(p);
  };

  const useMyLocation = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(t.errors.geoUnsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inTuscany(p)) {
          setError(t.errors.outsideTuscany);
          return;
        }
        setDraftLabel(t.position.currentLocation);
        setQuery("");
        onMapClick(p);
        // Geolocation is only town-accurate, so frame the neighbourhood around it.
        focusMap({ center: p, area: { south: p.lat - 0.02, north: p.lat + 0.02, west: p.lng - 0.03, east: p.lng + 0.03 } });
      },
      (err) => {
        setLocating(false);
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (err.code === err.PERMISSION_DENIED) {
          setError(isIOS ? t.errors.locationBlockedIOS : t.errors.locationBlocked);
        } else if (err.code === err.TIMEOUT) {
          setError(t.errors.locationTimeout);
        } else {
          setError(t.errors.locationUnavailable);
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setError(null);
    setSearching(true);
    setResults(null);
    try {
      const b = TUSCANY_BOUNDS;
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          format: "jsonv2",
          q,
          countrycodes: "it",
          viewbox: `${b.west},${b.north},${b.east},${b.south}`,
          bounded: "1",
          limit: "5",
          "accept-language": locale === "it" ? "it,en" : "en,it",
        });
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as {
        place_id: number; display_name: string; lat: string; lon: string;
        boundingbox: [string, string, string, string]; // south, north, west, east
      }[];
      setResults(
        json
          .map((r) => {
            const [south, north, west, east] = r.boundingbox.map(Number);
            return { id: r.place_id, label: r.display_name, lat: Number(r.lat), lng: Number(r.lon), box: { south, north, west, east } };
          })
          .filter((r) => inTuscany(r)),
      );
    } catch {
      setError(t.errors.searchUnavailable);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    const name = r.label.split(",")[0];
    setResults(null);
    // Keep the choice visible in the field, as a native suggestion list does.
    setQuery(name);
    setDraftLabel(name);
    onMapClick({ lat: r.lat, lng: r.lng });
    // Frame the place itself: a town shows the town, an address shows its street.
    focusMap({ center: r, area: r.box });
  };

  const save = async () => {
    if (!groupId || !me) return;
    const name = nameInput.trim();
    const src = draft ?? (me.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null);
    const pos = src ? { lat: src.lat, lng: src.lng } : null;
    if (!name) { setError(t.errors.nameFirst); return; }
    if (!pos) { setError(t.errors.positionFirst); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/participants/${me.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ...pos }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; code?: ServerErrorCode };
        throw new Error((body.code && t.errors.server[body.code]) || body.error || res.statusText);
      }
      const updated: Me = { id: me.id, name, ...pos };
      setMe(updated);
      storage.set(`dinner:${groupId}:me`, JSON.stringify(updated));
      storage.set("dinner:name", name);
      setDraft(null);
      setError(null);
      await load();
      positionStatus.current?.focus({ preventScroll: true });
      // With the new position in, step back to the whole group.
      focusMap("everyone");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errors.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    if (!groupId || !me) return;
    await fetch(`/api/groups/${groupId}/participants/${me.id}`, { method: "DELETE" });
    const reset: Me = { id: me.id, name: me.name };
    setMe(reset);
    storage.set(`dinner:${groupId}:me`, JSON.stringify(reset));
    setDraft(null);
    await load();
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t.meta.shareTitle, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user cancelled */ }
  };

  const newGroup = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("g", randomId(8));
    window.location.href = url.toString();
  };

  const participants = data?.participants ?? [];
  const joined = participants.some((p) => p.id === me?.id);
  const hasChanges = draft !== null || nameInput.trim() !== (me?.name ?? "");
  const cancelChanges = () => {
    setNameInput(me?.name ?? "");
    setDraft(null);
    setDraftLabel(null);
    setQuery("");
    setResults(null);
    setError(null);
    positionStatus.current?.focus();
  };
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "?";

  // --- placing my pin: map taps only move it while this mode is on ---
  const startPicking = () => {
    beforePicking.current = { draft, label: draftLabel, query, detent };
    setError(null);
    setPicking(true);
    goTo("low");
  };
  const endPicking = (keep: boolean) => {
    const before = beforePicking.current;
    if (!keep) {
      setDraft(before?.draft ?? null);
      setDraftLabel(before?.label ?? null);
      setQuery(before?.query ?? "");
      setError(null);
    }
    setPicking(false);
    pendingDetent.current = before?.detent === "low" ? "middle" : before?.detent ?? "middle";
    positionStatus.current?.focus({ preventScroll: true });
  };
  const endPickingRef = useRef(endPicking);
  endPickingRef.current = endPicking;
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") endPickingRef.current(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picking]);

  const mapProps = {
    participants, colorOf, myId: me?.id ?? "", draft,
    idealPoint: data?.idealPoint ?? null,
    places: dinner?.places ?? [], selected, routes,
    onSelectPlace: (id: string) => {
      const i = dinner?.places.findIndex((p) => p.id === id) ?? -1;
      if (i >= 0) setSelectedIdx(i);
    },
    focus: mapFocus,
    onMapClick: picking ? onMapTap : () => {},
  };

  // Each row leads with the number it was ranked by; the other one is secondary.
  const solo = participants.length < 2;
  const rankedS = (pl: DinnerPlace) => (strategy === "fair" ? pl.maxS : averageS(pl));
  const metricCaption = solo ? t.places.captionSolo : strategy === "fair" ? t.places.captionFair : t.places.captionTotal;
  const placeTimes = (pl: DinnerPlace) => `${formatDuration(rankedS(pl))} ${metricCaption}`;
  const secondaryTimes = (pl: DinnerPlace) => {
    if (solo || pl.legs.length === 0) return null;
    const longest = pl.legs.reduce((a, b) => (b.durationS > a.durationS ? b : a));
    const who = longest.participantId === me?.id ? null : nameOf(longest.participantId);
    return strategy === "fair"
      ? t.places.fairSecondary(who, formatDuration(averageS(pl)))
      : t.places.totalSecondary(who, formatDuration(pl.maxS));
  };
  // Below #1, show how much longer each place is, so near-ties read as ties.
  const bestMin = dinner?.places[0] ? minutes(rankedS(dinner.places[0])) : 0;
  const rankLabel = (pl: DinnerPlace, i: number) => {
    if (i === 0) return { value: formatDuration(rankedS(pl)), caption: metricCaption, spoken: "" };
    const delta = minutes(rankedS(pl)) - bestMin;
    return delta <= 0
      ? { value: t.places.same, caption: null, spoken: t.places.sameSpoken }
      : { value: `+${formatDuration(delta * 60)}`, caption: null, spoken: t.places.longerSpoken };
  };
  const rankBadge = (i: number, on: boolean) => (
    <span className={on ? "rank-badge rank-badge--on" : "rank-badge"}>{i + 1}</span>
  );

  const peopleCard = (
    <section className="card card--people">
      <h2 className="section-heading">
        <span>{t.people.heading}</span>
        {data && (
          <span className="count-chip" role="status" aria-atomic="true">
            <span aria-hidden="true">{participants.length}</span>
            <span className="sr-only">{t.people.count(participants.length)}</span>
          </span>
        )}
      </h2>
      {!data ? (
        // Until the server answers, an empty list would claim nobody is coming.
        !groupError && <p className="muted small" role="status">{t.people.loading}</p>
      ) : participants.length === 0 ? (
        <p className="muted small">{t.people.empty}</p>
      ) : (
        <ul className="people">
          {participants.map((p) => {
            const leg = selected?.legs.find((l) => l.participantId === p.id);
            const meta = [
              p.id === me?.id ? t.common.you : null,
              leg ? `${formatDuration(leg.durationS)} · ${(leg.distanceM / 1000).toFixed(0)} km` : null,
            ].filter(Boolean).join(" · ");
            return (
              <li key={p.id}>
                <span className="avatar" aria-hidden="true" style={{ "--person-color": colorOf(p.id) } as CSSProperties}>{p.name.charAt(0).toUpperCase()}</span>
                <span className="people__name">
                  {p.name}
                  {meta && <span className="people__meta muted small">{meta}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const placesCard = (
    <section className="card card--places">
      <h2>{t.places.heading}</h2>
      {/* With one person both rankings are the same, so there is nothing to choose. */}
      {Boolean(dinner?.places.length) && !solo && (
        <>
          <fieldset className="segmented" aria-describedby="strategy-description">
            <legend className="sr-only">{t.places.rankBy}</legend>
            <label>
              <input type="radio" name="strategy" value="total" checked={strategy === "total"} onChange={() => setStrategy("total")} />
              {t.places.total}
            </label>
            <label>
              <input type="radio" name="strategy" value="fair" checked={strategy === "fair"} onChange={() => setStrategy("fair")} />
              {t.places.fair}
            </label>
          </fieldset>
          <p className="muted small" id="strategy-description">
            {strategy === "total" ? t.places.totalDescription : t.places.fairDescription}
          </p>
        </>
      )}
      {dinner?.routing === "estimate" && (
        <p className="muted small inline-meta"><WarningCircleIcon />{t.places.estimate}</p>
      )}

      <div role="status">
        {dinnerState === "loading" && dinner && (
          <div className="loading-state loading-state--refreshing">
            <LoaderCircle className="app-icon spinner" aria-hidden="true" />
            <p className="loading-state__text">{t.places.refreshing}</p>
          </div>
        )}
      </div>
      {!data ? (
        // The group is still loading; "Who's coming" already says so.
        null
      ) : participants.length === 0 ? (
        <p className="muted small">{t.places.savePositionFirst}</p>
      ) : dinnerState === "loading" && !dinner ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="app-icon spinner" aria-hidden="true" />
          <p className="loading-state__text">{t.places.finding}</p>
        </div>
      ) : dinnerState === "error" ? (
        <div className="availability-state" role="alert">
          <div className="availability-state__heading">
            <WarningCircleIcon />
            <h3 className="availability-state__title">{t.places.unavailableTitle}</h3>
          </div>
          <p className="muted small availability-state__description">
            {t.places.unavailableDescription}
          </p>
          <button className="btn ghost availability-state__retry" onClick={() => setRetry((n) => n + 1)}>
            <ArrowClockwiseIcon />{t.places.tryAgain}
          </button>
        </div>
      ) : dinner && dinner.places.length === 0 ? (
        <p className="muted small">{t.places.none}</p>
      ) : (
        <ol className="towns">
          {dinner?.places.map((pl, i) => {
            const on = i === selectedIdx;
            const rank = rankLabel(pl, i);
            const secondary = secondaryTimes(pl);
            return (
              // The selected row holds its own actions, so the highlight wraps both.
              <li key={pl.id} className={on ? "town on" : "town"}>
                <button className="town__select" aria-pressed={on} onClick={() => {
                  setSelectedIdx(i);
                  // Show the choice on the map instead of leaving it hidden under the sheet.
                  if (detent === "full") goTo("middle");
                }}>
                  {rankBadge(i, on)}
                  <span className="town__text">
                    <span className="town-name">{pl.name}</span>
                    <span className="muted small">{placeDescription(pl, t)}</span>
                    {secondary && <span className="muted small">{secondary}</span>}
                  </span>
                  <span className="town-metric">
                    <span className="town-metric__value">{rank.value}</span>
                    {rank.caption && <span className="town-metric__caption">{rank.caption}</span>}
                    {rank.spoken && <span className="sr-only">{rank.spoken}</span>}
                  </span>
                </button>
                {on && (
                  <div className="town__actions">
                    <a className="btn primary" href={directionsUrl(pl)} target="_blank" rel="noreferrer">
                      <NavigationArrowIcon />{t.common.directions}
                    </a>
                    <a
                      className="btn secondary"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pl.name} ${pl.town ?? ""}`.trim())}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.places.reviews}<ArrowSquareOutIcon />
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );

  return (
    <IconContext.Provider value={{ className: "app-icon", weight: "regular", "aria-hidden": true }}>
    <div className="layout" ref={layout}>
      <main className={picking ? "map map--picking" : "map"} aria-label={t.map.label} ref={mapArea}>
        <DinnerMap {...mapProps} />
      </main>
      <div className="sheet" ref={sheet} onScroll={onSheetScroll}>
      <div className="sheet__track" aria-hidden="true" ref={sheetTrack}>
        <div className="sheet__detent" ref={middleDetent} />
      </div>
      <aside className="panel" ref={panel}
        onFocus={(e) => {
          if (e.target.matches("input:not([type=radio])") && detent !== "full") goTo("full");
        }}>
        <div className="sheet__top" ref={sheetTop}>
          <button className="sheet__grabber"
            aria-label={detent === "full" ? t.sheet.showMap : t.sheet.showMore}
            onClick={() => goTo(detent === "low" ? "middle" : detent === "middle" ? "full" : "low")}>
            <span className="sheet__handle" />
          </button>
          <header className="brand">
            <div className="brand__eyebrow">{t.brand.eyebrow}</div>
            <div className="row between brand__heading">
              <h1>Cena in<br />Toscana<span className="brand__sticker" aria-hidden="true"><ForkKnifeIcon /></span></h1>
              <button className="btn ghost share-button" onClick={share} aria-label={copied ? t.brand.copied : t.brand.share}>
                {copied ? <CheckIcon /> : <Share className="app-icon" aria-hidden="true" />}
                <span className="share-button__label">{copied ? t.brand.copied : t.brand.share}</span>
              </button>
            </div>
            {!(joined && (selected || dinnerState !== "idle")) && (
              <p>{t.brand.tagline}</p>
            )}
          </header>
          {picking ? (
            <div className="picking-bar">
              <p className="small" role="status">
                {draft ? t.picking.placed : t.picking.prompt}
              </p>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="row gap">
                <button className="btn primary" onClick={() => endPicking(true)}><CheckIcon />{t.picking.done}</button>
                <button className="btn quiet" onClick={() => endPicking(false)}>{t.common.cancel}</button>
              </div>
            </div>
          ) : joined && selected ? (
            <div className="sheet-summary sheet-summary--place">
              {/* Out here there's no list to be number 1 of: the best place wears a crown instead. */}
              {selectedIdx === 0 ? (
                <span className="rank-badge rank-badge--on" role="img" aria-label={t.sheet.topPick}><CrownIcon weight="fill" /></span>
              ) : rankBadge(selectedIdx, true)}
              <div className="sheet-summary__text">
                <span className="town-name">{selected.name}</span>
                <span className="muted small">{placeTimes(selected)}</span>
              </div>
              <a className="btn primary" href={directionsUrl(selected)} target="_blank" rel="noreferrer">
                <NavigationArrowIcon />{t.common.directions}
              </a>
            </div>
          ) : joined && dinnerState === "loading" ? (
            <p className="sheet-summary muted small inline-meta">
              <LoaderCircle className="app-icon spinner" aria-hidden="true" />{t.places.finding}
            </p>
          ) : joined && dinnerState === "error" ? (
            <p className="sheet-summary muted small inline-meta"><WarningCircleIcon />{t.sheet.placesUnavailable}</p>
          ) : null}
        </div>

        <section className="card card--position">
          <h2>{joined ? t.position.headingJoined : t.position.headingNew}</h2>
          <label className="field">
            <span>{t.position.name}</span>
            <input
              value={nameInput}
              maxLength={40}
              placeholder={t.position.namePlaceholder}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </label>
          <div className="field location-field" ref={locationField}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setResults(null);
            }}
            onKeyDown={(e) => {
            if (e.key === "Escape" && results !== null) {
              e.preventDefault();
              setResults(null);
              document.getElementById("location-search")?.focus();
            }
            // Arrow keys move between the field and the results, as in any native suggestion list.
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              const options = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".results__option")];
              if (!options.length) return;
              e.preventDefault();
              const i = options.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === "ArrowDown") options[Math.min(i + 1, options.length - 1)].focus();
              else if (i <= 0) document.getElementById("location-search")?.focus();
              else options[i - 1].focus();
            }
          }}>
            <label htmlFor="location-search">{t.position.location}</label>
            <form
              className="row gap location-search"
              onSubmit={(e) => { e.preventDefault(); search(); }}
            >
              <input
                className="grow"
                id="location-search"
                type="search"
                aria-controls={results ? "location-results" : undefined}
                value={query}
                placeholder={t.position.locationPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="btn ghost"
                type="submit"
                aria-label={t.position.search}
                title={t.position.search}
                aria-busy={searching}
                disabled={searching || query.trim().length < 2}
              >
                {searching
                  ? <LoaderCircle className="app-icon spinner" aria-hidden="true" />
                  : <Search className="app-icon" aria-hidden="true" />}
              </button>
            </form>
            {results && (
              <ul className="results" id="location-results" aria-label={t.position.results}>
                {results.length === 0 && (
                  <li className="results__empty muted small" role="status">
                    {t.position.noResults}
                  </li>
                )}
                {results.map((r) => {
                  const [place, ...address] = r.label.split(",");
                  return (
                    <li key={r.id}>
                      <button className="results__option" onClick={() => pickResult(r)}>
                        <span className="results__name">{place}</span>
                        {address.length > 0 && (
                          <span className="results__context">{address.join(",").trim()}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="location-options">
            <button className="btn ghost" onClick={useMyLocation} disabled={locating}>
              <CrosshairIcon />{locating ? t.position.locating : t.position.useMyLocation}
            </button>
            <button className="btn ghost" onClick={startPicking} aria-pressed={picking}>
              <MapTrifoldIcon />{t.position.chooseOnMap}
            </button>
          </div>
          <p className="muted small position-status" role="status" ref={positionStatus} tabIndex={-1}>
            {draft
              ? t.position.selected(draftLabel ?? t.position.mapPin)
              : joined
                ? hasChanges ? t.position.unsaved : t.position.saved
                : t.position.hint}
          </p>
          {(!joined || hasChanges || saving) && (
            <div className={joined ? "position-actions position-actions--editing" : "position-actions"}>
              <button className={joined ? "btn ghost" : "btn primary"} onClick={save} disabled={saving}>
                {saving ? t.position.saving : joined ? t.position.save : t.position.savePosition}
              </button>
              {joined && <button className="btn quiet" onClick={cancelChanges} disabled={saving}>{t.common.cancel}</button>}
            </div>
          )}
          {error && !picking && <p className="error" role="alert">{error}</p>}
        </section>

        {/* Once you're in, the answer comes before the guest list. */}
        {joined ? <>{placesCard}{peopleCard}</> : <>{peopleCard}{placesCard}</>}

        {groupError && <p className="error" role="alert">{groupError}</p>}
        <details className="group-options">
          <summary className="group-options__toggle">{t.group.options}<CaretDownIcon /></summary>
          <div className="row between group-options__content">
            <span className="muted small">{t.group.label} <code>{groupId ?? "…"}</code></span>
            <button className="btn ghost" onClick={newGroup}><PlusIcon />{t.group.new}</button>
          </div>
          <fieldset className="segmented group-options__language">
            <legend className="group-options__legend">{t.language.label}</legend>
            {LOCALES.map((l) => (
              <label key={l} lang={l}>
                <input type="radio" name="locale" value={l} checked={locale === l} onChange={() => setLocale(l)} />
                {LOCALE_NAMES[l]}
              </label>
            ))}
          </fieldset>
          {joined && <button className="btn quiet danger-text group-options__leave" onClick={leave}>{t.group.leave}</button>}
        </details>
      </aside>
      </div>
    </div>
    </IconContext.Provider>
  );
}
