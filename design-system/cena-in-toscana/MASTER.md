# Cena in Toscana — design system

Status: v0.1 adopted token foundation. Direction: clean and neutral, selected by the product owner. The live app and isolated preview consume the same generated token stylesheet. Product behavior and group URLs remain unchanged.

## Product and principles

Help friends in Tuscany choose a place to meet by comparing actual driving times. This is a shared planning tool, with a map as supporting evidence and a ranked list as the accessible decision surface.

1. **Make the next action clear.** Add a position, invite friends, compare places, get directions. Give the current task one high-emphasis action.
2. **Keep the interface quiet.** Neutral surfaces, graphite text, deliberate spacing. Color identifies people or communicates feedback.
3. **Show the reason.** Explain ranking, distinguish estimates from calculated times, and show both total and longest drive.
4. **Make participation forgiving.** A nearby town is enough. Search always provides an alternative to geolocation and map clicks.
5. **Design every state.** Empty, pending, refreshing, successful, unavailable, and failed states are part of each component.

## Visual language

White panels on a cool off-white canvas; near-black primary actions; a restrained blue focus/selection accent. No decorative gradients, glass, warm rustic palette, food emoji controls, oversized marketing headers, or shadows on every card. One consistent SVG icon family, 20px, 2px strokes. Use text for categories where icons do not add meaning. Start with the system sans stack; no remote font dependency. An Inter substitution is optional only after font-loading and layout checks.

### Color roles

| Semantic role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | #f6f7f8 | #111315 | Page background |
| Surface | #ffffff | #1b1e22 | Cards, fields, dialogs |
| Subtle surface | #eef0f3 | #272c33 | Secondary controls, quiet grouping |
| Text | #191c20 | #f4f5f6 | Headings, names, values |
| Muted text | #5c6470 | #adb5c1 | Supporting copy; still readable |
| Divider | #dce0e5 | #414955 | Decorative boundaries only |
| Control border | #7b8491 | #8793a3 | Inputs and required control boundaries |
| Action / on action | #22262c / #ffffff | #eef0f3 / #191c20 | Primary CTA |
| Accent | #2458bd | #9bbcff | Focus, text links, selected indicator |
| Selected surface | #edf3ff | #1e304e | Selected place or option |
| Success / subtle | #23643b / #edf7ef | #9dd9ae / #182c20 | Saved status |
| Warning / subtle | #805300 / #fff6df | #f0cd7a / #302714 | Estimated times |
| Danger / subtle | #b32935 / #fff0f1 | #ffacb4 / #361e23 | Field errors, failed requests |

Colors are implemented in `tokens.scss`. Components consume semantic or component variables, never raw palette values. Dark mode remaps semantic roles; it is not a CSS inversion. Focus has a 3px outline with 3px offset. Muted text is not disabled text. Disabled controls use native disabled semantics, explicit styling, and nearby explanation where the reason is not obvious.

### Typography

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 40 / 48 | 600 | Design-system presentation only |
| Page title | 28 / 36 | 600 | App title or task title |
| Section title | 20 / 28 | 600 | Group, results, position |
| Body | 16 / 24 | 400 | Inputs, descriptions, primary content |
| Label | 14 / 20 | 600 | Buttons, field labels |
| Supporting | 14 / 20 | 400 | Metadata, validation, helper text |
| Caption | 12 / 16 | 500 | Nonessential annotations only |

Use rem equivalents in implementation. Allow zoom and text enlargement. Names and addresses wrap; never shrink important text to fit. Keep prose below 65 characters per line. Use tabular numerals for durations and distances. Heading tracking may be -0.02em; body keeps normal spacing.

### Geometry and motion

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Use 8px between related controls, 16px within groups, 24px card padding, 32px between sections. A 4px exception supports tight label/helper relationships. Radius: 6px small, 10px controls, 14px panels, full only for badges and avatars. Use a 1px divider, 2px selected border, and one overlay shadow for menus/dialogs. Ordinary cards have no shadow.

Control minimum height 44px; comfortable controls 48px. The project adopts 44×44 CSS px targets for touch friendliness, including map buttons. At least 8px between neighboring actions. Motion: 120ms feedback, 180ms surface/state changes, 240ms overlay entrance, 160ms exit. Animate color/opacity/transform, not layout dimensions. Reduced motion removes movement, smooth map flights, and animated loading; loading text remains.

