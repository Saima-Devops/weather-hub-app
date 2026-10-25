"use strict";

const $ = (id) => document.getElementById(id);
const input = $("locationInput");
const list = $("autocompleteList");
let weather = null;
let unit = readStorage("weather-unit", "c") === "f" ? "f" : "c";
let recent = readStorage("weather-recent", []);
if (!Array.isArray(recent)) recent = [];
recent = recent
  .filter(
    (city) =>
      city &&
      typeof city.name === "string" &&
      Number.isFinite(city.lat) &&
      Number.isFinite(city.lon),
  )
  .slice(0, 4);
let searchController;
let suggestionController;
let suggestionTimer;
let intent = 0;
let suggestionVersion = 0;
let suggestions = [];
let activeSuggestion = -1;
let tripPlan = null;

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The dashboard also works when browser storage is unavailable. */
  }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function temperature(celsius) {
  return Math.round(unit === "f" ? (celsius * 9) / 5 + 32 : celsius);
}
function degrees(celsius) {
  return `${temperature(celsius)}°`;
}
function localParts(iso, options) {
  // The API includes the destination's offset. Format its wall clock independently
  // of the browser timezone, which could be on the other side of the world.
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(iso.slice(0, 19) + "Z"));
}
function dateLabel(date, options) {
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
function setStatus(message, kind = "") {
  const status = $("statusArea");
  status.className = `status ${kind}`.trim();
  status.textContent = message;
}
function setBusy(busy) {
  $("dashboard").setAttribute("aria-busy", String(busy));
  $("searchBtn").setAttribute("aria-busy", String(busy));
}
async function getJSON(url, options = {}) {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unexpected response. Please try again.",
    );
  }
  if (!response.ok || data.error)
    throw new Error(data.error || "Weather is unavailable. Please try again.");
  return data;
}

async function searchWeather(payload, existingIntent) {
  const thisIntent = existingIntent ?? ++intent;
  closeSuggestions();
  searchController?.abort();
  searchController = new AbortController();
  setBusy(true);
  setStatus("Finding your forecast…", "loading");
  try {
    const data = await getJSON("/get_weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: searchController.signal,
    });
    if (thisIntent !== intent) return;
    weather = data;
    render();
    rememberCity(data);
    syncTripDestination(data.location);
    setStatus("Forecast updated. All times are local to your selected city.");
  } catch (error) {
    if (error.name !== "AbortError" && thisIntent === intent) {
      setStatus(error.message, "error");
      if (payload.location)
        syncTripDestination(
          WeatherTripPlanner.parseDestination(payload.location),
          false,
        );
    }
  } finally {
    if (thisIntent === intent) setBusy(false);
  }
}

