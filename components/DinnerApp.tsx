"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point, Strategy } from "@/lib/geo";
import { inTuscany, TUSCANY_BOUNDS } from "@/lib/geo";
import {
  colorFor, formatDuration, KIND_ICON,
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
  const [groupId, setGroupId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [draft, setDraft] = useState<Point | null>(null);
  const [data, setData] = useState<GroupResponse | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("total");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dinner, setDinner] = useState<DinnerResult | null>(null);
  const [dinnerState, setDinnerState] = useState<"idle" | "loading" | "error">("idle");
  const [dinnerError, setDinnerError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<ParticipantRoute[]>([]);
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
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
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
        setDinnerError(e instanceof Error ? e.message : "Something went wrong");
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
  const colorOf = useCallback((id: string) => colorMap.get(id) ?? "#888", [colorMap]);

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
      setError("Your browser can't share its location here. Search for your town below or tap the map.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inTuscany(p)) {
          setError("You seem to be outside Tuscany. Search for a town below or tap the map.");
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
          setError("Your location isn't available right now. Search for your town below or tap the map.");
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
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
      setError("Search is unavailable right now. Tap the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    setResults(null);
    setQuery("");
    setDraftLabel(r.label.split(",").slice(0, 2).join(","));
    onMapClick({ lat: r.lat, lng: r.lng });
  };

  const save = async () => {
    if (!groupId || !me) return;
    const name = nameInput.trim();
    const src = draft ?? (me.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null);
    const pos = src ? { lat: src.lat, lng: src.lng } : null;
    if (!name) { setError("Enter your name first"); return; }
    if (!pos) { setError("Click on the map to set your position"); return; }
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
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="layout">
      <aside className="panel">
        <header className="brand">
          <h1>🍷 Cena in Toscana</h1>
          <p>Drop your position on the map, share the link with friends, and find the best place to have dinner together.</p>
        </header>

        <section className="card">
          <div className="row between">
            <span className="muted small">Group <code>{groupId ?? "…"}</code></span>
            <span className="row gap">
              <button className="btn ghost" onClick={share}>{copied ? "Link copied!" : "Share link"}</button>
              <button className="btn ghost" onClick={newGroup}>New group</button>
            </span>
          </div>
        </section>

        <section className="card">
          <h2>{joined ? "Your position" : "1 · Add yourself"}</h2>
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
          <label className="field">
            <span>Where are you? Search a town or address — or tap the map</span>
            <form
              className="row gap"
              onSubmit={(e) => { e.preventDefault(); search(); }}
            >
              <input
                className="grow"
                type="search"
                value={query}
                placeholder="e.g. Empoli, or Via Roma 1 Siena"
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn ghost" type="submit" disabled={searching || query.trim().length < 2}>
                {searching ? "…" : "Search"}
              </button>
            </form>
          </label>
          {results && (
            <ul className="results">
              {results.length === 0 && <li className="muted small">No places found in Tuscany.</li>}
              {results.map((r) => (
                <li key={r.id}>
                  <button onClick={() => pickResult(r)}>{r.label}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            {draft
              ? `📌 Pin set${draftLabel ? ` at ${draftLabel}` : ""} — press “${joined ? "Update" : "Save my position"}”.`
              : joined
                ? "Search or tap the map to move your pin."
                : "Tip: you don’t need to share your exact address — a nearby town works fine."}
          </p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : joined ? "Update" : "Save my position"}
            </button>
            <button className="btn ghost" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating…" : "📍 Use my location"}
            </button>
            {joined && <button className="btn ghost danger" onClick={leave}>Leave</button>}
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="card">
          <h2>2 · Who’s coming ({participants.length})</h2>
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
                      <span className="muted small push">
                        🚗 {formatDuration(leg.durationS)} · {(leg.distanceM / 1000).toFixed(0)} km
                      </span>
                    ) : null;
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>3 · Where to eat</h2>
          <div className="segmented" role="tablist">
            <button className={strategy === "total" ? "on" : ""} onClick={() => setStrategy("total")}>
              Least total driving
            </button>
            <button className={strategy === "fair" ? "on" : ""} onClick={() => setStrategy("fair")}>
              Fairest drive
            </button>
          </div>
          <p className="muted small">
            {strategy === "total"
              ? "Restaurants and bars where everyone’s driving times add up to the least."
              : "Restaurants and bars where the longest drive is as short as possible."}{" "}
            Times are by car on real roads.
          </p>
          {dinner?.routing === "estimate" && (
            <p className="muted small">⚠️ The route service is busy, so these times are estimates.</p>
          )}

          {participants.length === 0 ? (
            <p className="muted small">Add at least one position to get suggestions.</p>
          ) : dinnerState === "loading" && !dinner ? (
            <p className="muted small">🚗 Finding restaurants and calculating drive times…</p>
          ) : dinnerState === "error" ? (
            <p className="error">
              {dinnerError}{" "}
              <button className="btn ghost" onClick={() => setRetry((n) => n + 1)}>Retry</button>
            </p>
          ) : dinner && dinner.places.length === 0 ? (
            <p className="muted small">No restaurants or bars found in the area on OpenStreetMap.</p>
          ) : (
            <ol className={`towns${dinnerState === "loading" ? " stale" : ""}`}>
              {dinner?.places.map((pl, i) => {
                const longest = pl.legs.reduce((a, b) => (b.durationS > a.durationS ? b : a));
                return (
                  <li key={pl.id}>
                    <button className={i === selectedIdx ? "town on" : "town"} onClick={() => setSelectedIdx(i)}>
                      <span className="town-name">
                        {i === 0 ? "🏆 " : `${KIND_ICON[pl.kind] ?? "🍽️"} `}
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
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {selected && (
          <section className="card">
            <h2>{KIND_ICON[selected.kind] ?? "🍽️"} {selected.name}</h2>
            <p className="muted small">
              {[selected.cuisine, selected.town].filter(Boolean).join(" · ") || "Details on OpenStreetMap"}
            </p>
            <div className="row gap wrap">
              <a
                className="btn primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}&travelmode=driving`}
                target="_blank"
                rel="noreferrer"
              >
                🚗 Directions
              </a>
              <a
                className="btn ghost"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name} ${selected.town ?? ""}`.trim())}`}
                target="_blank"
                rel="noreferrer"
              >
                Reviews & hours ↗
              </a>
              <a
                className="btn ghost"
                href={`https://www.openstreetmap.org/${selected.id}`}
                target="_blank"
                rel="noreferrer"
              >
                OSM ↗
              </a>
            </div>
          </section>
        )}
      </aside>

      <main className="map">
        <DinnerMap
          participants={participants}
          colorOf={colorOf}
          myId={me?.id ?? ""}
          draft={draft}
          idealPoint={data?.idealPoint ?? null}
          places={dinner?.places ?? []}
          selected={selected}
          routes={routes}
          onSelectPlace={(id) => {
            const i = dinner?.places.findIndex((p) => p.id === id) ?? -1;
            if (i >= 0) setSelectedIdx(i);
          }}
          onMapClick={onMapTap}
        />
      </main>
    </div>
  );
}
