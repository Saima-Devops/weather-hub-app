"""Weather Hub: a small Flask app with a server-side OpenWeather integration."""

from collections import Counter
from datetime import datetime, timedelta, timezone
import math
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_file
import requests
from werkzeug.exceptions import HTTPException
from itinerary_pdf import render_itinerary_pdf

load_dotenv()
app = Flask(__name__)
app.config.update(OWM_KEY=os.getenv("OWM_KEY", ""), MAX_CONTENT_LENGTH=16 * 1024)
API_BASE = "https://api.openweathermap.org"


class WeatherError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


@app.errorhandler(WeatherError)
def handle_weather_error(error):
    return jsonify(error=str(error)), error.status


@app.errorhandler(HTTPException)
def handle_http_error(error):
    if request.path != "/":
        return jsonify(error=error.description), error.code
    return error


def provider_get(path, **params):
    key = app.config["OWM_KEY"].strip()
    if not key or key == "your_openweather_api_key":
        raise WeatherError("Weather is not configured. Set OWM_KEY on the server.", 503)
    try:
        response = requests.get(
            f"{API_BASE}{path}", params={**params, "appid": key}, timeout=(3.05, 10)
        )
        if response.status_code in (401, 403):
            raise WeatherError("The weather service credentials need attention.", 503)
        if response.status_code == 429:
            raise WeatherError("Weather service is busy. Please try again shortly.", 503)
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        raise WeatherError("Weather service timed out. Please try again.", 504) from None
    except (requests.RequestException, ValueError):
        # Never include upstream URLs or exception text: they may contain the API key.
        raise WeatherError("Weather service is unavailable. Please try again.") from None


def get_recommendation(temp, condition):
    condition = condition.lower()
    if any(word in condition for word in ("rain", "drizzle", "thunderstorm")):
        return "🌧️ ☂️ Carry an umbrella and a waterproof layer."
    if "snow" in condition:
        return "❄️ 🧥 🧤 Pack a warm coat, gloves and shoes with good grip."
    if temp >= 30:
        return "☀️ 💧 🧢 Stay hydrated, wear a hat and take breaks in the shade."
    if temp >= 24:
        return "😎 🧴 👕 Light clothes, a hat and sunscreen will help outdoors."
    if temp >= 18:
        return "🌤️ 🧥 Bring a light layer for cooler moments."
    if temp >= 10:
        return "🍃 🧥 Take a jacket and comfortable layers."
    return "🥶 🧣 🧤 Bundle up with a warm coat, scarf and gloves."


def get_time_greeting(now):
    if 5 <= now.hour < 12:
        return "Good morning"
    if 12 <= now.hour < 17:
        return "Good afternoon"
    if 17 <= now.hour < 21:
        return "Good evening"
    return "Good night"


def is_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and (not isinstance(value, float) or math.isfinite(value))
    )


def weather_item(item, tz):
    condition = item["weather"][0]
    numeric = [item["dt"], item["main"]["temp"], item["main"]["feels_like"],
               item["main"]["humidity"], item["wind"]["speed"], item.get("pop", 0)]
    if not all(is_number(value) for value in numeric):
        raise ValueError("Invalid weather measurement")
    if not isinstance(condition["main"], str) or not isinstance(condition.get("description", ""), str):
        raise ValueError("Invalid weather condition")
    icon = condition["icon"]
    # Only allow provider icon identifiers, never arbitrary URLs or markup.
    if not isinstance(icon, str) or len(icon) != 3 or not icon[:2].isdigit() or icon[2] not in "dn":
        raise ValueError("Invalid weather icon")
    return {
        "time": datetime.fromtimestamp(item["dt"], tz).isoformat(),
        "temp_c": item["main"]["temp"],
        "feelslike_c": item["main"]["feels_like"],
        "humidity": item["main"]["humidity"],
        "wind_kph": round(item["wind"]["speed"] * 3.6, 1),
        "condition": condition["main"],
        "description": condition.get("description", condition["main"]),
        "icon": f"https://openweathermap.org/img/wn/{icon}@2x.png",
        "is_day": icon.endswith("d"),
        "rain_chance": round(max(0, min(1, item.get("pop", 0))) * 100),
    }


