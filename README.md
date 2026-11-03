# Cena in Toscana 🍷

Pin where everyone is in Tuscany, share the link, and find the best place to have dinner together.

## How it works

1. Open the app — a group is created and its id is put in the URL (`?g=...`).
2. Enter your name, click on the map (or "Use my location") and save.
3. Share the link with friends; they add their own positions. The page refreshes every 5 s.
4. Pick a strategy:
   - **Least total driving** — the place where everyone's driving times add up to the least.
   - **Fairest drive** — the place where the longest drive is as short as possible.
5. The app suggests real **restaurants, bars and pubs** ranked by **driving time by car**, draws
   everyone's road route to the selected place, and links to Google Maps for directions and reviews.

### How places are found

1. Straight-line optima (geometric median and minimax centre) plus the best-scoring Tuscan towns are
   used as search areas.
2. Restaurants/bars/pubs around each area are fetched from OpenStreetMap (Overpass API).
3. Driving times from everyone to every candidate come from one OSRM table request (car profile),
   and candidates are ranked by total or longest drive.

Results are cached in memory for 15 minutes so friends polling the same group don't hit the free
services repeatedly. If the router is down, times fall back to an estimate (shown with a warning).
`OSRM_URL` and `OVERPASS_URL` env vars can point to other (e.g. self-hosted) instances.

## Stack

- Next.js (App Router) + React, deployed on Vercel
- Leaflet / react-leaflet with OpenStreetMap tiles
- Free, keyless services: OSRM (driving times & routes), Overpass (restaurants), Nominatim (search)
- **In-memory SQL database**: [AlaSQL](https://github.com/AlaSQL/alasql) (`lib/db.ts`)

### About the in-memory database on Vercel

The database lives in the memory of the serverless function instance. Data survives while the
instance stays warm but is **lost on cold starts and redeploys**, and two concurrent instances
don't share data. To soften this, each browser remembers its own position in `localStorage` and
re-publishes it automatically if the server forgot it. For durable storage, replace `lib/db.ts`
with Vercel Postgres / Neon / Turso — the rest of the app only uses its three functions.

## API

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/groups/:groupId` | — returns participants |
| GET | `/api/groups/:groupId/dinner?strategy=total\|fair` | — places ranked by driving time |
| GET | `/api/groups/:groupId/routes?lat=&lng=` | — road routes from everyone to a place |
| PUT | `/api/groups/:groupId/participants/:participantId` | `{ name, lat, lng }` |
| DELETE | `/api/groups/:groupId/participants/:participantId` | — |

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy to Vercel

Import this repo at https://vercel.com/new (framework preset: Next.js, no env vars needed),
or run `npx vercel` from the project folder.
