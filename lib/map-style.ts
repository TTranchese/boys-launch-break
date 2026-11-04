import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

/** Style real geographic features with the same palette as the planning UI. */
export function createMapStyle(): StyleSpecification {
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string) => tokens.getPropertyValue(`--color-${name}`).trim();
  const paper = color("paper"), ink = color("midnight");
  const name: ExpressionSpecification = ["coalesce", ["get", "name:latin"], ["get", "name"]];

  return {
    version: 8,
    name: "Cena in Toscana · Candy map",
    sources: {
      openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      { id: "land", type: "background", paint: { "background-color": color("daylight") } },
      {
        id: "greenery", type: "fill", source: "openmaptiles", "source-layer": "landcover",
        filter: ["in", "class", "wood", "grass"],
        paint: { "fill-color": color("grass"), "fill-opacity": 0.5 },
      },
      {
        id: "parks", type: "fill", source: "openmaptiles", "source-layer": "park",
        paint: { "fill-color": color("grass"), "fill-opacity": 0.65 },
      },
      {
        id: "neighbourhoods", type: "fill", source: "openmaptiles", "source-layer": "landuse",
        filter: ["in", "class", "residential", "commercial", "industrial"],
        paint: { "fill-color": color("pink"), "fill-opacity": 0.35 },
      },
      {
        id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
        paint: { "fill-color": color("sky") },
      },
      {
        id: "rivers", type: "line", source: "openmaptiles", "source-layer": "waterway",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color("sky"), "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 16, 5] },
      },
      {
        id: "buildings", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 13,
        paint: { "fill-color": color("pink"), "fill-opacity": 0.7 },
      },
      {
        id: "local-roads", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 10,
        filter: ["in", "class", "minor", "service", "tertiary", "secondary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": paper, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 7] },
      },
      {
        id: "main-road-casing", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": paper, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 10, 5, 16, 13] },
      },
      {
        id: "main-roads", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "class"], "motorway", color("tangerine"), color("sunshine")],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 2.5, 16, 9],
        },
      },
      {
        id: "country-boundaries", type: "line", source: "openmaptiles", "source-layer": "boundary",
        filter: ["==", "admin_level", 2],
        paint: { "line-color": ink, "line-opacity": 0.3, "line-width": 1, "line-dasharray": [3, 3] },
      },
      {
        id: "street-names", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 12 },
        paint: { "text-color": ink, "text-halo-color": paper, "text-halo-width": 2 },
      },
      {
        id: "town-names", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 7,
        filter: ["in", "class", "town", "village"],
        layout: {
          "text-field": name, "text-font": ["Noto Sans Bold"], "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 13, 16],
        },
        paint: { "text-color": ink, "text-halo-color": paper, "text-halo-width": 2 },
      },
      {
        id: "city-names", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 3,
        filter: ["==", "class", "city"],
        layout: {
          "text-field": name, "text-font": ["Noto Sans Bold"], "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 12, 8, 16, 13, 22],
        },
        paint: { "text-color": ink, "text-halo-color": paper, "text-halo-width": 2 },
      },
      {
        id: "country-names", type: "symbol", source: "openmaptiles", "source-layer": "place", maxzoom: 6,
        filter: ["==", "class", "country"],
        layout: { "text-field": name, "text-font": ["Noto Sans Bold"], "text-size": 16, "text-transform": "uppercase", "text-letter-spacing": 0.1 },
        paint: { "text-color": ink, "text-halo-color": paper, "text-halo-width": 2 },
      },
    ],
  };
}