def fetch_weather_by_coords(lat, lon, loc_data=None):
    current = provider_get("/data/2.5/weather", lat=lat, lon=lon, units="metric")
    forecast = provider_get("/data/2.5/forecast", lat=lat, lon=lon, units="metric")
    try:
        tz = timezone(timedelta(seconds=current["timezone"]))
        now = datetime.now(tz)
        present = weather_item(current, tz)
        hourly = [weather_item(item, tz) for item in forecast["list"] if item["dt"] > now.timestamp()]
        if not hourly:
            raise ValueError("Empty forecast")
        days = {}
        source = {item["dt"]: item for item in forecast["list"]}
        for item in hourly:
            day = item["time"][:10]
            days.setdefault(day, []).append(item)
        daily = []
        for day, items in list(days.items())[:5]:
            # Use the most common condition; select its entry nearest local noon.
            condition = Counter(item["condition"] for item in items).most_common(1)[0][0]
            representative = min(
                (item for item in items if item["condition"] == condition),
                key=lambda item: abs(datetime.fromisoformat(item["time"]).hour - 12),
            )
            originals = [source[int(datetime.fromisoformat(item["time"]).timestamp())] for item in items]
            daily.append({
                "date": day, "condition": condition, "icon": representative["icon"],
                "min_c": min(item["main"].get("temp_min", item["main"]["temp"]) for item in originals),
                "max_c": max(item["main"].get("temp_max", item["main"]["temp"]) for item in originals),
                "rain_chance": max(item["rain_chance"] for item in items),
                "partial": len(items) < 8,
            })
        # Match both label and data to the destination's local evening/morning.
        morning = now.hour >= 18 or now.hour < 6
        target_day = now.date() + timedelta(days=1 if now.hour >= 18 else 0)
        target = datetime.combine(target_day, datetime.min.time(), tz) + timedelta(hours=6 if morning else 18)
        outlook = next((item for item in hourly if datetime.fromisoformat(item["time"]) >= target), hourly[-1])
        location = loc_data or {}
        return {
            "location": {
                "name": location.get("name") or current.get("name") or forecast["city"]["name"],
                "region": location.get("state", ""),
                "country": location.get("country") or current["sys"]["country"],
                "localtime": now.isoformat(), "utc_offset": current["timezone"],
                "lat": lat, "lon": lon,
            },
            "current": present,
            "outlook": {**outlook, "title": "Next morning" if morning else "This evening"},
            "hourly": hourly[:8], "daily": daily,
            "recommendation": get_recommendation(present["temp_c"], present["condition"]),
            "greeting": get_time_greeting(now),
            "updated_at": present["time"],
        }
    except (KeyError, IndexError, TypeError, ValueError, OverflowError):
        raise WeatherError("Weather service returned incomplete data. Please try again.") from None


def geocode(query, limit=5):
    data = provider_get("/geo/1.0/direct", q=query, limit=limit)
    if not isinstance(data, list):
        raise WeatherError("Location service returned an invalid response.")
    return [
        {"name": loc["name"], "state": loc.get("state", ""), "country": loc["country"],
         "lat": loc["lat"], "lon": loc["lon"]}
        for loc in data if isinstance(loc, dict) and all(key in loc for key in ("name", "country", "lat", "lon"))
    ]


@app.get("/")
def index():
    return render_template("index.html", copyright_year=datetime.now(timezone.utc).year)


@app.post("/get_weather")
def get_weather():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise WeatherError("Send a JSON object with a city or coordinates.", 400)
    if "lat" in data or "lon" in data:
        values = (data.get("lat"), data.get("lon"))
        if not all(is_number(value) for value in values):
            raise WeatherError("Latitude and longitude must be finite numbers.", 400)
        lat, lon = values
        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise WeatherError("Coordinates are outside the valid range.", 400)
        return jsonify(fetch_weather_by_coords(lat, lon))
    location = data.get("location")
    if not isinstance(location, str) or not 1 <= len(location.strip()) <= 120:
        raise WeatherError("Enter a city name between 1 and 120 characters.", 400)
    matches = geocode(location.strip(), limit=1)
    if not matches:
        raise WeatherError("City not found. Try adding a country or state.", 404)
    match = matches[0]
    return jsonify(fetch_weather_by_coords(match["lat"], match["lon"], match))


@app.get("/autocomplete")
def autocomplete():
    query = request.args.get("query", "").strip()
    if len(query) < 2:
        return jsonify([])
    if len(query) > 120:
        raise WeatherError("Search must be 120 characters or fewer.", 400)
    return jsonify(geocode(query))


@app.post("/download_itinerary")
def download_itinerary():
    try:
        output, filename = render_itinerary_pdf(request.get_json(silent=True))
    except ValueError as error:
        raise WeatherError(str(error), 400) from None
    response = send_file(output, mimetype="application/pdf", as_attachment=True, download_name=filename)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
