import { db, getMeta, setMeta } from './db';
import type { Trip, Area, Place, Day, Stop, Anchor, CityGuide, PlaceKind, StopState } from './model';

// The Berlin trip of 21 to 24 Nov 2026, from Yvan's Notion page, as the test trip for every round.
// Fixed ids, so loading it on the Mac and on the iPhone gives the same trip once synced, not two.
const id = (n: number) => `0b3e1100-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const BERLIN_ID = id(1);
// Raised whenever the trip below changes, so a phone that already holds Berlin takes the new version.
// 2: the trip as it went (Yvan, 22 Nov 2026): Sat and Sun done, Mon re-planned.
export const BERLIN_VERSION = 2;

const areas: [number, string, string][] = [
  [10, 'Charlottenburg', '#d9411e'],
  [11, 'Tiergarten and Kulturforum', '#2f6b4f'],
  [12, 'Mitte', '#1f4fb4'],
  [13, 'Kreuzberg', '#b07a12'],
  [14, 'Schöneberg', '#7a3e8f'],
  [15, 'Airport', '#6b6b6b'],
  [16, 'Neukölln', '#0f7c86'],
];

type P = [n: number, area: number, name: string, kind: PlaceKind, lat: number, lng: number, address?: string, extra?: Partial<Place>];
const places: P[] = [
  [100, 10, 'The Hoxton, Charlottenburg', 'stay', 52.5016, 13.3298, 'Meinekestraße 18-19, 10719 Berlin', { note: 'Check-in from 14:00, check-out 11:00. +49 30 2332 18460', url: 'https://thehoxton.com/berlin/charlottenburg/hotels/' }],
  [101, 15, 'BER Airport', 'transport', 52.3667, 13.5033, 'Willy-Brandt-Platz, 12529 Schönefeld'],
  [102, 10, 'Zoologischer Garten station', 'transport', 52.5069, 13.3324, 'Hardenbergplatz, 10623 Berlin', { note: 'RE8 or RB23 to and from BER, about 35 min, no change' }],
  [103, 10, 'Breitscheidplatz Christmas market', 'market', 52.5050, 13.3355, 'Breitscheidplatz, 10789 Berlin'],
  [104, 12, 'Cookies Cream', 'food', 52.5157, 13.3880, 'Behrenstraße 55, 10117 Berlin', { note: 'Vegetarian, Michelin star. Entrance through the backyard of the Westin Grand, ring the bell, upstairs.', url: 'https://cookiescream.com' }],
  [105, 12, 'Torstraße and Mulackstraße', 'drink', 52.5283, 13.4040, 'Mulackstraße, 10119 Berlin', { note: 'Bars, the more fashion crowd' }],
  [106, 11, 'Neue Nationalgalerie', 'museum', 52.5069, 13.3675, 'Potsdamer Straße 50, 10785 Berlin', { note: 'Maurizio Cattelan, NIGHT. Ruin and Rush, Berlin 1910 to 1930 (until 3 Jan)', url: 'https://www.smb.museum/en/museums-institutions/neue-nationalgalerie/' }],
  [107, 11, 'Kunstgewerbemuseum', 'museum', 52.5098, 13.3678, 'Matthäikirchplatz, 10785 Berlin', { note: 'Fashion gallery, Verner Panton show. Closed Mon and Tue.' }],
  [108, 11, 'Saravanaa Bhavan', 'food', 52.5091, 13.3735, 'Potsdamer Platz, 10785 Berlin', { note: 'South Indian vegetarian, daily' }],
  [109, 12, 'Holocaust Memorial', 'sight', 52.5139, 13.3787, 'Cora-Berliner-Straße 1, 10117 Berlin'],
  [110, 12, 'Brandenburg Gate', 'sight', 52.5163, 13.3777, 'Pariser Platz, 10117 Berlin'],
  [111, 12, 'Reichstag dome', 'sight', 52.5186, 13.3762, 'Platz der Republik 1, 11011 Berlin', { note: 'Booked 15:30. Bring ID.', url: 'https://www.bundestag.de/en/visitthebundestag/dome/registration-245686' }],
  [112, 12, 'Hamburger Bahnhof', 'museum', 52.5284, 13.3721, 'Invalidenstraße 50-51, 10557 Berlin', { note: 'Sophie Calle. Open till 18:00.' }],
  [113, 12, 'FREA', 'food', 52.5287, 13.3989, 'Torstraße 180, 10115 Berlin', { note: 'Vegan, zero waste, Michelin Green Star. Daily from 17:30, 2-hour tables.' }],
  [114, 14, 'Bonvivant', 'food', 52.4935, 13.3530, 'Goltzstraße 32, 10781 Berlin', { note: 'Vegetarian and vegan, Michelin star, cocktails. +49 176 61722602' }],
  [115, 13, 'Happa', 'food', 52.4975, 13.4475, 'Schlesische Straße 35A, 10997 Berlin', { note: 'Vegan, 5-course menu Saturday. Closed Sun and Mon.' }],
  [116, 10, 'Vegang', 'food', 52.5063, 13.3166, 'Kantstraße 33, 10625 Berlin', { note: 'Vegan Vietnamese, daily, near the hotel' }],
  [117, 10, 'C/O Berlin', 'museum', 52.5070, 13.3328, 'Hardenbergstraße 22-24, 10623 Berlin', { note: 'Carrie Mae Weems retrospective. Daily 11:00 to 20:00, €15. Next to the hotel, an easy next trip.' }],
  [118, 13, 'Gropius Bau', 'museum', 52.5066, 13.3817, 'Niederkirchnerstraße 7, 10963 Berlin', { note: 'Gabriele Stötzer (East German artist, photography, performance, until 6 Dec), Kreuzberg: Art and Migration, Christoph Schlingensief. Open 12:00 to 19:00.' }],
  [119, 13, 'Topographie des Terrors', 'museum', 52.5067, 13.3838, 'Niederkirchnerstraße 8, 10963 Berlin'],
  [120, 13, 'Checkpoint Charlie', 'sight', 52.5075, 13.3904, 'Friedrichstraße 43-45, 10117 Berlin'],
  [121, 13, 'Vegup', 'food', 52.4980, 13.3830, 'Möckernstraße 48, 10965 Berlin'],
  [122, 13, "Lia's Kitchen", 'food', 52.4900, 13.4130, 'Urbanstraße 32, 10967 Berlin', { note: 'Vegan burgers' }],
  [123, 13, 'Berlinische Galerie', 'museum', 52.5032, 13.3988, 'Alte Jakobstraße 124-128, 10969 Berlin', { note: 'Lovis Corinth. Open till 18:00.' }],
  [124, 12, 'Museum Island and Berliner Dom', 'walk', 52.5190, 13.4010, 'Am Lustgarten, 10178 Berlin', { note: 'Outside only on Monday. Pergamon closed until mid-2027.' }],
  [125, 12, 'Gendarmenmarkt Christmas market', 'market', 52.5137, 13.3927, 'Gendarmenmarkt, 10117 Berlin', { note: 'Opening day Mon 23' }],
  [132, 11, 'Rocket + Basil', 'food', 52.50305, 13.36655, 'Lützowstraße 22, 10785 Berlin'],
  [133, 11, 'Kulturforum', 'sight', 52.50932, 13.37131, 'Potsdamer Straße, 10785 Berlin'],
  [134, 12, 'Berlin Wall Memorial', 'sight', 52.53582, 13.39085, 'Bernauer Straße 111, 13355 Berlin', { note: 'Outdoor grounds open and free: original wall, watchtower, death strip. Indoor centre and tower closed on Mondays. About 1h. U8 Bernauer Straße or S-Bahn Nordbahnhof.' }],
  [135, 16, 'Gazzo', 'food', 52.49121, 13.42588, 'Hobrechtstraße 57, 12047 Berlin'],
  [126, 11, 'Gemäldegalerie', 'museum', 52.5085, 13.3650, 'Matthäikirchplatz, 10785 Berlin', { note: 'Old masters. The alternative to Hamburger Bahnhof.' }],
];

const days: [number, string, string][] = [
  [200, '2026-11-21', 'Arrival, Christmas market'],
  [201, '2026-11-22', 'Neue Nationalgalerie and Kulturforum'],
  [202, '2026-11-23', 'The Wall, Gropius Bau, Berlinische Galerie, C/O'],
  [203, '2026-11-24', 'Departure'],
];
// day, place, time as planned (kept as a note, never as a rule: only anchors have times), state, note
type S = [day: number, place: number, time?: string, state?: StopState, note?: string];
const stops: S[][] = [
  [[200, 103, '17:30', 'done'], [200, 131, undefined, 'done']],
  [[201, 106, '10:00', 'done', 'Cattelan'], [201, 132, undefined, 'done'], [201, 133, undefined, 'done']],
  [[202, 134, '10:00'], [202, 118, '12:00', 'planned', 'S-Bahn from Nordbahnhof to Anhalter Bahnhof'], [202, 119, undefined, 'planned', 'Drop it if the day feels too full'],
   [202, 135, '13:45', 'planned', 'Lunch'], [202, 123, '15:00', 'planned', 'About 1h30, 15 min walk'], [202, 117, '17:30', 'planned', 'Drop it if the day feels too full: next to the hotel, an easy next trip'], [202, 116, undefined, 'planned', 'Dinner']],
  [],
];

export async function loadBerlin() {
  const now = Date.now(), base = { updatedAt: now, deleted: 0 as const, dirty: 1 as const };
  const trip: Trip = { ...base, id: BERLIN_ID, name: 'Berlin', city: 'Berlin', country: 'Germany', start: '2026-11-21', end: '2026-11-24', tz: 'Europe/Berlin', baseId: id(100) };
  const A: Area[] = areas.map(([n, name, color]) => ({ ...base, id: id(n), tripId: BERLIN_ID, name, color }));
  const P: Place[] = places.map(([n, a, name, kind, lat, lng, address, extra]) => ({ ...base, id: id(n), tripId: BERLIN_ID, areaId: id(a), name, kind, lat, lng, address, ...extra }));
  P.push({ ...base, id: id(130), tripId: BERLIN_ID, name: 'Newton Foundation (closed until 2 Dec)', kind: 'museum', url: 'https://www.helmut-newton-foundation.org' });
  // Not on OpenStreetMap, so it waits in the Inbox for a location.
  P.push({ ...base, id: id(131), tripId: BERLIN_ID, name: 'Raku Ramen', kind: 'food' });
  const D: Day[] = days.map(([n, date, title]) => ({ ...base, id: id(n), tripId: BERLIN_ID, date, title }));
  let s = 300;
  const S: Stop[] = stops.flatMap((list) => list.map(([d, p, time, state, note], i) => ({ ...base, id: id(s++), tripId: BERLIN_ID, dayId: id(d), placeId: id(p), order: i, state: state || 'planned', time, note })));
  const N: Anchor[] = [
    { ...base, id: id(400), tripId: BERLIN_ID, kind: 'flight', title: 'Flight in, land BER', start: '2026-11-21T15:40', placeId: id(101), detail: 'Buy the WelcomeCard 72h ABC at the airport, then RE8 or RB23 to Zoologischer Garten.' },
    { ...base, id: id(401), tripId: BERLIN_ID, kind: 'stay', title: 'The Hoxton, Charlottenburg', start: '2026-11-21T14:00', end: '2026-11-24T11:00', placeId: id(100), detail: 'Leave the bag at reception on Tuesday.' },
    { ...base, id: id(404), tripId: BERLIN_ID, kind: 'flight', title: 'Flight home', start: '2026-11-24T12:00', placeId: id(101), detail: 'Leave the hotel at 09:30 for BER with an ABC ticket.' },
  ];
  const G: CityGuide = { ...base, id: id(500), tripId: BERLIN_ID, city: 'Berlin', sections: [
    { title: 'Airport to hotel', lines: ['RE8 or RB23 from BER straight to Zoologischer Garten, about 35 min, no change, then 8 min walk.', 'The S9 is direct but slower. Taxi or Uber about 45 min.'] },
    { title: 'Tickets', lines: ['No tap-to-pay and no gates. Buy in the BVG Ticket app (Apple Pay works) or at machines.', 'Inspectors check on board, the fine is €60. A paper ticket must be stamped before boarding.', 'The city is zone AB; the airport is zone C, so airport trips need ABC.', 'Best for this trip: Berlin WelcomeCard 72h ABC, €45.50, bought at the airport.'] },
    { title: 'Apps', lines: ['BVG Fahrinfo or Google Maps for routes.', 'U-Bahn and S-Bahn run all night on weekends.'] },
  ] };
  await db.transaction('rw', [db.trips, db.areas, db.places, db.days, db.stops, db.anchors, db.guides], async () => {
    await db.trips.put(trip); await db.areas.bulkPut(A); await db.places.bulkPut(P);
    await db.days.bulkPut(D); await db.stops.bulkPut(S); await db.anchors.bulkPut(N); await db.guides.put(G);
    // Stops and anchors of an earlier version that this one no longer has are removed.
    const keep = new Set([...S, ...N].map((r) => r.id));
    for (const t of [db.stops, db.anchors] as const)
      for (const r of await (t as any).where('tripId').equals(BERLIN_ID).toArray())
        if (!keep.has(r.id) && !r.deleted) await (t as any).put({ ...r, deleted: 1, updatedAt: now, dirty: 1 });
  });
  await setMeta('berlinVersion', BERLIN_VERSION);
  return trip;
}
export const BERLIN = { areas, places, days, stops };

// A device that already holds an older Berlin takes the new one when the app opens.
export async function refreshBerlin() {
  const t = await db.trips.get(BERLIN_ID);
  if (t && !t.deleted && ((await getMeta<number>('berlinVersion')) || 1) < BERLIN_VERSION) await loadBerlin();
}
