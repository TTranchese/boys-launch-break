# Cena in Toscana 🍷

Pin where everyone is in Tuscany, share the link, and find the best place to have dinner together.

## How it works

1. Open the app — a group is created and its id is put in the URL (`?g=...`).
2. Enter your name, click on the map (or "Use my location") and save.
3. Share the link with friends; they add their own positions. The page refreshes every 5 s.
4. Pick a strategy:
   - **Least total travel** — geometric median (Weiszfeld): minimizes the sum of everyone's distances.
   - **Fairest for everyone** — minimax (minimum enclosing circle): minimizes the longest trip.
5. The app ranks ~50 Tuscan towns by that metric and shows restaurants nearby from OpenStreetMap
   (Overpass API), with links to Google Maps.

Distances are straight-line (haversine), not driving times.

## Stack

- Next.js (App Router) + React, deployed on Vercel
- Leaflet / react-leaflet with OpenStreetMap tiles
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
| GET | `/api/groups/:groupId?strategy=total\|fair` | — returns participants + suggestions |
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
