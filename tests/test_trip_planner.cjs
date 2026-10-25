const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildItinerary,
  parseDestination,
  mapURL,
} = require("../static/js/trip-planner.js");
const base = {
  location: { name: "Dubai", country: "AE" },
  startDate: "2026-10-25",
  days: 3,
  interest: "balanced",
  pace: "full",
};

test("curated itinerary uses destination-specific stops and dates", () => {
  const trip = buildItinerary(base);
  assert.equal(trip.city, "Dubai, AE");
  assert.equal(trip.curated, true);
  assert.equal(trip.days.length, 3);
  assert.equal(
    trip.days[0].stops[0].title,
    "Al Fahidi Historical Neighbourhood",
  );
  assert.equal(trip.days[2].date, "2026-10-27");
  assert(trip.days.every((day) => day.stops.length === 3));
});
test("London and Tokyo use their own routes", () => {
  const london = buildItinerary({
    ...base,
    location: { name: "London", country: "GB" },
  });
  const tokyo = buildItinerary({
    ...base,
    location: { name: "Tokyo", country: "JP" },
  });
  assert.equal(london.days[0].stops[0].title, "Westminster");
  assert.equal(tokyo.days[0].stops[0].title, "Sensoji Temple");
  assert(london.guide.includes("visitlondon.com"));
  assert(tokyo.guide.includes("gotokyo.org"));
});
test("same-named city in a different country does not inherit a curated route", () => {
  const trip = buildItinerary({
    ...base,
    location: { name: "London", country: "CA" },
  });
  assert.equal(trip.curated, false);
  assert.equal(trip.city, "London, CA");
  assert(trip.days[0].stops[0].query);
});
test("unknown destinations have map searches instead of invented venues", () => {
  const trip = buildItinerary({
    ...base,
    location: { name: "Muscat", country: "OM" },
    days: 5,
  });
  assert.equal(trip.curated, false);
  assert.equal(trip.days.length, 5);
  assert(
    trip.days.every((day) =>
      day.stops.every((stop) => stop.title.startsWith("Find ")),
    ),
  );
  assert.equal(trip.guide, undefined);
});
test("interest changes day order and relaxed pace inserts breaks", () => {
  const trip = buildItinerary({ ...base, interest: "food", pace: "relaxed" });
  assert.equal(trip.days[0].title, "A taste of the city");
  assert(trip.days.every((day) => day.stops[1].rest));
});
test("rain swaps outdoor activities for indoor alternatives", () => {
  const daily = [
    {
      date: "2026-10-25",
      max_c: 24,
      min_c: 19,
      rain_chance: 70,
      condition: "Rain",
    },
  ];
  const trip = buildItinerary({ ...base, daily });
  assert(trip.days[0].stops.every((stop) => stop.indoor));
  assert.equal(trip.days[0].adapted, true);
  assert.match(trip.days[0].note, /Indoor/);
  assert.equal(trip.days[1].forecast, null);
});
test("storm precautions apply even with a low rain probability", () => {
  const trip = buildItinerary({
    ...base,
    daily: [
      {
        date: "2026-10-25",
        max_c: 25,
        min_c: 20,
        rain_chance: 10,
        condition: "Thunderstorm",
      },
    ],
  });
  assert(trip.days[0].stops.every((stop) => stop.indoor));
  assert.match(trip.days[0].note, /check local conditions/);
});
test("hot days include heat guidance", () => {
  const trip = buildItinerary({
    ...base,
    daily: [
      {
        date: "2026-10-25",
        max_c: 38,
        min_c: 30,
        rain_chance: 0,
        condition: "Clear",
      },
    ],
  });
  assert.match(trip.days[0].note, /midday heat/);
});
test("weather is never extrapolated to future travel dates", () => {
  const trip = buildItinerary({
    ...base,
    startDate: "2027-01-15",
    daily: [
      {
        date: "2026-10-25",
        max_c: 38,
        min_c: 30,
        rain_chance: 0,
        condition: "Clear",
      },
    ],
  });
  assert(trip.days.every((day) => day.forecast === null));
  assert(trip.days.every((day) => day.note.includes("No forecast")));
});
test("UTC calendar arithmetic handles month, year, leap day and DST boundaries", () => {
  for (const [date, expected] of [
    ["2026-12-31", "2027-01-02"],
    ["2028-02-28", "2028-03-01"],
    ["2026-10-31", "2026-11-02"],
  ]) {
    assert.equal(
      buildItinerary({ ...base, startDate: date }).days[2].date,
      expected,
    );
  }
});
test("invalid calendar dates and options are rejected", () => {
  for (const patch of [
    { startDate: "2026-02-30" },
    { startDate: "bad" },
    { days: 0 },
    { days: 6 },
    { days: 1.5 },
    { interest: "bad" },
    { pace: "bad" },
    { location: { name: "" } },
  ]) {
    assert.throws(() => buildItinerary({ ...base, ...patch }));
  }
});
test("destination parsing and map URLs safely encode user text", () => {
  assert.deepEqual(parseDestination("Paris, Île-de-France, FR"), {
    name: "Paris",
    country: "FR",
  });
  const url = mapURL("Museum & café <test>", "Paris, FR");
  assert.equal(
    new URL(url).searchParams.get("query"),
    "Museum & café <test>, Paris, FR",
  );
  assert(!url.includes("<test>"));
});

test("rain also adapts generic outdoor markets, and unusual names stay generic", () => {
  const trip = buildItinerary({
    ...base,
    location: { name: "Muscat", country: "OM" },
    interest: "food",
    daily: [
      {
        date: "2026-10-25",
        max_c: 24,
        min_c: 18,
        rain_chance: 80,
        condition: "Rain",
      },
    ],
  });
  assert(trip.days[0].stops.every((stop) => stop.indoor));
  assert.equal(
    buildItinerary({ ...base, location: { name: "constructor" } }).curated,
    false,
  );
});
