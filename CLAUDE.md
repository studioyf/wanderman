# WanderMan

A travel app for people who walk and shoot: plan loosely on the Mac, wander with it on the iPhone (offline),
come home with a journal that built itself. The Core lives in Terra (`terra-core read wanderman`); the
handover it was set up from is `docs/handover-to-terra.md`; Yvan's answers are `docs/ANSWERS.md`.
The feedback list is Terra's only, no Notion board (ANSWERS 4).

## Where things are
- `src/model.ts` the data (Trip, Area, Place, Day, Stop, Anchor, Note, CityGuide), `src/db.ts` the device's own
  database (Dexie over IndexedDB); every edit goes through `save()` / `remove()`, which mark rows for sync.
- `src/sync.ts` sync and sign-in (email and password, ANSWERS 5: Supabase will not send codes without our own mail service), `src/supabase.ts` the project's address and public key,
  `supabase/schema.sql` the server's one table `records` (one row per app row, per person, with row level security).
- `src/offline.ts` saves a trip's map for no signal (tiles z0 to 14 around its places, plus the map's symbols and
  lettering) into the `wm-map` cache, which the map reads itself through `src/mapcache.ts` (wm:// addresses); `src/mapstyle.ts` the OpenFreeMap positron style,
  kept on the device and tinted per look; `src/tiles.ts` the arithmetic.
- `src/looks.ts` + `src/app.css` the three daylight looks (Paper, Signal, Atlas), chosen in Settings.
- `src/pace.ts` pace is a per-person setting (ANSWERS 3): default 4 stops per half day, 2 free hours a day.
- `src/berlin.ts` the Berlin trip of 21 to 24 Nov 2026, from his Notion page, the test trip for every round.
- `test/e2e.mjs` the browser test (run with `terra-check`, never by hand); `npm test` the unit tests.

## Rounds
Round 1 skeleton (#370). Round 2 the day, 3 the preview card, 4 on the road, 5 after: see the handover.

## Hosting
Cloudflare Pages, built from GitHub `studioyf/wanderman` main: build `npm run build`, output `dist`.
