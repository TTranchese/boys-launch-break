"use client";

import L from "leaflet";
import { Fragment, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import type { Participant } from "@/lib/db";
import type { Point } from "@/lib/geo";
import { TUSCANY_BOUNDS } from "@/lib/geo";
import { formatDuration, type DinnerPlace, type ParticipantRoute } from "@/lib/types";

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

function ClickHandler({ onClick }: { onClick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Pan to a newly picked pin when it's off screen. */
function FlyTo({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (point && !map.getBounds().pad(-0.1).contains([point.lat, point.lng])) {
      map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 11), mapMotion());
    }
  }, [point, map]);
  return null;
}

/** When a place is selected, make sure it and everyone are on screen. */
function FitSelection({ points, selectedId }: { points: Point[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId || points.length === 0) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (!map.getBounds().contains(b)) map.flyToBounds(b.pad(0.15), { ...mapMotion(), maxZoom: 13 });
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · routes by <a href="https://project-osrm.org">OSRM</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
                    <br />🚗 {formatDuration(leg.durationS)} to {selected.name}
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
