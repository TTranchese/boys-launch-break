"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point, Strategy, Suggestion } from "@/lib/geo";
import { inTuscany } from "@/lib/geo";
import { colorFor, type GroupResponse, type Restaurant } from "@/lib/types";

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

type Me = { id: string; name: string; lat?: number; lng?: number };

async function fetchRestaurants(p: Point, signal: AbortSignal): Promise<Restaurant[]> {
  const q = `[out:json][timeout:20];
    nwr["amenity"="restaurant"]["name"](around:1500,${p.lat},${p.lng});
    out center 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: q }),
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as {
    elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
  };
  return json.elements
    .map((e) => ({
      id: `${e.type}/${e.id}`,
      name: e.tags?.name ?? "Restaurant",
      lat: e.lat ?? e.center?.lat ?? 0,
      lng: e.lon ?? e.center?.lon ?? 0,
      cuisine: e.tags?.cuisine?.replace(/;/g, ", ").replace(/_/g, " "),
    }))
    .filter((r) => r.lat !== 0)
    .sort((a, b) => Math.hypot(a.lat - p.lat, a.lng - p.lng) - Math.hypot(b.lat - p.lat, b.lng - p.lng))
    .slice(0, 12);
}

export default function DinnerApp() {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [draft, setDraft] = useState<Point | null>(null);
  const [data, setData] = useState<GroupResponse | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("total");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restState, setRestState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups/${groupId}?strategy=${strategy}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const json = (await res.json()) as GroupResponse;

      // The DB is in-memory: if the server restarted and lost my row, re-publish it.
      const mine = meRef.current;
      if (mine?.lat != null && mine.lng != null && mine.name && !json.participants.some((p) => p.id === mine.id)) {
        await fetch(`/api/groups/${groupId}/participants/${mine.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: mine.name, lat: mine.lat, lng: mine.lng }),
        });
        return load();
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
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [groupId, me?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSelectedIdx(0), [strategy, data?.participants.length]);

  // --- restaurants around the selected town ---
  const selected: Suggestion | null = data?.meeting?.towns[selectedIdx] ?? null;
  const selectedKey = selected ? `${selected.name}` : "";
  useEffect(() => {
    if (!selected) { setRestaurants([]); return; }
    const ctrl = new AbortController();
    setRestState("loading");
    fetchRestaurants(selected, ctrl.signal)
      .then((r) => { setRestaurants(r); setRestState("idle"); })
      .catch((e) => { if (e.name !== "AbortError") { setRestaurants([]); setRestState("error"); } });
    return () => ctrl.abort();
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onMapClick({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Could not get your location"),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const save = async () => {
    if (!groupId || !me) return;
    const name = nameInput.trim();
    const pos = draft ?? (me.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null);
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
          <p className="muted small">
            {draft
              ? `Picked ${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`
              : joined
                ? "Click the map to move your pin."
                : "Click anywhere in Tuscany on the map to drop your pin."}
          </p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : joined ? "Update" : "Save my position"}
            </button>
            <button className="btn ghost" onClick={useMyLocation}>📍 Use my location</button>
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
                  {selected && (
                    <span className="muted small push">
                      {selected.distances.find((d) => d.participantId === p.id)?.km.toFixed(1)} km
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>3 · Where to eat</h2>
          <div className="segmented" role="tablist">
            <button className={strategy === "total" ? "on" : ""} onClick={() => setStrategy("total")}>
              Least total travel
            </button>
            <button className={strategy === "fair" ? "on" : ""} onClick={() => setStrategy("fair")}>
              Fairest for everyone
            </button>
          </div>
          <p className="muted small">
            {strategy === "total"
              ? "Minimizes the sum of everyone’s distances (geometric median)."
              : "Minimizes the longest trip anyone has to make (minimax)."}{" "}
            Distances are straight-line.
          </p>

          {!data?.meeting ? (
            <p className="muted small">Add at least one position to get suggestions.</p>
          ) : (
            <ol className="towns">
              {data.meeting.towns.map((t, i) => (
                <li key={t.name}>
                  <button className={i === selectedIdx ? "town on" : "town"} onClick={() => setSelectedIdx(i)}>
                    <span className="town-name">{i === 0 ? "🏆 " : ""}{t.name}</span>
                    <span className="muted small">
                      total {t.totalKm.toFixed(0)} km · longest {t.maxKm.toFixed(0)} km ({nameOf(
                        t.distances.reduce((a, b) => (b.km > a.km ? b : a)).participantId,
                      )})
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {selected && (
          <section className="card">
            <h2>Restaurants in {selected.name}</h2>
            {restState === "loading" && <p className="muted small">Searching OpenStreetMap…</p>}
            {restState === "error" && <p className="muted small">Couldn’t reach OpenStreetMap right now.</p>}
            {restState === "idle" && restaurants.length === 0 && (
              <p className="muted small">No restaurants found on OpenStreetMap nearby.</p>
            )}
            <ul className="restaurants">
              {restaurants.map((r) => (
                <li key={r.id}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${selected.name}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.name}
                  </a>
                  {r.cuisine && <span className="muted small"> · {r.cuisine}</span>}
                </li>
              ))}
            </ul>
            <a
              className="btn ghost block"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ristorante ${selected.name}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              More restaurants in {selected.name} on Google Maps ↗
            </a>
          </section>
        )}
      </aside>

      <main className="map">
        <DinnerMap
          participants={participants}
          colorOf={colorOf}
          myId={me?.id ?? ""}
          draft={draft}
          idealPoint={data?.meeting?.idealPoint ?? null}
          selected={selected}
          restaurants={restaurants}
          onMapClick={onMapClick}
        />
      </main>
    </div>
  );
}