function render() {
  if (!weather) return;
  const data = weather;
  $("emptyState").hidden = true;
  $("dashboard").hidden = false;
  $("locationName").textContent = [
    data.location.name,
    data.location.region,
    data.location.country,
  ]
    .filter(Boolean)
    .join(", ");
  $("localDateTime").textContent = localParts(data.location.localtime, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  $("tempValue").replaceChildren(
    document.createTextNode(temperature(data.current.temp_c)),
    element("span", "", `°${unit.toUpperCase()}`),
  );
  $("conditionText").textContent = data.current.description;
  $("conditionIcon").src = data.current.icon;
  $("feelsLike").textContent = degrees(data.current.feelslike_c);
  $("humidity").textContent = `${data.current.humidity}%`;
  $("wind").textContent = `${Math.round(data.current.wind_kph)} km/h`;
  $("updatedAt").textContent =
    `Observed ${localParts(data.updated_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · Local time`;
  $("recommendation").textContent = data.recommendation;
  $("outlookTitle").textContent = data.outlook.title.toUpperCase();
  $("outlookTemp").textContent = degrees(data.outlook.temp_c);
  $("outlookCondition").textContent = data.outlook.description;
  $("outlookIcon").src = data.outlook.icon;
  $("outlookRain").textContent = `${data.outlook.rain_chance}% rain`;
  $("outlookTime").textContent = localParts(data.outlook.time, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  renderHourly(data.hourly);
  renderDaily(data.daily);
  if (tripPlan) renderTrip();
}

function renderHourly(items) {
  const cells = items.map((item) => {
    const cell = element("div", "hour-cell");
    const time = element(
      "time",
      "",
      localParts(item.time, { hour: "numeric" }),
    );
    time.dateTime = item.time;
    const day = element(
      "span",
      "hour-day",
      localParts(item.time, { weekday: "short" }),
    );
    const icon = element("img");
    icon.src = item.icon;
    icon.alt = item.description;
    icon.width = 44;
    icon.height = 44;
    cell.append(
      time,
      day,
      icon,
      element("strong", "", degrees(item.temp_c)),
      element("span", "rain", `${item.rain_chance}% rain`),
    );
    return cell;
  });
  $("hourlyForecast").style.gridTemplateColumns =
    `repeat(${items.length}, minmax(0, 1fr))`;
  $("hourlyForecast").replaceChildren(...cells);
  renderChart(items);
}
function renderChart(items) {
  const svg = $("temperatureChart");
  svg.replaceChildren();
  const make = (tag, attrs, text) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs))
      node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  svg.append(
    make(
      "title",
      {},
      "Temperature trend for the next 24 hours. Exact values appear below.",
    ),
  );
  const temps = items.map((item) => item.temp_c);
  const low = Math.min(...temps);
  const range = Math.max(Math.max(...temps) - low, 4);
  const points = temps.map((temp, i) => [
    ((i + 0.5) * 800) / temps.length,
    85 - ((temp - low) / range) * 55,
  ]);
  [35, 65, 95].forEach((y) =>
    svg.append(
      make("line", { x1: 0, y1: y, x2: 800, y2: y, class: "chart-grid" }),
    ),
  );
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  svg.append(
    make("path", {
      d: `${path} L${points.at(-1)[0]},115 L${points[0][0]},115 Z`,
      fill: "var(--chart-fill)",
    }),
  );
  svg.append(make("path", { d: path, class: "chart-line" }));
  points.forEach(([cx, cy], i) => {
    svg.append(make("circle", { cx, cy, r: 3, class: "chart-point" }));
    svg.append(
      make(
        "text",
        { x: cx, y: cy - 12, class: "chart-value" },
        degrees(temps[i]),
      ),
    );
  });
}
function renderDaily(days) {
  const cards = days.map((day) => {
    const card = element("article", "day-card");
    const isToday = day.date === weather.location.localtime.slice(0, 10);
    const name = `${isToday ? "Today" : dateLabel(day.date, { weekday: "short" })}${day.partial ? "*" : ""}`;
    const icon = element("img");
    icon.src = day.icon;
    icon.alt = "";
    icon.width = 58;
    icon.height = 58;
    const temps = element("div", "day-temps");
    temps.setAttribute(
      "aria-label",
      `High ${degrees(day.max_c)}, low ${degrees(day.min_c)}`,
    );
    temps.append(
      element("strong", "", degrees(day.max_c)),
      element("span", "", degrees(day.min_c)),
    );
    card.append(
      element("h3", "", name),
      element(
        "span",
        "day-date",
        dateLabel(day.date, { month: "short", day: "numeric" }),
      ),
      icon,
      element("p", "day-condition", day.condition),
      temps,
      element("p", "rain", `${day.rain_chance}% rain`),
    );
    return card;
  });
  $("dailyForecast").replaceChildren(...cards);
}

