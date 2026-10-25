/* Suggested routes are editorial starting points, not live availability data. */
(function (root) {
  "use strict";
  const stop = (title, description, indoor = false) => ({
    title,
    description,
    indoor,
  });
  const profiles = {
    dubai: {
      country: "AE",
      aliases: ["ae", "uae", "united arab emirates"],
      label: "Dubai, AE",
      guide: "https://www.visitdubai.com/en/things-to-do",
      guideName: "Visit Dubai",
      indoor: [
        "Museum of the Future",
        "Dubai Aquarium",
        "Mohammed Bin Rashid Library",
        "Alserkal Avenue galleries",
        "Etihad Museum",
      ],
      routes: [
        {
          title: "Old Dubai & the creek",
          interest: "culture",
          stops: [
            stop(
              "Al Fahidi Historical Neighbourhood",
              "Explore the lanes early, with time for a café stop.",
            ),
            stop(
              "Al Shindagha Museum",
              "Make the afternoon a slower, indoor history stop.",
              true,
            ),
            stop(
              "Dubai Creek",
              "Finish with a waterside stroll and dinner nearby.",
            ),
          ],
        },
        {
          title: "Downtown discoveries",
          interest: "landmarks",
          stops: [
            stop(
              "Burj Khalifa",
              "Choose a viewing time and check ticket availability.",
              true,
            ),
            stop(
              "Dubai Aquarium",
              "Take an indoor break around Dubai Mall.",
              true,
            ),
            stop(
              "Downtown Dubai",
              "Enjoy the skyline and choose a nearby dinner spot.",
            ),
          ],
        },
        {
          title: "Coast & fresh air",
          interest: "outdoors",
          stops: [
            stop(
              "Jumeirah Beach",
              "Start with a short coastal walk before the day warms up.",
            ),
            stop(
              "Etihad Museum",
              "Spend the afternoon exploring indoors.",
              true,
            ),
            stop(
              "Dubai Marina",
              "Walk along the waterfront and stop for dinner.",
            ),
          ],
        },
        {
          title: "A taste of the city",
          interest: "food",
          stops: [
            stop(
              "Al Seef cafés",
              "Start slowly with breakfast beside the creek.",
            ),
            stop(
              "Deira restaurants",
              "Explore local dining; choose a spot that suits your diet.",
              true,
            ),
            stop(
              "Jumeirah restaurants",
              "Leave the evening open for a relaxed meal.",
              true,
            ),
          ],
        },
        {
          title: "Art & future thinking",
          interest: "culture",
          stops: [
            stop(
              "Museum of the Future",
              "Plan a timed visit if tickets are available.",
              true,
            ),
            stop(
              "Alserkal Avenue galleries",
              "Browse art spaces, with a café break between stops.",
              true,
            ),
            stop(
              "Madinat Jumeirah",
              "Wrap up with a short walk and a leisurely dinner.",
            ),
          ],
        },
      ],
    },
    london: {
      country: "GB",
      aliases: ["gb", "uk", "united kingdom", "england"],
      label: "London, GB",
      guide: "https://www.visitlondon.com/things-to-do/london-attractions-map",
      guideName: "Visit London",
      indoor: [
        "National Gallery",
        "Tate Modern",
        "British Museum",
        "Natural History Museum",
        "Science Museum",
      ],
      routes: [
        {
          title: "Westminster & the river",
          interest: "landmarks",
          stops: [
            stop(
              "Westminster",
              "See the landmarks from outside at an easy walking pace.",
            ),
            stop(
              "National Gallery",
              "Spend the afternoon with the collection indoors.",
              true,
            ),
            stop("South Bank", "Finish with a riverside wander and dinner."),
          ],
        },
        {
          title: "Museums & garden paths",
          interest: "culture",
          stops: [
            stop(
              "Natural History Museum",
              "Leave time for the exhibits that interest you most.",
              true,
            ),
            stop(
              "V&A South Kensington",
              "Choose a few galleries rather than rushing the whole museum.",
              true,
            ),
            stop(
              "Hyde Park",
              "Take a short walk if conditions and daylight allow.",
            ),
          ],
        },
        {
          title: "Markets & modern art",
          interest: "food",
          stops: [
            stop(
              "Borough Market",
              "Browse food stalls and pick up breakfast or lunch.",
            ),
            stop(
              "Tate Modern",
              "Make a relaxed indoor stop after the market.",
              true,
            ),
            stop(
              "Covent Garden restaurants",
              "Choose a dinner spot and enjoy the neighbourhood.",
              true,
            ),
          ],
        },
        {
          title: "Green spaces & city views",
          interest: "outdoors",
          stops: [
            stop(
              "St James’s Park",
              "Start with a gentle walk and time for photos.",
            ),
            stop(
              "London Eye",
              "Check tickets and conditions before choosing a visit.",
              true,
            ),
            stop("South Bank", "Follow the river for an easy evening out."),
          ],
        },
        {
          title: "Stories & a West End evening",
          interest: "culture",
          stops: [
            stop(
              "British Museum",
              "Focus on a few collections and take regular breaks.",
              true,
            ),
            stop(
              "British Library",
              "Explore the available exhibitions indoors.",
              true,
            ),
            stop(
              "West End theatres",
              "Browse current shows and book only after checking the schedule.",
              true,
            ),
          ],
        },
      ],
    },
    tokyo: {
      country: "JP",
      aliases: ["jp", "japan"],
      label: "Tokyo, JP",
      guide: "https://www.gotokyo.org/en/see-and-do/attractions/",
      guideName: "GO TOKYO",
      indoor: [
        "Tokyo National Museum",
        "National Museum of Nature and Science",
        "Sumida Aquarium",
        "Mori Art Museum",
        "National Museum of Emerging Science and Innovation",
      ],
      routes: [
        {
          title: "Asakusa & old Tokyo",
          interest: "culture",
          stops: [
            stop(
              "Sensoji Temple",
              "Explore respectfully, with time for the surrounding streets.",
            ),
            stop(
              "Tokyo National Museum",
              "Make an indoor stop for art and history.",
              true,
            ),
            stop("Asakusa restaurants", "Choose a relaxed local dinner.", true),
          ],
        },
        {
          title: "Shibuya & neighbourhood life",
          interest: "landmarks",
          stops: [
            stop(
              "Meiji Jingu",
              "Start with a quiet walk through the approach.",
            ),
            stop(
              "Harajuku cafés",
              "Pause for lunch and explore nearby shops.",
              true,
            ),
            stop(
              "Shibuya Crossing",
              "See the neighbourhood lights and find dinner nearby.",
            ),
          ],
        },
        {
          title: "Parks & discovery",
          interest: "outdoors",
          stops: [
            stop(
              "Ueno Park",
              "Enjoy the paths and choose a short walking loop.",
            ),
            stop(
              "National Museum of Nature and Science",
              "Spend the afternoon with the indoor exhibits.",
              true,
            ),
            stop(
              "Ueno restaurants",
              "Keep the evening flexible for local dining.",
              true,
            ),
          ],
        },
        {
          title: "A food-focused day",
          interest: "food",
          stops: [
            stop(
              "Tsukiji Outer Market",
              "Try a few food stops; check trading days before visiting.",
            ),
            stop(
              "Ginza food halls",
              "Browse indoors and take an unhurried lunch break.",
              true,
            ),
            stop(
              "Shinjuku restaurants",
              "Choose a dinner spot to match your taste and budget.",
              true,
            ),
          ],
        },
        {
          title: "The bay & the city skyline",
          interest: "outdoors",
          stops: [
            stop("Odaiba waterfront", "Take a short walk around the bay."),
            stop(
              "National Museum of Emerging Science and Innovation",
              "Explore science exhibits indoors.",
              true,
            ),
            stop(
              "Tokyo Tower",
              "Check viewing tickets and visibility before heading up.",
              true,
            ),
          ],
        },
      ],
    },
  };
  const genericRoutes = [
    {
      title: "First impressions",
      interest: "landmarks",
      queries: ["historic centre", "museum", "local restaurants"],
    },
    {
      title: "Culture at your own pace",
      interest: "culture",
      queries: ["art gallery", "history museum", "cafés"],
    },
    {
      title: "A little fresh air",
      interest: "outdoors",
      queries: ["parks", "indoor attractions", "waterfront walks"],
    },
    {
      title: "Taste the neighbourhoods",
      interest: "food",
      queries: ["breakfast cafés", "food markets", "local restaurants"],
    },
    {
      title: "Your own discoveries",
      interest: "culture",
      queries: ["neighbourhood walks", "galleries", "local restaurants"],
    },
  ];
  function profileFor(location) {
    const name = location.name.trim().toLowerCase();
    const country = (location.country || "").trim().toLowerCase();
    const profile = Object.hasOwn(profiles, name) ? profiles[name] : null;
    return profile && (!country || profile.aliases.includes(country))
      ? profile
      : null;
  }
  function parseDestination(value) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      name: parts[0] || "",
      country: parts.length > 1 ? parts.at(-1) : "",
    };
  }
  function buildItinerary({
    location,
    startDate,
    days = 3,
    interest = "balanced",
    pace = "relaxed",
    daily = [],
  }) {
    if (!location || typeof location.name !== "string" || !location.name.trim())
      throw new Error("Enter a destination for your trip.");
    const start = new Date(`${startDate}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !Number.isFinite(start.getTime()) ||
      start.toISOString().slice(0, 10) !== startDate
    )
      throw new Error("Choose a valid start date.");
    if (!Number.isInteger(days) || days < 1 || days > 5)
      throw new Error("Choose a trip length of 1–5 days.");
    if (
      !["balanced", "culture", "food", "outdoors", "landmarks"].includes(
        interest,
      )
    )
      throw new Error("Choose a travel interest.");
    if (!["relaxed", "full"].includes(pace))
      throw new Error("Choose a trip pace.");
    const profile = profileFor(location);
    const city = profile
      ? profile.label
      : [location.name, location.country].filter(Boolean).join(", ");
    const routes = [...(profile ? profile.routes : genericRoutes)].sort(
      (a, b) =>
        Number(b.interest === interest) - Number(a.interest === interest),
    );
    const result = routes.slice(0, days).map((route, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const iso = date.toISOString().slice(0, 10);
      const forecast = daily.find((day) => day.date === iso) || null;
      const wet =
        forecast &&
        (forecast.rain_chance >= 50 ||
          /rain|drizzle|snow|thunderstorm/i.test(forecast.condition));
      const hot = forecast && forecast.max_c >= 32;
      const severe = forecast && /thunderstorm|snow/i.test(forecast.condition);
      let stops = profile
        ? route.stops.map((item) => ({ ...item }))
        : route.queries.map((query) => ({
            title: `Find ${query}`,
            description: `Explore options in ${city} and pick a stop that suits you.`,
            query,
            indoor: /museum|gallery|galleries|indoor/i.test(query),
          }));
      let adapted = false;
      stops = stops.map((item, slot) => {
        const replace = !item.indoor && (wet || severe || (hot && slot === 1));
        if (!replace) return item;
        adapted = true;
        const title = profile
          ? profile.indoor[(index + slot) % profile.indoor.length]
          : "Find an indoor museum or café";
        return {
          title,
          description:
            "An indoor alternative for the forecast. Check availability before you go.",
          indoor: true,
          query: profile ? title : "indoor museums cafés",
          adapted: true,
        };
      });
      if (pace === "relaxed")
        stops[1] = {
          title: "Lunch & time to recharge",
          description: `Take a slow lunch and a break near your morning stop in ${city}.`,
          query: `cafés restaurants near ${stops[0].title}`,
          indoor: true,
          rest: true,
        };
      const note = forecast
        ? severe
          ? "⛈️ Keep plans indoors and check local conditions before travelling."
          : wet
            ? "🌧️ Indoor alternatives included for a wet-weather day."
            : hot
              ? "☀️ Keep outdoor stops short, avoid midday heat and carry water."
              : "🌤️ A flexible mix of exploring and breaks."
        : "📅 No forecast for this date yet. Recheck the weather closer to your trip.";
      return { date: iso, title: route.title, forecast, note, adapted, stops };
    });
    return {
      city,
      curated: !!profile,
      guide: profile?.guide,
      guideName: profile?.guideName,
      days: result,
      pace,
      interest,
    };
  }
  function mapURL(title, city) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title}, ${city}`)}`;
  }
  const api = { buildItinerary, parseDestination, mapURL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeatherTripPlanner = api;
})(typeof window !== "undefined" ? window : globalThis);
