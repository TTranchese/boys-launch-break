"use client";

import { useState, type ReactNode } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Circle,
  InfoWindow,
  Map,
  Polyline,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import type { Participant } from "@/lib/db";
import type { Point, Suggestion } from "@/lib/geo";
import { TUSCANY_BOUNDS, TUSCANY_CENTER } from "@/lib/geo";
import type { Restaurant } from "@/lib/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
// Advanced markers need a Map ID; Google's DEMO_MAP_ID works for development.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

const BOUNDS: google.maps.LatLngBoundsLiteral = {
  south: TUSCANY_BOUNDS.south,
  west: TUSCANY_BOUNDS.west,
  north: TUSCANY_BOUNDS.north,
  east: TUSCANY_BOUNDS.east,
};

// Dashed line = invisible stroke + repeated dash symbol.
const dashedIcons = (color: string): google.maps.IconSequence[] => [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: color, scale: 2 },
    offset: "0",
    repeat: "12px",
  },
];

function Pin({ className, color, size, children }: { className?: string; color?: string; size?: number; children: ReactNode }) {
  return (
    <div
      className={`pin ${className ?? ""}`}
      style={{ background: color, width: size, height: size }}
    >
      {children}
    </div>
  );
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

type Info = { position: Point; content: ReactNode } | null;

export default function DinnerMap(props: DinnerMapProps) {
  if (!API_KEY) {
    return (
      <div className="map-loading">
        <p>
          Google Maps API key missing.
          <br />
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> and restart.
        </p>
      </div>
    );
  }
  return (
    <APIProvider apiKey={API_KEY} language="it" region="IT">
      <MapInner {...props} />
    </APIProvider>
  );
}

function MapInner({
  participants, colorOf, myId, draft, idealPoint, selected, restaurants, onMapClick,
}: DinnerMapProps) {
  const [info, setInfo] = useState<Info>(null);

  const handleClick = (e: MapMouseEvent) => {
    const ll = e.detail.latLng;
    if (!ll) return;
    e.stop(); // don't open Google's POI info window
    setInfo(null);
    onMapClick({ lat: ll.lat, lng: ll.lng });
  };

  const show = (position: Point, content: ReactNode) => setInfo({ position, content });

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={TUSCANY_CENTER}
      defaultBounds={BOUNDS}
      restriction={{ latLngBounds: BOUNDS, strictBounds: true }}
      minZoom={7}
      maxZoom={18}
      gestureHandling="greedy"
      mapTypeControl={false}
      streetViewControl={false}
      clickableIcons={false}
      onClick={handleClick}
      style={{ height: "100%", width: "100%" }}
    >
      {selected &&
        participants.map((p) => (
          <Polyline
            key={`line-${p.id}`}
            path={[{ lat: p.lat, lng: p.lng }, { lat: selected.lat, lng: selected.lng }]}
            strokeOpacity={0}
            icons={dashedIcons(colorOf(p.id))}
          />
        ))}

      {selected && (
        <Circle
          center={{ lat: selected.lat, lng: selected.lng }}
          radius={1500}
          strokeColor="#c0392b"
          strokeWeight={1}
          fillColor="#c0392b"
          fillOpacity={0.06}
          clickable={false}
        />
      )}

      {participants
        .filter((p) => !(p.id === myId && draft))
        .map((p) => (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            anchorLeft="-50%"
            anchorTop="-50%"
            zIndex={20}
            title={p.name}
            onClick={() => show(p, <><strong>{p.name}</strong>{p.id === myId && " (you)"}</>)}
          >
            <Pin color={colorOf(p.id)} size={28}>{p.name.charAt(0).toUpperCase()}</Pin>
          </AdvancedMarker>
        ))}

      {draft && (
        <AdvancedMarker position={draft} anchorLeft="-50%" anchorTop="-50%" zIndex={30} title="Your new position">
          <Pin color={colorOf(myId)} size={30}>?</Pin>
        </AdvancedMarker>
      )}

      {idealPoint && (
        <AdvancedMarker
          position={idealPoint}
          anchorLeft="-50%"
          anchorTop="-50%"
          zIndex={5}
          title="Mathematical optimum"
          onClick={() => show(idealPoint, "Mathematical optimum")}
        >
          <Pin className="pin-ideal">◎</Pin>
        </AdvancedMarker>
      )}

      {selected && (
        <AdvancedMarker
          position={{ lat: selected.lat, lng: selected.lng }}
          anchorLeft="-50%"
          anchorTop="-50%"
          zIndex={10}
          title={selected.name}
          onClick={() =>
            show(selected, (
              <>
                <strong>{selected.name}</strong>
                <br />
                Total {selected.totalKm.toFixed(1)} km · longest {selected.maxKm.toFixed(1)} km
              </>
            ))
          }
        >
          <Pin className="pin-star">★</Pin>
        </AdvancedMarker>
      )}

      {restaurants.map((r) => (
        <AdvancedMarker
          key={r.id}
          position={{ lat: r.lat, lng: r.lng }}
          anchorLeft="-50%"
          anchorTop="-50%"
          zIndex={8}
          title={r.name}
          onClick={() => show(r, <><strong>{r.name}</strong>{r.cuisine && <><br />{r.cuisine}</>}</>)}
        >
          <Pin className="pin-food">🍝</Pin>
        </AdvancedMarker>
      ))}

      {info && (
        <InfoWindow position={info.position} pixelOffset={[0, -14]} onCloseClick={() => setInfo(null)}>
          <div style={{ color: "#222" }}>{info.content}</div>
        </InfoWindow>
      )}
    </Map>
  );
}
