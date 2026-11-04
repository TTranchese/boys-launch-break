# Cena in Toscana — design system

Status: v0.2. Adapted to the Toca Boca reference captured in the root
`DESIGN.md`. The app and interactive preview share generated tokens.

## Direction

A white canvas with inset candy-colour slabs, chunky sans-serif headings,
Midnight Mouth pill controls, and one playful utensil sticker beside the
app name. Flat colour supplies the hierarchy: ordinary panels and controls
have no visible borders or drop shadows. Keep the product focused on helping
friends compare journeys and choose dinner together.

The supplied reference is an HTML export despite its Markdown filename. Its
Toca Boca design summary and palette are the reference; the surrounding
GradientDeck website chrome is not part of the app design.

## Palette

| Token | Colour | Use |
| --- | --- | --- |
| Paper | #ffffff | Page, fields, place options |
| Midnight Mouth | #101014 | Headings, controls, focus, map labels |
| Sky Blue | #59acff | Position section |
| Grass Green | #62d962 | Participants section |
| Bubblegum Pink | #ff8cbc | Dinner suggestions and brand sticker |
| Tangerine | #ff7040 | Reserved accent, demonstrated in the palette |
| Sunshine Yellow | #ffe359 | Selected options and estimates |
| Daylight | #f2f2ff | Pill labels, participant rows, floating results |
| Ink | #0a0a0a | Pressed primary controls |

Supporting text uses #303038 for readable contrast on every colour slab.
Error text uses #76152f on pink. Participant colours remain darker identity
colours so map routes and initials stay distinguishable and readable on
white. These functional colours supplement the nine reference colours.

The reference specifies a light theme. Both app and preview retain that
appearance regardless of OS preference; there is no alternate dark palette.
Both documents declare `color-scheme: only light` in CSS and initial HTML
metadata to prevent native controls or browser auto-darkening from mixing
appearances. The document root carries `data-theme="light"`.

## Typography

Headings, map pins, and participant avatars use self-hosted Bricolage
Grotesque (SIL Open Font License 1.1, licence at
`public/fonts/bricolage-grotesque/OFL.txt`) with Arial Black / Arial Rounded
MT Bold / Arial as loading fallbacks. The latin-subset variable file
`public/fonts/bricolage-grotesque/BricolageGrotesque-latin-wght.woff2`
supports weights 200–800; titles use `--weight-title: 800` with -3% tracking.
Shared `fonts.scss`
generates `public/design-system/fonts.css` for both app and preview;
`font-display: swap` keeps text visible while the font loads, and both
pages preload the same asset. Body copy requests Inter and falls back to
the system sans stack. The UI has no third-party font-service requests.

App title: 48px desktop, 32px mobile, 800 weight, 1 line height, -3% tracking.
Section headings: 28px. Body and fields: 16px. Labels and metadata: 14px.
The preview can use larger fluid display type. Keep important text wrapping
and use tabular numerals for journey times.

## Geometry and interaction

Use 32px panel radii, 24px field/option radii, and fully rounded pill buttons.
The spacing scale remains 4, 8, 12, 16, 24, 32, 48, 64px. Cards use 24px
padding. Controls have a minimum height of 48px. Small screens stack location
actions when their labels cannot fit comfortably beside each other.

The desktop planning column is 460px. The map is sticky, inset by 16px,
and clipped to a 32px radius. Below 1024px the map and native scroll-snap
sheet retain their existing three detents. The sheet measures its header to
keep the collapsed content visible as text wraps or scales.

Selected places and radio choices use Sunshine Yellow. Selected place
buttons expose aria-pressed, and strategy options remain native radios.
Keep a 3px visible focus outline with 3px offset. White map marker rings, route
casings, and the dashed draft pin remain functional geographic identifiers;
they are exceptions to the borderless surface treatment. Loading text,
errors, and initials communicate meaning alongside colour.

Buttons use 120ms colour feedback. Map movement respects reduced motion;
spinners stop rotating while their loading text remains. Search results
float outside document flow on an opaque Daylight surface with no shadow,
wrap long addresses, and dismiss on Escape, outside press, or focus exit.

## Source ownership and checks

Edit `tokens.scss`, `fonts.scss`, `app.scss`, and `preview.scss` in this directory.
These use browser-compatible SCSS syntax without requiring a Sass runtime.
`build.mjs` generates `public/design-system/tokens.css`,
`public/design-system/preview.css`, and `app/globals.css`. Do not edit generated
CSS directly. Run `npm run design-system:build` after changing a source in an
already-running development session. Dev and production builds regenerate
styles automatically.

`npm run design-system:check` checks generated-file drift and 53 contrast
pairs, including primary and supporting text on all five candy colours.
`npm run typecheck` checks the app. Inspect the live UI at phone and desktop
widths and the isolated preview at `/design-system/index.html`.

Colours, dimensions, timing, and typography in app styles consume tokens.
The generator resolves the media-query breakpoint at build time, since CSS
custom properties do not work in media queries. Participant colour aliases
and the measured sheet peek height remain runtime values.

## Product contracts

The design adaptation preserves group links, saved positions, search,
geolocation, map picking, participant identity, ranking strategies, route
estimates, directions, and error/retry states. Search remains submit based
with native result buttons. Initials identify people, numbers identify venues,
and dashed routes distinguish approximate journeys. The interactive design
preview uses illustrative data and does not share locations or open real
directions.

## Basemap

The basemap uses MapLibre GL through the official Leaflet binding and
[OpenFreeMap vector tiles](https://openfreemap.org/quick_start/). Its original
15-layer style lives in `lib/map-style.ts` and resolves the shared CSS palette
at map creation: Sky Blue water, green parks and woodland, pink settlements
and buildings, yellow primary roads, orange motorways, and Midnight labels.
Place and street labels use OpenFreeMap's Noto Sans glyph service. Labels have
Paper halos for legibility; there are no terrain textures or POI sprites.

Participant pins and list avatars share solid identity colours and light
initials. Numbered venues are yellow, the selected venue is orange, and the
optimum/draft markers are pink. Popups use rounded Daylight surfaces.

Tuscany is only the initial viewport. There are no geographic pan bounds,
regional outline, or exterior fade mask. Users can zoom out to level 2 and
pan anywhere. Selecting a venue or placing an offscreen draft can focus that
specific action; polling does not recenter an unchanged selection. The
“Show everyone” button explicitly fits participants, the selected venue, and
any draft pin. Existing Tuscany position validation and restaurant search
scope remain product rules, independent of free map navigation.

`npm run map:prepare` copies the installed MapLibre worker and license into
ignored `public/maplibre/` assets before development and production builds.
The worker is served from the app origin with a package-version query to
avoid stale caches and bundler-specific worker resolution. MapLibre requires
WebGL2. Provider, data, and route attributions stay visible on the map.