function rememberCity(data) {
  const city = {
    name: data.location.name,
    country: data.location.country,
    lat: data.location.lat,
    lon: data.location.lon,
  };
  recent = [
    city,
    ...recent.filter((item) => item.lat !== city.lat || item.lon !== city.lon),
  ].slice(0, 4);
  saveStorage("weather-recent", recent);
  renderRecent();
}
function renderRecent() {
  const container = $("recentCities");
  container.replaceChildren();
  if (!recent.length) return;
  container.append(element("span", "recent-label", "RECENT"));
  recent.forEach((city) => {
    const button = element(
      "button",
      "city-chip",
      [city.name, city.country].filter(Boolean).join(", "),
    );
    button.type = "button";
    button.addEventListener("click", () => {
      input.value = city.name;
      searchWeather({ lat: city.lat, lon: city.lon });
    });
    container.append(button);
  });
}
function closeSuggestions() {
  clearTimeout(suggestionTimer);
  suggestionController?.abort();
  suggestionVersion++;
  suggestions = [];
  activeSuggestion = -1;
  list.hidden = true;
  list.replaceChildren();
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}
function highlightSuggestion(index) {
  activeSuggestion = index;
  [...list.children].forEach((item, i) =>
    item.setAttribute("aria-selected", String(index === i)),
  );
  if (index >= 0) {
    input.setAttribute("aria-activedescendant", `suggestion-${index}`);
    list.children[index].scrollIntoView({ block: "nearest" });
  } else input.removeAttribute("aria-activedescendant");
}
function selectSuggestion(index) {
  const city = suggestions[index];
  if (!city) return;
  input.value = [city.name, city.state, city.country]
    .filter(Boolean)
    .join(", ");
  searchWeather({ lat: city.lat, lon: city.lon });
  input.focus();
}
async function autocomplete(query, version) {
  suggestionController = new AbortController();
  try {
    const matches = await getJSON(
      `/autocomplete?query=${encodeURIComponent(query)}`,
      { signal: suggestionController.signal },
    );
    if (version !== suggestionVersion || input.value.trim() !== query) return;
    suggestions = matches;
    const options = matches.map((city, index) => {
      const item = element("li", "", city.name);
      item.id = `suggestion-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      item.append(
        element(
          "small",
          "",
          [city.state, city.country].filter(Boolean).join(", "),
        ),
      );
      item.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        selectSuggestion(index);
      });
      return item;
    });
    list.replaceChildren(...options);
    list.hidden = !matches.length;
    input.setAttribute("aria-expanded", String(matches.length > 0));
  } catch (error) {
    // Search remains available when suggestions cannot be loaded.
    if (error.name !== "AbortError" && version === suggestionVersion)
      closeSuggestions();
  }
}

$("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeSuggestion >= 0) return selectSuggestion(activeSuggestion);
  const query = input.value.trim();
  if (!query) return setStatus("Enter a city to search.", "error");
  searchWeather({ location: query });
});
input.addEventListener("input", () => {
  closeSuggestions();
  const query = input.value.trim();
  if (query.length < 2) return;
  const version = suggestionVersion;
  suggestionTimer = setTimeout(() => autocomplete(query, version), 300);
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") return closeSuggestions();
  if (!suggestions.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next =
      activeSuggestion < 0
        ? event.key === "ArrowDown"
          ? 0
          : suggestions.length - 1
        : activeSuggestion + (event.key === "ArrowDown" ? 1 : -1);
    highlightSuggestion((next + suggestions.length) % suggestions.length);
  }
});
input.addEventListener("blur", closeSuggestions);
$("locateBtn").addEventListener("click", () => {
  const thisIntent = ++intent;
  closeSuggestions();
  searchController?.abort();
  setBusy(false);
  if (!navigator.geolocation)
    return setStatus(
      "Your browser does not support location access. Search for a city instead.",
      "error",
    );
  setStatus("Waiting for your location…", "loading");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (thisIntent !== intent) return;
      searchWeather(
        { lat: position.coords.latitude, lon: position.coords.longitude },
        thisIntent,
      );
    },
    (error) => {
      if (thisIntent !== intent) return;
      setStatus(
        error.code === 1
          ? "Location permission was denied. You can still search for any city."
          : "Could not find your location. Search for a city instead.",
        "error",
      );
    },
    { timeout: 10000, maximumAge: 300000 },
  );
});
function renderUnits() {
  document
    .querySelectorAll("[data-unit]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.unit === unit)),
    );
}
document.querySelectorAll("[data-unit]").forEach((button) =>
  button.addEventListener("click", () => {
    unit = button.dataset.unit;
    saveStorage("weather-unit", unit);
    renderUnits();
    render();
  }),
);
document.querySelectorAll("[data-city]").forEach((button) =>
  button.addEventListener("click", () => {
    input.value = button.dataset.city;
    searchWeather({ location: button.dataset.city });
  }),
);
renderUnits();
renderRecent();

function browserToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function tripStatus(message, error = false) {
  $("tripStatus").className = `planner-status muted${error ? " error" : ""}`;
  $("tripStatus").textContent = message;
}
function syncTripDestination(location, hasWeather = true) {
  const city = [location.name, location.country].filter(Boolean).join(", ");
  $("tripDestination").value = city;
  const today = location.localtime?.slice(0, 10) || browserToday();
  $("tripStart").min = today;
  if (!$("tripStart").value || $("tripStart").value < today)
    $("tripStart").value = today;
  tripStatus(
    hasWeather
      ? `📍 Ready to plan ${city}. Forecasts will be matched to your trip dates.`
      : `📍 Plan ${city} while weather is unavailable. Forecasts will not be assumed.`,
  );
  if (tripPlan) buildTrip();
}
function buildTrip() {
  try {
    const destination = $("tripDestination").value.trim();
    const selected =
      weather &&
      [weather.location.name, weather.location.country]
        .filter(Boolean)
        .join(", ");
    const matched =
      selected && destination.toLowerCase() === selected.toLowerCase();
    const location = matched
      ? weather.location
      : WeatherTripPlanner.parseDestination(destination);
    const today = matched
      ? weather.location.localtime.slice(0, 10)
      : browserToday();
    if ($("tripStart").value < today)
      throw new Error("Choose today or a future start date.");
    tripPlan = WeatherTripPlanner.buildItinerary({
      location,
      startDate: $("tripStart").value,
      days: Number($("tripDays").value),
      interest: $("tripInterest").value,
      pace: $("tripPace").value,
      daily: matched ? weather.daily : [],
    });
    renderTrip();
    tripStatus(
      `✨ Your ${tripPlan.days.length}-day itinerary for ${tripPlan.city} is ready. Open a day to explore your stops.`,
    );
  } catch (error) {
    tripStatus(error.message, true);
  }
}
function renderTrip() {
  if (!tripPlan) return;
  $("tripResult").hidden = false;
  $("itineraryTitle").textContent =
    `${tripPlan.days.length} ${tripPlan.days.length === 1 ? "day" : "days"} in ${tripPlan.city}`;
  $("itinerarySubtitle").textContent =
    `${dateLabel(tripPlan.days[0].date, { month: "short", day: "numeric" })} – ${dateLabel(tripPlan.days.at(-1).date, { month: "short", day: "numeric", year: "numeric" })} · ${tripPlan.pace === "relaxed" ? "Slow & easy" : "Make the most of it"}`;
  const labels = ["🌅 Morning", "☀️ Afternoon", "🌙 Evening"];
  const cards = tripPlan.days.map((day, index) => {
    const card = element("details", "itinerary-day");
    card.open = index === 0;
    const summary = element("summary");
    const number = element("span", "day-number", `0${index + 1}`);
    number.setAttribute("aria-label", `Day ${index + 1}`);
    const text = element("div", "day-summary");
    const date = element(
      "time",
      "",
      dateLabel(day.date, { weekday: "long", month: "short", day: "numeric" }),
    );
    date.dateTime = day.date;
    text.append(element("strong", "", day.title), date);
    const badge = element(
      "span",
      "trip-weather",
      day.forecast
        ? `${degrees(day.forecast.max_c)} / ${degrees(day.forecast.min_c)} · ${day.forecast.rain_chance}% rain${day.forecast.partial ? " · partial day" : ""}`
        : "📅 Weather closer to travel",
    );
    const chevron = element("span", "day-chevron", "⌄");
    chevron.setAttribute("aria-hidden", "true");
    summary.append(number, text, badge, chevron);
    const detail = element("div", "day-detail");
    detail.append(element("p", "day-weather-note", day.note));
    const timeline = element("ol", "trip-timeline");
    day.stops.forEach((stop, slot) => {
      const row = element("li", "trip-stop");
      row.append(element("span", "stop-time", labels[slot]));
      const content = element("div");
      const title = element("p", "stop-title", stop.title);
      if (stop.adapted)
        title.append(element("span", "stop-tag", "Indoor alternative"));
      content.append(title, element("p", "stop-description", stop.description));
      const map = element(
        "a",
        "stop-map",
        tripPlan.curated && !stop.rest
          ? "Find this stop on Maps ↗"
          : "Explore local options ↗",
      );
      map.href = WeatherTripPlanner.mapURL(
        stop.query || stop.title,
        tripPlan.city,
      );
      map.target = "_blank";
      map.rel = "noopener noreferrer";
      content.append(map);
      row.append(content);
      timeline.append(row);
    });
    detail.append(timeline);
    card.append(summary, detail);
    return card;
  });
  $("itineraryDays").replaceChildren(...cards);
  const source = $("tripSource");
  source.replaceChildren();
  if (tripPlan.guide) {
    source.append(document.createTextNode("More destination ideas: "));
    const link = element("a", "", `${tripPlan.guideName} ↗`);
    link.href = tripPlan.guide;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    source.append(link);
  } else
    source.textContent =
      "A flexible city-exploration template. Map links help you choose actual venues; individual stops have not been verified.";
}
$("tripForm").addEventListener("submit", (event) => {
  event.preventDefault();
  buildTrip();
});
$("useSelectedCity").addEventListener("click", () => {
  if (weather) syncTripDestination(weather.location);
  else if (input.value.trim())
    syncTripDestination(
      WeatherTripPlanner.parseDestination(input.value.trim()),
      false,
    );
  else {
    tripStatus(
      "Search for a city above or enter your destination directly.",
      true,
    );
    $("tripDestination").focus();
  }
});
$("tripDestination").addEventListener("input", () => {
  tripPlan = null;
  $("tripResult").hidden = true;
  $("tripStart").min = browserToday();
  tripStatus("Choose your dates and travel style, then build your itinerary.");
});
["tripStart", "tripDays", "tripInterest", "tripPace"].forEach((id) =>
  $(id).addEventListener("change", () => {
    if (tripPlan) {
      tripPlan = null;
      $("tripResult").hidden = true;
      tripStatus(
        "Your choices changed. Build the itinerary to update your plan.",
      );
    }
  }),
);
$("downloadTrip").addEventListener("click", async () => {
  if (!tripPlan) return;
  const exportPlan = tripPlan;
  const button = $("downloadTrip");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing PDF…";
  button.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/download_itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: exportPlan, unit }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || "Could not create the PDF. Please try again.",
      );
    }
    if (!response.headers.get("Content-Type")?.includes("application/pdf"))
      throw new Error("Could not create the PDF. Please try again.");
    const url = URL.createObjectURL(await response.blob());
    const link = element("a");
    link.href = url;
    link.download = `world-weather-hub-itinerary-${exportPlan.days[0].date}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    tripStatus("Your itinerary PDF is ready. Enjoy planning your adventure!");
  } catch (error) {
    tripStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    button.removeAttribute("aria-busy");
  }
});
$("tripStart").min = browserToday();
$("tripStart").value = browserToday();