## Tokens and ownership

`tokens.scss` is the canonical browser-compatible SCSS source. Its CSS-only syntax lets the existing Next.js stack consume it without adding Sass. `preview.scss` and `app.scss` use the same convention. Run `npm run design-system:build` to generate the shared public token stylesheet, preview CSS, and `app/globals.css`. This also runs automatically before development and production builds. Run `npm run design-system:check` to check generated-file drift and light/dark contrast pairs (the contrast check requires Python 3). Do not edit generated CSS.

The generator resolves breakpoint variables in media queries at build time because browser media queries cannot resolve CSS custom properties. It also derives the system dark-theme media query from the explicit dark token block, avoiding a second palette. Both app and preview follow the OS theme when no `data-theme` attribute is set; explicit light/dark attributes override it. When editing sources during an already-running dev session, rerun `npm run design-system:build` for hot reload.

Layout declarations such as `0`, `100%`, `1fr`, grid placement, and transforms remain structural CSS. Design decisions (color, type, spacing, radius, control sizes, layout breakpoint, route widths, layers, and animation timing) live in tokens. Map zoom levels, geographic bounds and polling intervals are behavior settings, not visual tokens. Third-party Leaflet base styles remain vendor-owned; app-facing chrome is themed through semantic overrides.

Layers: `--neutral-*` and size values are primitives; `--color-*` are theme-specific semantic roles; `--button-*`, `--field-*`, `--panel-*` are component aliases. Resolve changes at the lowest shared layer. Do not add a new value for each screen. A documented page override may be added under `pages/` only when a real requirement differs from this master.

## Component contracts

| Component | Anatomy and behavior | Required states |
| --- | --- | --- |
| Button | Verb-led text; optional decorative SVG; primary graphite, secondary subtle, tertiary text; 44px minimum | Default, hover, pressed, focus-visible, disabled, busy with specific label; reserve busy width |
| Field | Visible label, input, helper/error linked by aria-describedby; validate on blur or submit | Empty, filled, hover, focus, invalid via aria-invalid, read-only, disabled |
| Position picker | Name + location search + explicit search action; current location secondary; selected location summary; save action | No position, searching, no matches, unsaved draft, saving, saved, permission denied, search unavailable |
| Search results | Submit-based search with a list of native result buttons; keep full address available | Loading, results, empty, failure; if later changed to autocomplete, implement the full combobox keyboard contract |
| Strategy choice | Native radio group in a fieldset; two options with shared explanation; arrow keys select | Least total driving, fairest drive, focus, unavailable with explanation |
| Participant row | Initial/name, “you” text when relevant, matching map identity, drive duration | Saved, own draft, missing route; never rely on color alone |
| Place option | Native radio within a labeled choice group; rank, name, category/town, total + longest drive | Default, hover, focus, selected, refreshing; best-ranked and user-selected are separate concepts |
| Selected place | Name, available metadata, participant journey breakdown, directions primary | Routes pending, ready, partial failure, estimated times; external details clearly labeled |
| Badge | Short text, optional icon; no interactive styling for plain status | Saved, estimated, updating; full labels wrap |
| Inline message | Icon + cause + recovery; errors near affected task; warning never implies failure | Informational, success, warning, danger |
| Shared header | Name, compact purpose, invite and new-group actions; contextual copy confirmation | Link ready, copied, share unavailable, copy failed |
| Dialog | Only for a consequential action that needs a decision; clear title, close/cancel | Keyboard trap, Escape, focus restored to trigger, background inert |

Primary action progression: before joining, **Save my position**; after joining, **Invite friends**; after selecting a place, **Get directions**. Keep update/search actions subordinate once they are no longer the main task. Starting a new group navigates to a new link; do not label it as deleting the old group. Venue selection changes the preview only; do not imply a booking or confirmed group agreement.

## Map language

Person: circular initial/name marker. Draft: dashed ring plus “Unsaved” label. Venue: numbered pin matching list rank. Selected venue: same number with selected halo, not an unrelated trophy. The ranking algorithm's ideal point stays hidden by default or appears only under an explicitly labeled explanation; it is not a venue.

