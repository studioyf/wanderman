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
- The trip screen (`src/screens/TripScreen.tsx`, ANSWERS 8, drawn in `docs/design/layouts-1.html`): on the phone
  layout A (full map, `parts/Sheet.tsx` pulled up or down, tabs Today, Places, Trip, Notes); from 900 px wide
  layout M (sidebar of days, the day or To pick from in the middle, the map with the card floating over it).
  `parts/DayView.tsx` a day (drag by the handle to reorder, swipe right Done, left Later, Tidy), `parts/StopCard.tsx`
  a place opened, `parts/FindNearby.tsx` "a pizzeria near this stop" (Photon within ~800 m, plus a Google Maps
  search link), `parts/PickList.tsx` what is saved and on no day. `src/plan.ts` the day's arithmetic (legs, pace,
  detours, Tidy: timed stops keep their order, the rest go where they add least walking; a far meal is swapped for a
  saved one near the walk; over pace, stops whose note says drop go first), `src/actions.ts` every change to the days.
- `test/e2e.mjs` the browser test (run with `terra-check`, never by hand); `npm test` the unit tests.

## Rounds
Round 1 skeleton (#370, kept). Design pass with round 2's day folded in (#373), find nearby (#374). Then 3 the preview card (photo, today's hours), 4 on the road, 5 after: see the handover.

## Hosting
Cloudflare Worker `wanderman` serving the built app (`wrangler.jsonc`), built by Cloudflare from GitHub main on every push (Workers Builds): https://wanderman.verso-cloud.workers.dev (ANSWERS 6). Check the live `index-*.js` matches a local build before calling a round built.
