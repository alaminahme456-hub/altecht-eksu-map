# ALTECH EKSU Campus Map

A mobile-first, interactive 2D campus map for **Ekiti State University (EKSU), Ado-Ekiti** — built to receive **real, GPS-verified campus data** as field surveys progress. It pairs a public map interface with an administrator data-collection dashboard, connected to a single live database.

> **Data honesty first:** no building is ever placed at a made-up position. Every feature is stored with the exact GPS coordinates collected for it, unverified records are clearly labelled, and sample/demo records are marked as such so they can never be mistaken for surveyed ground truth.

## Features

### Public campus map (`/#/`)
- Interactive **Leaflet + OpenStreetMap** map: zoom, pan and full mobile touch gestures
- Campus features rendered as **point markers, polygon outlines (buildings) and polylines (roads/paths)** — always from real coordinates
- **Search** locations by name and **filter** by any of the 13 campus categories
- Tap a feature for its **name, category, description, photos** and verification status
- Optional **user geolocation** (shown only after the user grants permission)
- Distance display between points where relevant, preparing the ground for walking navigation

### Administrator dashboard (`/#/admin`)
Password-protected data-collection console for the survey team:
- Add, edit and delete locations; enter **name, latitude/longitude, category, description**
- Capture **polygons** (building outlines) and **polylines** (roads/pathways) vertex-by-vertex on the map picker
- Upload **photos** directly to the app (stored under `/public/uploads`)
- **Draft / verified workflow** — only explicitly verified records present themselves as confirmed
- **Quality checks** — probable duplicate records and suspicious coordinates (invalid values, null island, outside the EKSU survey envelope) are flagged automatically
- **One-click GeoJSON export / import** for progressive data collection in the field
- Load demo sample data with one click (marked `source: sample`, `status: draft`)

### The 13 campus categories
Faculties · Departments · Lecture halls · Laboratories · Libraries · Administrative buildings · Hostels · Cafeterias · Health facilities · Sports facilities · Entrances and gates · Roads and pathways · Other campus facilities

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + React + TypeScript |
| Map | Leaflet + OpenStreetMap raster tiles |
| Geometry | GeoJSON (WGS84 / EPSG:4326) |
| Database | Supabase PostgreSQL + Prisma ORM + PostGIS |
| UI | Tailwind CSS + shadcn/ui, mobile-first |

## Getting started

```bash
# 1. install dependencies (bun or npm both work)
bun install

# 2. configure environment
cp .env.example .env        # then edit values as needed

# 3. create the database schema
bun run db:push

# 4. (optional) load demo sample data — clearly marked, never "verified"
bunx tsx scripts/seed.ts

# 5. run the dev server
bun run dev                 # http://localhost:3000
```

Open **`/#/`** for the public map and **`/#/admin`** for the data-collection dashboard. The default admin password is a demo value (`see src/lib/auth.ts`); set a strong `ADMIN_PASSWORD` in `.env` before any real deployment.

## API overview

| Method & path | Purpose |
| --- | --- |
| `GET /api/locations` | List/filter/search locations (public) |
| `POST /api/locations` | Create a location (admin) |
| `GET/PATCH/DELETE /api/locations/:id` | Read, update, delete one location (admin) |
| `POST /api/locations/:id/photos` | Upload photos for a location (admin) |
| `GET /api/geojson` | Export the whole campus as a GeoJSON FeatureCollection |
| `POST /api/geojson` | Import GeoJSON; original coordinates preserved, duplicates flagged |
| `GET /api/quality` | Duplicate-pair & suspicious-coordinate report |
| `POST /api/admin/sample-data` | Load demo sample records |

## Supabase database setup\n\nThe production database is the Supabase project `gsvnefxrxexdyptknsjh`. Configure `DATABASE_URL` and `DIRECT_URL` using the project's PostgreSQL connection details before running Prisma commands. The `Location` and `Photo` tables, PostGIS extension, RLS policies, and public `campus-photos` bucket are provisioned by `supabase/migrations/20261106154000_create_eksu_campus_mapping_schema.sql`. Never commit database passwords or Supabase secret keys.\n\n## Data accuracy policy

1. **Never invent geography.** Locations only exist where real GPS data puts them; nothing is randomly placed or assumed relative to other buildings.
2. **Coordinate fidelity.** Import/export never rounds, re-projects or reorders coordinates — `coordinates` stores the original captured vertices exactly as collected.
3. **Verification is explicit.** Records start as `draft` (rendered with a visible "unverified" treatment) and only become `verified` through the admin dashboard.
4. **Continuous quality control.** Duplicate detection and suspicious-coordinate checks run on demand via `/api/quality`.
5. **Progressive collection.** New field data can be added (individually or by GeoJSON import) at any time without rebuilding the map.

## Project structure

```
src/
  app/                 # Next.js App Router: page shell + REST API routes
  components/
    CampusMapApp.tsx   # public map experience
    map/MapCore.tsx    # Leaflet map core
    admin/             # dashboard: form, map picker, photos, import/export, quality
  lib/                 # auth, categories, geo utils, validation, sample data
prisma/schema.prisma   # Location + Photo data model
scripts/seed.ts        # idempotent sample-data seeder
```

## Roadmap (Phase 1)

1. ✅ 2D illustrated map interface (zoom, pan, touch gestures)
2. ✅ Administrator data-collection dashboard
3. ✅ Dashboard ↔ map wiring (single shared database)
4. ✅ GeoJSON import/export
5. ✅ Search & category filtering
6. ◐ Walking-path data capture (polylines ready for route graph / navigation)
7. ◐ Testing on Android, iPhone and desktop

## License & attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Campus data belongs to the ALTECH EKSU survey team.
