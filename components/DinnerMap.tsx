"use client";

import L from "leaflet";
import { Fragment, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMapEvents, useMap } from "react-leaflet";
import { CornersOutIcon, CarIcon } from "@phosphor-icons/react";
import tuscanyBoundary from "@/lib/tuscany-boundary.json";
import type { Participant } from "@/lib/db";
import type { Point } from "@/lib/geo";
import { TUSCANY_BOUNDS } from "@/lib/geo";
import { formatDuration, type DinnerPlace, type ParticipantRoute } from "@/lib/types";

const regionRings = tuscanyBoundary as L.LatLngTuple[][];
const worldRing: L.LatLngTuple[] = [
  [85, -180], [85, 180], [-85, 180], [-85, -180],
];

function TuscanyFocus() {
  const map = useMap();
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!control.current) return;
    L.DomEvent.disableClickPropagation(control.current);
    L.DomEvent.disableScrollPropagation(control.current);
  }, []);
  return <>
    <Polygon positions={[worldRing, ...regionRings]} pathOptions={{
      className: "map-context-mask", fillRule: "evenodd",
      stroke: false, interactive: false,
    }} />
    {regionRings.map((ring, i) => (
      <Polygon key={i} positions={ring} pathOptions={{
        className: "map-region-outline", fill: false, interactive: false,
      }} />
    ))}
    <div className="map-region-control" ref={control}>
      <button className="btn ghost" aria-label="Show all Tuscany" onClick={() =>
        map.fitBounds(L.latLngBounds(regionRings.flat()), {
          ...mapMotion(), padding: [16, 16], maxZoom: 9,
        })
      }>
        <CornersOutIcon />Tuscany
      </button>
    </div>
  </>;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Leaflet anchors at the coordinate; CSS owns the marker's size and centering.
const icon = (html: string) =>
  L.divIcon({ className: "map-marker", html, iconSize: [0, 0], iconAnchor: [0, 0] });

const dot = (color: string, label: string, draft = false) =>
  icon(
    `<div class="pin${draft ? " pin-draft" : ""}" style="--person-color:${color}">${escapeHtml(label)}</div>`,
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

  return (
    <MapContainer
      bounds={bounds}
      minZoom={7}
      maxBounds={bounds.pad(0.05)}
      maxBoundsViscosity={1.0}
      className="dinner-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · routes by <a href="https://project-osrm.org">OSRM</a> · boundary © <a href="https://github.com/guglielmo/geojson-italy">ISTAT</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <TuscanyFocus />
      <ResizeMap />
      <ClickHandler onClick={onMapClick} />
      <FlyTo point={draft} />
      <FitSelection points={selected ? [...participants, selected] : []} selectedId={selected?.id ?? null} />

      {/* Road routes (dashed straight line while loading or if routing failed) */}
      {selected &&
        participants.map((p) => {
          const r = routeOf(p.id);
          const approximate = !r || "error" in r;
          const positions: [number, number][] = approximate
            ? [[p.lat, p.lng], [selected.lat, selected.lng]]
            : r.path;
          const routeClass = approximate ? "map-route map-route-approximate" : "map-route";
          return <Fragment key={`route-${p.id}`}>
            <Polyline positions={positions} pathOptions={{ className: "map-route-casing", interactive: false }} />
            <Polyline positions={positions} pathOptions={{ color: colorOf(p.id), className: routeClass }} />
          </Fragment>;
        })}

      {participants
        .filter((p) => !(p.id === myId && draft))
        .map((p) => {
          const leg = selected?.legs.find((l) => l.participantId === p.id);
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={dot(colorOf(p.id), p.name.charAt(0).toUpperCase())} zIndexOffset={tokenNumber("--map-layer-person")} title={p.name}>
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
        <Marker position={[draft.lat, draft.lng]} icon={dot(colorOf(myId), "?", true)} zIndexOffset={tokenNumber("--map-layer-draft")} title="Unsaved position">
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
