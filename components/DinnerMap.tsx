"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, Circle } from "react-leaflet";
import type { Participant } from "@/lib/db";
import type { Point, Suggestion } from "@/lib/geo";
import { TUSCANY_BOUNDS } from "@/lib/geo";
import type { Restaurant } from "@/lib/types";

const dot = (color: string, label: string, size = 28) =>
  L.divIcon({
    className: "",
    html: `<div class="pin" style="background:${color};width:${size}px;height:${size}px">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const starIcon = L.divIcon({
  className: "",
  html: `<div class="pin pin-star">★</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const idealIcon = L.divIcon({
  className: "",
  html: `<div class="pin pin-ideal">◎</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const forkIcon = L.divIcon({
  className: "",
  html: `<div class="pin pin-food">🍝</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function ClickHandler({ onClick }: { onClick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export type DinnerMapProps = {
  participants: Participant[];
  colorOf: (id: string) => string;
  myId: string;
  draft: Point | null;
  idealPoint: Point | null;
  selected: Suggestion | null;
  restaurants: Restaurant[];
  onMapClick: (p: Point) => void;
};

export default function DinnerMap({
  participants, colorOf, myId, draft, idealPoint, selected, restaurants, onMapClick,
}: DinnerMapProps) {
  const b = TUSCANY_BOUNDS;
  const bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);

  return (
    <MapContainer
      bounds={bounds}
      minZoom={7}
      maxBounds={bounds.pad(0.05)}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />

      {selected &&
        participants.map((p) => (
          <Polyline
            key={`line-${p.id}`}
            positions={[[p.lat, p.lng], [selected.lat, selected.lng]]}
            pathOptions={{ color: colorOf(p.id), weight: 2, dashArray: "6 6", opacity: 0.8 }}
          />
        ))}

      {participants
        .filter((p) => !(p.id === myId && draft))
        .map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={dot(colorOf(p.id), p.name.charAt(0).toUpperCase())}>
            <Popup>
              <strong>{p.name}</strong>
              {p.id === myId && " (you)"}
            </Popup>
          </Marker>
        ))}

      {draft && (
        <Marker position={[draft.lat, draft.lng]} icon={dot(colorOf(myId), "?", 30)}>
          <Popup>Your new position — press “Save” to share it</Popup>
        </Marker>
      )}

      {idealPoint && (
        <Marker position={[idealPoint.lat, idealPoint.lng]} icon={idealIcon}>
          <Popup>Mathematical optimum</Popup>
        </Marker>
      )}

      {selected && (
        <>
          <Circle
            center={[selected.lat, selected.lng]}
            radius={1500}
            pathOptions={{ color: "#c0392b", fillOpacity: 0.06, weight: 1 }}
          />
          <Marker position={[selected.lat, selected.lng]} icon={starIcon} zIndexOffset={1000}>
            <Popup>
              <strong>{selected.name}</strong>
              <br />
              Total {selected.totalKm.toFixed(1)} km · longest {selected.maxKm.toFixed(1)} km
            </Popup>
          </Marker>
        </>
      )}

      {restaurants.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={forkIcon}>
          <Popup>
            <strong>{r.name}</strong>
            {r.cuisine && <><br />{r.cuisine}</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
