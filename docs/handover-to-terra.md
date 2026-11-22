# Wander: Handover to Terra

Nov 22, 2026 · @Yvan

## Start here

Wander moves into Terra as a new app. Terra's first job: open the Wander conversation, set up its Core from this page, then run round 1.

**What Wander is:** a travel app for people who walk and shoot. Plan loosely on the Mac, wander with it on the iPhone (offline), and come home with a journal that built itself. Working title, kept.

**Where it stands, 22 Nov 2026:**

- Plan written and all twelve questions answered (14 Nov).
- A first web version was built on 15 Nov in a Claude cloud session, but never pushed: no repo, no Supabase project. Treat it as lost and rebuild; its README and choices are copied below.
- Berlin (21 to 24 Nov) was the field test, run with Notion and Apple Notes instead of the app. It produced five new ideas, now part of V1 below.

**Sources:**

- [Wander: Travel App Plan](https://claude.ai/artifact/TNk35AibAMvtPpB2nog5Bz): concept, full feature table V1 to V3, competitors, Berlin ideas. This handover wins where they differ.
- Notion [BERLIN NOV 2026](https://app.notion.com/p/41e2178a7d7181a8b2d0c18ef6e865ac): the real trip, good test data (hotel, museums, restaurants, days).
- Terra project folder: `~/Projects/Dev/Wander` (to create), GitHub `studioyf/wander` (private, to create).

## Core features

V1 is done when Yvan can take Wander on a real trip and leave Notion, Apple Notes and Google Maps lists at home. Rows marked Berlin come from the field test.

| Feature | What it does | From |
| --- | --- | --- |
| Trips | A trip has a city, dates, time zone, a base (hotel) and anchors | Plan |
| Anchors | Flights, trains, stays with times and the ticket PDF. The only timed things | Plan |
| Places and Inbox | Add by search, Google Maps link, long-press on the map, or a pasted list. Links with no location go to the Inbox | Plan |
| Flexible day | A day is a loose list: tick done; leftovers go to later, next time, or away. Moving one remaps the walk | Berlin |
| Pace | Free time by default, a warning when a day is overloaded, push or swap in one gesture and the day reflows | Berlin |
| Areas and walking order | Places grouped by neighbourhood from the start, suggested order from the base, warning when a far stop sits between two close ones | Plan + Berlin |
| Day on a map | Today's stops on one map, numbered in walking order, done and left shown | Berlin |
| Preview card | Tap any stop: photo, short text, today's hours, address, walking time, ticket or booking status, official website link, and done, later, remove, open in Maps | Berlin |
| City arrival guide | Airport to base, which ticket, how to pay, fines, useful apps, public transport between places | Berlin |
| Light per day | Sunrise, golden hour, sunset, blue hour | Plan |
| Quick notes | Text, photo or voice memo, stamped with time and place, linked to the stop you are at | Plan |
| Offline | App, data and the map around the trip's places work with no signal | Plan |
| Sync | Mac, iPad, iPhone through Supabase, local-first | Plan |
| Journal | Day by day: walk, notes, photos per place | Plan |
| Camera photo matching | Photos from a trip folder or Apple Photos placed on the map, by camera GPS or by timestamp | Plan, needs native or Mac side |

V2 and V3 (shared trips, share sheet, email import, social drafts, edit, book) stay in the plan doc's feature table.

## Essentials

Start as a web app installed on the home screen, the same route as Terra itself and the 15 Nov build. A native iPhone shell comes later, only for what the web cannot do.

| Part | Choice |
| --- | --- |
| App | Vite, React, TypeScript, installable web app with offline caching (Workbox) |
| Map | MapLibre with OpenFreeMap tiles, offline area saved per trip |
| Local data | IndexedDB through Dexie, the app works fully with no signal |
| Sync and accounts | Supabase, region Frankfurt: auth, Postgres, storage, row level security. Accounts from day one so sharing fits later |
| Place search | OpenStreetMap (Photon) first. Google Maps links are resolved by a small server function. Google Places only if OSM proves too weak |
| Light | SunCalc |
| Hosting | Vercel, or Terra's own hosting on the NAS if that is the studio default now |
| Directions | Links out to Google Maps or Apple Maps, nothing built |

**Data model:** Trip, Day, Area, Place, Stop (a place on a day, with order and state: planned, done, later, dropped), Anchor, Note, Track, Photo reference, City guide.

**What the web cannot do on iPhone:** GPS in the background, the share sheet, Apple Photos access. These wait for the native shell or a Mac-side helper.

## Behaviours

Seven rules decide every feature argument.

1. **Wander first.** Only anchors have times. Everything else floats. Never fill every hour: Berlin's hourly plan left no room to wander.
2. **Areas, not schedules.** A day is a neighbourhood with a suggested walk you are free to ignore.
3. **Change the day in one gesture.** Push, swap, drop: the rest reflows, nothing breaks.
4. **Offline is the default.** Sync is a bonus.
5. **Photos stay where they live.** References and thumbnails only; originals stay in Apple Photos, trip folders or Capture One.
6. **Capture in one tap.** Saving a place or a note costs less than a screenshot.
7. **iPhone in hand.** On-the-road screens are designed for the iPhone first; planning screens for Mac and iPad.

## First rounds

Each round ends with one version Yvan can try on the iPhone. Berlin is the test trip throughout.

1. **Round 0, brainstorm.** Settle the open points below with Yvan in the Wander conversation. No code.
2. **Round 1, skeleton.** Repo, Supabase project, data model, sign-in, installable on the iPhone. A trip with places on a map, working offline.
3. **Round 2, the day.** Flexible day, areas, walking order, day on a map, pace warnings. Test: replay Sunday 22 Nov in Berlin and push half the day.
4. **Round 3, the preview card.** Tap a stop: hours, link, walking time, done, later, open in Maps.
5. **Round 4, on the road.** Quick notes, light per day, anchors, city arrival guide (Berlin as the first city).
6. **Round 5, after.** Journal, then the first camera photo matching test with real photos.

## Still to brainstorm in Terra

Round 0 settles these. Until then, Terra takes the first option of each.

- [ ] **Web now, native later?** Web app first (assumed), or straight to a native iPhone app for background GPS and the share sheet.
- [ ] **Hosting:** Vercel (assumed), or Terra's NAS hosting.
- [ ] **Place data for the preview card:** OpenStreetMap plus the place's website (assumed), or Google Places for photos and hours (billed per request).
- [ ] **City arrival guide source:** written by Claude per city and checked by Yvan (assumed), or kept as a shared library of cities.
- [ ] **Pace rule:** how much free time per day by default, and what counts as overloaded (assumed: no more than 4 stops in a half day).
- [ ] **GPS track for the journal:** an existing tracker app imported (assumed) until the native shell exists.
- [ ] **Look:** reuse Terra's look A Studio, or a look of its own.

## Needed from Yvan before round 1

- [ ] Create the private GitHub repo `studioyf/wander` (empty, no README).
- [ ] Create the Supabase project `wander`, region Frankfurt, and give Terra its project ID.
- [ ] Open a Wander conversation in Terra and paste the link to this page.
