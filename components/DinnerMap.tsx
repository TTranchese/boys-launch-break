"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import type { Participant } from "@/lib/db";
import type { Point } from "@/lib/geo";
import { TUSCANY_BOUNDS } from "@/lib/geo";
import { formatDuration, KIND_ICON, type DinnerPlace, type ParticipantRoute } from "@/lib/types";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const icon = (html: string, size: number) =>
  L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

const dot = (color: string, label: string, size = 28) =>
  icon(
    `<div class="pin" style="background:${color};width:${size}px;height:${size}px">${escapeHtml(label)}</div>`,
    size,
  );

const starIcon = icon(`<div class="pin pin-star">★</div>`, 34);
const idealIcon = icon(`<div class="pin pin-ideal">◎</div>`, 22);
const placeIcon = (kind: string, rank: number) =>
  icon(`<div class="pin pin-food">${KIND_ICON[kind] ?? "🍽️"}<span class="rank">${rank}</span></div>`, 26);

function ClickHandler({ onClick }: { onClick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Pan to a newly picked pin when it's off screen. */
function FlyTo({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (point && !map.getBounds().pad(-0.1).contains([point.lat, point.lng])) {
      map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 11), { duration: 0.8 });
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
    if (!map.getBounds().contains(b)) map.flyToBounds(b.pad(0.15), { duration: 0.8, maxZoom: 13 });
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
      style={{ height: "100%", width: "100%" }}
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
          return r && !("error" in r) ? (
            <Polyline
              key={`route-${p.id}`}
              positions={r.path}
              pathOptions={{ color: colorOf(p.id), weight: 4, opacity: 0.8 }}
            />
          ) : (
            <Polyline
              key={`line-${p.id}`}
              positions={[[p.lat, p.lng], [selected.lat, selected.lng]]}
              pathOptions={{ color: colorOf(p.id), weight: 2, dashArray: "6 6", opacity: 0.6 }}
            />
          );
        })}

      {participants
        .filter((p) => !(p.id === myId && draft))
        .map((p) => {
          const leg = selected?.legs.find((l) => l.participantId === p.id);
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={dot(colorOf(p.id), p.name.charAt(0).toUpperCase())} zIndexOffset={500}>
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
        <Marker position={[draft.lat, draft.lng]} icon={dot(colorOf(myId), "?", 30)} zIndexOffset={600}>
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
            icon={placeIcon(pl.kind, i + 1)}
            eventHandlers={{ click: () => onSelectPlace(pl.id) }}
          />
        ),
      )}

      {selected && (
        <Marker position={[selected.lat, selected.lng]} icon={starIcon} zIndexOffset={1000}>
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
