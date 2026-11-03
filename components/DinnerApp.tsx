"use client";

import dynamic from "next/dynamic";
import { Share, LoaderCircle, Search } from "lucide-react";
import {
  IconContext, CheckIcon, CrosshairIcon, MapTrifoldIcon,
  NavigationArrowIcon, CarIcon, WarningCircleIcon, ForkKnifeIcon,
  WineIcon, BeerSteinIcon, ArrowSquareOutIcon, ArrowClockwiseIcon,
  PlusIcon, CaretDownIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point, Strategy } from "@/lib/geo";
import { inTuscany, TUSCANY_BOUNDS } from "@/lib/geo";
import {
  colorFor, formatDuration,
  type DinnerPlace, type DinnerResponse, type DinnerResult, type GroupResponse, type ParticipantRoute, type RoutesResponse,
} from "@/lib/types";

const DinnerMap = dynamic(() => import("./DinnerMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
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

type SearchResult = { id: number; label: string; lat: number; lng: number };

type Me = { id: string; name: string; lat?: number; lng?: number };

export default function DinnerApp() {
  const [desktop, setDesktop] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const locationField = useRef<HTMLDivElement>(null);
  const positionStatus = useRef<HTMLParagraphElement>(null);
  const selectedPlaceButton = useRef<HTMLButtonElement>(null);
  const mapDialog = useRef<HTMLDialogElement>(null);
  const [mapMode, setMapMode] = useState<"position" | "places" | null>(null);
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

  useEffect(() => {
    if (mapMode) {
      mapDialog.current?.showModal();
      setMapReady(true);
    } else {
      mapDialog.current?.close();
      setMapReady(false);
    }
  }, [mapMode]);

  useEffect(() => {
    const breakpoint = getComputedStyle(document.documentElement)
      .getPropertyValue("--breakpoint-desktop").trim();
    const media = window.matchMedia(`(min-width: ${breakpoint})`);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
      setGroupError(e instanceof Error ? e.message : "Network error");
    }
  }, [groupId, strategy]);

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
  useEffect(() => {
    if (!groupId || !peopleKey) { setDinner(null); setDinnerState("idle"); return; }
    const ctrl = new AbortController();
    setDinnerState("loading");
    fetch(`/api/groups/${groupId}/dinner?strategy=${strategy}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as DinnerResponse;
        if ("error" in json) throw new Error(json.error);
        setDinner(json);
        setSelectedIdx(0);
        setDinnerState("idle");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setDinnerState("error");
      });
    return () => ctrl.abort();
  }, [groupId, strategy, peopleKey, retry]);

  const selected: DinnerPlace | null = dinner?.places[selectedIdx] ?? null;

  // --- road routes from everyone to the selected place ---
  const routeKey = selected ? `${selected.id}|${peopleKey}` : "";
  useEffect(() => {
    if (!groupId || !selected) { setRoutes([]); return; }
    const ctrl = new AbortController();
    setRoutes([]);
    fetch(`/api/groups/${groupId}/routes?lat=${selected.lat}&lng=${selected.lng}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<RoutesResponse>)
      .then((j) => setRoutes(j.routes ?? []))
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
    if (!inTuscany(p)) { setError("Please pick a spot inside Tuscany"); return; }
    setError(null);
    setDraft(p);
  };
  const onMapTap = (p: Point) => {
    setDraftLabel(null);
    onMapClick(p);
  };

  const useMyLocation = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setError("Your browser can't share its location here. Search for your town or choose on the map.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inTuscany(p)) {
          setError("You seem to be outside Tuscany. Search for a town or choose on the map.");
          return;
        }
        setDraftLabel("your current location");
        onMapClick(p);
      },
      (err) => {
        setLocating(false);
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            isIOS
              ? "Location access is blocked. On iPhone: Settings → Privacy & Security → Location Services → turn it on, then allow your browser (Safari Websites / Chrome) “While Using”. Or just search for your town below."
              : "Location access is blocked. Allow location for this site in your browser settings, or search for your town below.",
          );
        } else if (err.code === err.TIMEOUT) {
          setError("Getting your location took too long. Try again, or search for your town below.");
        } else {
          setError("Your location isn't available right now. Search for your town or choose on the map.");
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
          "accept-language": "it,en",
        });
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { place_id: number; display_name: string; lat: string; lon: string }[];
      setResults(
        json
          .map((r) => ({ id: r.place_id, label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
          .filter((r) => inTuscany(r)),
      );
    } catch {
      setError("Search is unavailable right now. Choose on the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    setResults(null);
    setQuery("");
    setDraftLabel(r.label.split(",")[0]);
    onMapClick({ lat: r.lat, lng: r.lng });
  };

  const save = async () => {
    if (!groupId || !me) return;
    const name = nameInput.trim();
    const src = draft ?? (me.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null);
    const pos = src ? { lat: src.lat, lng: src.lng } : null;
    if (!name) { setError("Enter your name first"); return; }
    if (!pos) { setError("Search for your town, use your location, or choose on the map"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/participants/${me.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ...pos }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const updated: Me = { id: me.id, name, ...pos };
      setMe(updated);
      storage.set(`dinner:${groupId}:me`, JSON.stringify(updated));
      storage.set("dinner:name", name);
      setDraft(null);
      setError(null);
      await load();
      positionStatus.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
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
      if (navigator.share) await navigator.share({ title: "Dinner in Tuscany", url });
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

  const closeMap = () => {
    setMapMode(null);
    if (mapMode === "places") selectedPlaceButton.current?.focus();
  };

  const mapProps = {
    participants, colorOf, myId: me?.id ?? "", draft,
    idealPoint: data?.idealPoint ?? null,
    places: dinner?.places ?? [], selected, routes,
    onSelectPlace: (id: string) => {
      const i = dinner?.places.findIndex((p) => p.id === id) ?? -1;
      if (i >= 0) setSelectedIdx(i);
    },
    onMapClick: onMapTap,
  };

  return (
    <IconContext.Provider value={{ className: "app-icon", weight: "regular", "aria-hidden": true }}>
    <div className="layout">
      <aside className="panel">
        <header className="brand">
          <div className="row between brand__heading">
            <h1>Cena in Toscana</h1>
            <button className="btn ghost share-button" onClick={share} aria-label={copied ? "Link copied!" : "Share link"}>
              {copied ? <CheckIcon /> : <Share className="app-icon" aria-hidden="true" />}
              <span className="share-button__label">{copied ? "Link copied!" : "Share link"}</span>
            </button>
          </div>
          <p>Find a place for dinner that works for everyone.</p>
        </header>

        <section className="card">
          <h2>{joined ? "Your position" : "Add yourself"}</h2>
          <label className="field">
            <span>Your name</span>
            <input
              value={nameInput}
              maxLength={40}
              placeholder="e.g. Giulia"
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
          }}>
            <label htmlFor="location-search">Your town or address</label>
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
                placeholder="e.g. Empoli"
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="btn ghost"
                type="submit"
                aria-label="Search locations"
                title="Search locations"
                aria-busy={searching}
                disabled={searching || query.trim().length < 2}
              >
                {searching
                  ? <LoaderCircle className="app-icon spinner" aria-hidden="true" />
                  : <Search className="app-icon" aria-hidden="true" />}
              </button>
            </form>
            {results && (
              <ul className="results" id="location-results" aria-label="Location results">
                {results.length === 0 && (
                  <li className="results__empty muted small" role="status">
                    No places found in Tuscany. Try a nearby town.
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
              <CrosshairIcon />{locating ? "Locating…" : "My location"}
            </button>
            <button className="btn ghost" onClick={() => setMapMode("position")} aria-haspopup="dialog">
              <MapTrifoldIcon />Choose on map
            </button>
          </div>
          <p className="muted small position-status" role="status" ref={positionStatus} tabIndex={-1}>
            {draft
              ? `Selected: ${draftLabel ?? "your map pin"}. Save to share with the group.`
              : joined
                ? hasChanges ? "You have unsaved changes." : "Your position is saved. Choose a new location to move it."
                : "A nearby town is enough — no exact address needed."}
          </p>
          {(!joined || hasChanges || saving) && (
            <div className={joined ? "position-actions position-actions--editing" : "position-actions"}>
              <button className={joined ? "btn ghost" : "btn primary"} onClick={save} disabled={saving}>
                {saving ? "Saving…" : joined ? "Update position" : "Save my position"}
              </button>
              {joined && <button className="btn quiet" onClick={cancelChanges} disabled={saving}>Cancel</button>}
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="card">
          <h2 className="section-heading">
            <span>Who’s coming</span>
            <span className="count-chip" role="status" aria-atomic="true">
              <span aria-hidden="true">{participants.length}</span>
              <span className="sr-only">{participants.length} {participants.length === 1 ? "person" : "people"} coming</span>
            </span>
          </h2>
          {participants.length === 0 ? (
            <p className="muted small">Nobody yet. Be the first!</p>
          ) : (
            <ul className="people">
              {participants.map((p) => (
                <li key={p.id}>
                  <span className="swatch" style={{ background: colorOf(p.id) }} />
                  {p.name}
                  {p.id === me?.id && <span className="muted small"> (you)</span>}
                  {selected && (() => {
                    const leg = selected.legs.find((l) => l.participantId === p.id);
                    return leg ? (
                      <span className="muted small push inline-meta">
                        <CarIcon /> {formatDuration(leg.durationS)} · {(leg.distanceM / 1000).toFixed(0)} km
                      </span>
                    ) : null;
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Where to eat</h2>
          {Boolean(dinner?.places.length) && (
            <>
              <div className="mobile-map-link">
                <button className="btn ghost" onClick={() => setMapMode("places")} aria-haspopup="dialog"><MapTrifoldIcon />View places on map</button>
              </div>
              <fieldset className="segmented" aria-describedby="strategy-description">
                <legend>Compare places</legend>
                <label>
                  <input type="radio" name="strategy" value="total" checked={strategy === "total"} onChange={() => setStrategy("total")} />
                  Least total driving
                </label>
                <label>
                  <input type="radio" name="strategy" value="fair" checked={strategy === "fair"} onChange={() => setStrategy("fair")} />
                  Fairest drive
                </label>
              </fieldset>
              <p className="muted small" id="strategy-description">
                {strategy === "total"
                  ? "Restaurants and bars where everyone’s driving times add up to the least."
                  : "Restaurants and bars where the longest drive is as short as possible."}{" "}
                Times are by car on real roads.
              </p>
            </>
          )}
          {dinner?.routing === "estimate" && (
            <p className="muted small inline-meta"><WarningCircleIcon />The route service is busy, so these times are estimates.</p>
          )}

          <div role="status">
            {dinnerState === "loading" && dinner && (
              <div className="loading-state loading-state--refreshing">
                <LoaderCircle className="app-icon spinner" aria-hidden="true" />
                <p className="loading-state__text">Updating drive times…</p>
              </div>
            )}
          </div>
          {participants.length === 0 ? (
            <p className="muted small">Save your position to see places for dinner.</p>
          ) : dinnerState === "loading" && !dinner ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="app-icon spinner" aria-hidden="true" />
              <p className="loading-state__text">Finding places to eat…</p>
            </div>
          ) : dinnerState === "error" ? (
            <div className="availability-state" role="alert">
              <div className="availability-state__heading">
                <WarningCircleIcon />
                <h3 className="availability-state__title">Places are unavailable</h3>
              </div>
              <p className="muted small availability-state__description">
                We couldn’t load dinner suggestions. Your group and saved positions are still here.
              </p>
              <button className="btn ghost availability-state__retry" onClick={() => setRetry((n) => n + 1)}>
                <ArrowClockwiseIcon />Try again
              </button>
            </div>
          ) : dinner && dinner.places.length === 0 ? (
            <p className="muted small">No restaurants or bars found in the area on OpenStreetMap.</p>
          ) : (
            <ol className="towns">
              {dinner?.places.map((pl, i) => {
                const longest = pl.legs.reduce((a, b) => (b.durationS > a.durationS ? b : a));
                return (
                  <li key={pl.id}>
                    <button ref={i === selectedIdx ? selectedPlaceButton : null} className={i === selectedIdx ? "town on" : "town"} aria-pressed={i === selectedIdx} onClick={() => setSelectedIdx(i)}>
                      <span className="town-name">
                        {pl.kind === "bar" ? <WineIcon /> : pl.kind === "pub" ? <BeerSteinIcon /> : <ForkKnifeIcon />}
                        {pl.name}
                      </span>
                      <span className="muted small">
                        {[pl.kind === "restaurant" ? pl.cuisine : pl.kind, pl.town].filter(Boolean).join(" · ")}
                      </span>
                      <span className="small">
                        {participants.length > 1 ? (
                          <>total {formatDuration(pl.totalS)} · longest {formatDuration(pl.maxS)} ({nameOf(longest.participantId)})</>
                        ) : (
                          <>{formatDuration(pl.totalS)} drive</>
                        )}
                      </span>
                    </button>
                    {i === selectedIdx && (
                      <div className="row gap wrap town-actions">
                        <a
                          className="btn primary"
                          href={`https://www.google.com/maps/dir/?api=1&destination=${pl.lat},${pl.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <NavigationArrowIcon />Directions
                        </a>
                        <a
                          className="btn ghost"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pl.name} ${pl.town ?? ""}`.trim())}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Reviews & hours<ArrowSquareOutIcon />
                        </a>
                        <a
                          className="btn ghost"
                          href={`https://www.openstreetmap.org/${pl.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Place details<ArrowSquareOutIcon />
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {groupError && <p className="error" role="alert">{groupError}</p>}
        <details className="group-options">
          <summary className="group-options__toggle">Group options<CaretDownIcon /></summary>
          <div className="row between group-options__content">
            <span className="muted small">Group <code>{groupId ?? "…"}</code></span>
            <button className="btn ghost" onClick={newGroup}><PlusIcon />New group</button>
          </div>
          {joined && <button className="btn quiet danger-text group-options__leave" onClick={leave}>Leave group</button>}
        </details>
      </aside>

      <main className="map" aria-label="Group map">
        {desktop && <DinnerMap {...mapProps} />}
      </main>
      <dialog className="map-dialog" ref={mapDialog} onClose={closeMap} aria-labelledby="map-title" aria-describedby="map-help">
        <div className="map-dialog__header">
          <h2 id="map-title">{mapMode === "position" ? "Choose your position" : "Places for dinner"}</h2>
          <button className="btn primary" onClick={() => mapDialog.current?.close()} autoFocus><CheckIcon />Done</button>
        </div>
        <p className="muted small map-dialog__help" id="map-help" role="status">
          {mapMode === "position"
            ? draft ? "Pin selected. Tap Done to return and save your position." : "Tap the map to place your pin, then tap Done."
            : selected ? `Selected: ${selected.name}. Tap Done to see its details.` : "Tap a numbered pin to select a place."}
        </p>
        {error && mapMode === "position" && <p className="error map-dialog__error" role="alert">{error}</p>}
        <div className="map-dialog__canvas">
          {mapMode && mapReady && <DinnerMap {...mapProps} onMapClick={mapMode === "position" ? onMapTap : () => {}} />}
        </div>
      </dialog>
    </div>
    </IconContext.Provider>
  );
}
