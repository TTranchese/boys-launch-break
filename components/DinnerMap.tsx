"use client";

import L from "leaflet";
import { Fragment, useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import { CornersOutIcon, CarIcon } from "@phosphor-icons/react";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { createMapStyle } from "@/lib/map-style";
import type { Participant } from "@/lib/db";
import type { Point } from "@/lib/geo";
import { TUSCANY_BOUNDS } from "@/lib/geo";
import { formatDuration, type DinnerPlace, type ParticipantRoute } from "@/lib/types";

const MAP_ATTRIBUTION = '<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · routes by <a href="https://project-osrm.org">OSRM</a>';

function BrandedBasemap() {
  const map = useMap();
  useEffect(() => {
    setWorkerUrl(`/maplibre/worker.mjs?v=${getVersion()}`);
    const layer = maplibreGL({
      style: createMapStyle(), attributionControl: false,
    });
    layer.addTo(map);
    map.attributionControl.addAttribution(MAP_ATTRIBUTION);
    return () => {
      map.attributionControl.removeAttribution(MAP_ATTRIBUTION);
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

function GroupFocus({ points }: { points: Point[] }) {
  const map = useMap();
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!control.current) return;
    L.DomEvent.disableClickPropagation(control.current);
    L.DomEvent.disableScrollPropagation(control.current);
  }, []);
  return (
    <div className="map-group-control" ref={control}>
      <button className="btn ghost" onClick={() => {
        const b = TUSCANY_BOUNDS;
        const bounds = points.length
          ? L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
          : L.latLngBounds([b.south, b.west], [b.north, b.east]);
        map.fitBounds(bounds, { ...mapMotion(), padding: [48, 48], maxZoom: 13 });
      }}>
        <CornersOutIcon />Show everyone
      </button>
    </div>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Leaflet anchors at the coordinate; CSS owns the marker's size and centering.
const icon = (html: string) =>
  L.divIcon({ className: "map-marker", html, iconSize: [0, 0], iconAnchor: [0, 0] });

// Each person's sticker sits at its own slight angle, derived from their id so it
// stays put across reloads and polls.
const MAX_TILT_DEG = 8;
const tiltOf = (id: string) => {
  // FNV-1a plus a final mix, so near-identical ids (mock-1, mock-2) still scatter.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return ((h >>> 0) % (MAX_TILT_DEG * 2 + 1)) - MAX_TILT_DEG;
};

const dot = (color: string, label: string, tilt: number, { draft = false, arrive = false } = {}) =>
  icon(
    `<div class="pin${draft ? " pin-draft" : ""}${arrive ? " pin-arrive" : ""}" style="--person-color:${color};--pin-tilt:${tilt}deg">${escapeHtml(label)}</div>`,
  );

const idealIcon = icon(`<div class="pin pin-ideal">◎</div>`);
const placeIcon = (rank: number, selected = false) =>
  icon(`<div class="pin ${selected ? "pin-selected" : "pin-food"}">${rank}</div>`);

function tokenNumber(name: string) {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  if (!Number.isFinite(value)) throw new Error(`Missing design token: ${name}`);
  return value;
}

function mapMotion() {
  return {
    animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    duration: tokenNumber("--duration-map") / 1000,
  };
}

/**
 * Leaflet's flyTo only re-aligns tile layers on zoom events, so a flight that ends at the
 * current zoom leaves the tiles offset from the vector overlays. Pan for those instead.
 */
function flyTo(map: L.Map, center: L.LatLng, zoom: number) {
  if (zoom === map.getZoom()) map.setView(center, zoom, mapMotion());
  else map.flyTo(center, zoom, mapMotion());
}

function ClickHandler({ onClick }: { onClick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Keep tiles aligned when a responsive map surface becomes visible. */
function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Pan to a newly picked pin when it's off screen. */
function FlyTo({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (point && !map.getBounds().pad(-0.1).contains([point.lat, point.lng])) {
      flyTo(map, L.latLng(point.lat, point.lng), Math.max(map.getZoom(), 11));
    }
  }, [point, map]);
  return null;
}

/** When a place is selected, make sure it and everyone are on screen. */
function FitSelection({ points, selectedId }: { points: Point[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId || points.length === 0) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15);
    flyTo(map, b.getCenter(), Math.min(map.getBoundsZoom(b), 13));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export type DinnerMapProps = {
  participants: Participant[];
  colorOf: (id: string) => string;
  myId: string;
  draft: Point | null;
  idealPoint: Point | null;
  places: DinnerPlace[];
  selected: DinnerPlace | null;
  routes: ParticipantRoute[];
  onMapClick: (p: Point) => void;
  onSelectPlace: (id: string) => void;
};

export default function DinnerMap({
  participants, colorOf, myId, draft, idealPoint, places, selected, routes, onMapClick, onSelectPlace,
}: DinnerMapProps) {
  const b = TUSCANY_BOUNDS;
  const bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
  const routeOf = (id: string) => routes.find((r) => r.participantId === id);

  // Person icons are cached so Leaflet keeps the same marker element across renders:
  // a fresh icon would replace the element (restarting or cutting short the pop-in).
  // A pin pops in only when its icon is first built for someone not seen before;
  // `seen` is recorded after commit so StrictMode's double render doesn't swallow it.
  const seen = useRef(new Set<string>());
  const personIcons = useRef(new Map<string, L.DivIcon>());
  useEffect(() => {
    participants.forEach((p) => seen.current.add(p.id));
  }, [participants]);
  const personIcon = (p: Participant) => {
    const color = colorOf(p.id);
    const label = p.name.charAt(0).toUpperCase();
    const key = `${p.id}|${color}|${label}`;
    let cached = personIcons.current.get(key);
    if (!cached) {
      cached = dot(color, label, tiltOf(p.id), { arrive: !seen.current.has(p.id) });
      personIcons.current.set(key, cached);
    }
    return cached;
  };

  return (
    <MapContainer
      bounds={bounds}
      minZoom={2}
      maxZoom={19}
      worldCopyJump
      className="dinner-map"
    >
      <BrandedBasemap />
      <GroupFocus points={[...participants, ...(selected ? [selected] : []), ...(draft ? [draft] : [])]} />
      <ResizeMap />
      <ClickHandler onClick={onMapClick} />
      <FlyTo point={draft} />
      <FitSelection points={selected ? [...participants, selected] : []} selectedId={selected?.id ?? null} />

      {/* Road routes (dashed straight line while loading or if routing failed) */}
      {selected &&
        participants.map((p) => {
          const r = routeOf(p.id);
          // A route drawn for an old position of this person is stale: show the estimate until the new one lands.
          const stale = r && !("error" in r) && r.path.length > 0 &&
            (Math.abs(r.path[0][0] - p.lat) > 0.02 || Math.abs(r.path[0][1] - p.lng) > 0.02);
          const approximate = !r || "error" in r || stale;
          const positions: [number, number][] = approximate
            ? [[p.lat, p.lng], [selected.lat, selected.lng]]
            : r.path;
          const routeClass = approximate ? "map-route map-route-approximate" : "map-route";
          // Leaflet can't swap a path's className after mount, so remount when it flips dashed <-> solid.
          return <Fragment key={`route-${p.id}-${approximate ? "approx" : "road"}`}>
            <Polyline positions={positions} pathOptions={{ className: "map-route-casing", interactive: false }} />
            <Polyline positions={positions} pathOptions={{ color: colorOf(p.id), className: routeClass }} />
          </Fragment>;
        })}

      {participants
        .filter((p) => !(p.id === myId && draft))
        .map((p) => {
          const leg = selected?.legs.find((l) => l.participantId === p.id);
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={personIcon(p)} zIndexOffset={tokenNumber("--map-layer-person")} title={p.name}>
              <Popup>
                <strong>{p.name}</strong>
                {p.id === myId && " (you)"}
                {leg && selected && (
                  <>
                    <br /><CarIcon /> {formatDuration(leg.durationS)} to {selected.name}
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}

      {draft && (
        <Marker position={[draft.lat, draft.lng]} icon={dot(colorOf(myId), "?", tiltOf(myId), { draft: true })} zIndexOffset={tokenNumber("--map-layer-draft")} title="Unsaved position">
          <Popup>Your new position — press “Save” to share it</Popup>
        </Marker>
      )}

      {idealPoint && (
        <Marker position={[idealPoint.lat, idealPoint.lng]} icon={idealIcon}>
          <Popup>Straight-line optimum (as the crow flies)</Popup>
        </Marker>
      )}

      {places.map((pl, i) =>
        pl.id === selected?.id ? null : (
          <Marker
            key={pl.id}
            position={[pl.lat, pl.lng]}
            icon={placeIcon(i + 1)}
            title={`${i + 1}. ${pl.name}`}
            eventHandlers={{ click: () => onSelectPlace(pl.id) }}
          />
        ),
      )}

      {selected && (
        <Marker position={[selected.lat, selected.lng]} icon={placeIcon(places.findIndex((pl) => pl.id === selected.id) + 1, true)} zIndexOffset={tokenNumber("--map-layer-selected")} title={`Selected: ${selected.name}`}>
          <Popup>
            <strong>{selected.name}</strong>
            <br />
            Total {formatDuration(selected.totalS)} · longest {formatDuration(selected.maxS)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