People use a stable ID → identity mapping shared by marker, route and row. Preserve identity across polling and result reordering. Supplement the ten repeating hues with visible names/initials and route labels; never promise color alone is unique. Selected routes need a contrasting under-stroke on varied map tiles. Dashed straight lines mean “route unavailable / approximate connection”, not a calculated road route. Label estimates in list and detail surfaces. The selected venue must stay distinguishable from each participant and keyboard focus.

Map panning is optional. Every venue is selectable from the list, and every location can be entered through search. Keep zoom controls and attribution visible above fixed UI. Map colors and overlays require testing on real tiles in both themes; the schematic in the preview demonstrates identity only and is not a production basemap.

## Responsive composition

| Viewport | Layout |
| --- | --- |
| Below 768px | Single document scroll; location, group, strategy/results in task order; a map section around 280–360px tall; no required nested scrolling or draggable sheet |
| 768–1023px | Same document flow, wider panels; optional map beside selected-place detail only if readable |
| 1024px and above | 400px planning column and flexible map; map can be sticky; panel and page use one intentional scroll context |

Page gutters: 16px phone, 24px tablet, 32px desktop. Documentation max width 1200px; production map workspace may fill the viewport. Do not compress the planning column below readable width. Wrap action groups and strategy descriptions. Use min-width: 0 for grid/flex children and overflow-wrap: anywhere for user-supplied names or addresses. Reserve map/loading height. If a sticky CTA is later added, reserve its full height plus safe-area inset in the content.

## Content and feedback

Use the existing English UI consistently until localization is implemented; keep the product name Cena in Toscana. Friendly, practical copy, short sentences, no technical service names in primary errors.

| Situation | Example |
| --- | --- |
| Location helper | A nearby town is enough. You don’t need to share your address. |
| Unsaved position | Position set to Empoli. Save it to share with the group. |
| Empty group | Add your position, then invite friends with this link. |
| One participant | Showing places near you. Invite friends to compare everyone’s drive. |
| Total strategy | Minimize everyone’s combined driving time. |
| Fair strategy | Minimize the longest individual drive. |
| Initial calculation | Finding places and comparing drive times… |
| Refresh | Updating drive times… Keep old results visible and label them as updating. |
| Estimated routing | Drive times are estimates. Road routing is temporarily unavailable. |
| Search failure | Location search is unavailable. Try again or choose a point on the map. |
| Save failure | Your position wasn’t saved. Check your connection and try again. |

Do not announce the five-second poll repeatedly. Announce meaningful changes in a polite status region; only announce an error once when it appears. Do not move focus on polling, ranking refresh, or result selection. After failed submission, focus the first invalid field, or a linked error summary when there are multiple errors. Preserve typed values on failure.

## Adoption and acceptance

1. Adopted: import shared tokens through `app/layout.tsx`; global app styles generate from `app.scss`. The previous palette has been removed. Map markers and SVG routes use shared participant tokens, CSS-owned sizing, and reduced-motion-aware timing.
2. Extract Button, Field, InlineMessage, StrategyChoice, ParticipantRow, and PlaceOption primitives from the current DinnerApp markup. Keep API, ranking, group URLs, and storage behavior intact.
3. Apply location/group layout, then ranked-list/detail layout, then map markers/routes. Replace emoji UI controls with consistent SVGs.
4. Implement semantic radio groups, correct field labels (avoid a label wrapping a form), contextual error/status regions, and keyboard selection. Respect reduced-motion in Leaflet flyTo/flyToBounds.
5. Validate at 375px, 768px, 1024px, 1440px, phone landscape, 200% zoom, long names/addresses, keyboard-only use, and both themes. Test empty, one-person, multi-person, loading, stale, failure, no-result, and estimate cases.

Acceptance: text pairs ≥4.5:1, meaningful control boundaries ≥3:1, visible unobscured focus, no color-only status, no horizontal document overflow, no blocked zoom, reduced-motion respected, map usable without pointer precision. The build script checks declared palette pairs; it does not certify the future app's composed UI or real map tiles.

## Decision record

The ui-ux-pro-max searches verified Minimalism & Swiss Style and a neutral sans hierarchy as relevant. Generated fashion colors, marketing hero structure, and childlike typography were rejected as mismatches. This tailored specification is the source of truth, not unverified generated search output. Dark tokens are specified now to prevent incompatible component colors; shipping a production theme toggle remains a separate product decision. The interactive preview uses fictional venues and participants and makes no live service calls.
