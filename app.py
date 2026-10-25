from flask import Flask, render_template, request, jsonify
import requests
from datetime import datetime, timezone, timedelta  # Added timedelta
import pytz  # To handle local timezone if needed

import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# OpenWeatherMap API key
OWM_KEY = os.getenv("OWM_KEY")


def fetch_weather_by_coords(lat, lon, loc_data=None):
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={OWM_KEY}"
    resp = requests.get(url)
    if resp.status_code != 200:
        return {"error": "Unable to fetch weather data."}
    data = resp.json()

    # Extract current weather from the first forecast in the list
    current_forecast = data["list"][0]
    current_weather = current_forecast["main"]
    current_condition = current_forecast["weather"][0]
    wind = current_forecast["wind"]

    # Determine tonight forecast
    # Find the next forecast that is at night (after sunset)
    now = datetime.fromtimestamp(current_forecast["dt"], timezone.utc)
    tonight_forecast = None
    for forecast in data["list"]:
        forecast_time = datetime.fromtimestamp(forecast["dt"], timezone.utc)
        if forecast_time.hour >= 18:  # Assuming night starts at 6 PM
            tonight_forecast = forecast
            break

    if tonight_forecast is None:
        tonight_forecast = data["list"][1] if len(
            data["list"]) > 1 else current_forecast

    result = {
        "location": {
            "name": loc_data["name"] if loc_data else data["city"]["name"],
            "region": loc_data.get("state", "") if loc_data else "",
            "country": loc_data.get("country", "") if loc_data else data["city"]["country"],
            "localtime": (datetime.utcnow() + timedelta(seconds=data["city"]["timezone"])).isoformat()
        },
        "current": {
            "temp_c": current_weather["temp"],
            "feelslike_c": current_weather["feels_like"],
            "humidity": current_weather["humidity"],
            "wind_kph": wind["speed"] * 3.6,  # m/s to kph
            "condition": current_condition["main"],
            "icon": f"http://openweathermap.org/img/wn/{current_condition['icon']}@2x.png"
        },
        "tonight": {
            "temp_c": tonight_forecast["main"]["temp"],
            "condition": tonight_forecast["weather"][0]["main"],
            "icon": f"http://openweathermap.org/img/wn/{tonight_forecast['weather'][0]['icon']}@2x.png"
        },
        "recommendation": get_recommendation(current_weather["temp"], current_condition["main"]),
        "greeting": get_time_greeting(now)
    }
    return result


def get_recommendation(temp, condition):
    c = condition.lower()
    if "rain" in c:
        return "🌧️ Take an umbrella!"
    elif "snow" in c:
        return "❄️ Wear warm clothes!"
    elif temp >= 30:
        return "🥵 Stay hydrated!"
    elif temp >= 24:
        return "😎 Great weather for outdoors!"
    elif temp >= 18:
        return "🙂 Pleasant weather."
    elif temp >= 10:
        return "🧥 Might need a jacket."
    else:
        return "🥶 Cold — bundle up!"


def get_time_greeting(now):
    hour = now.hour
    if 5 <= hour < 12:
        return "🌅Good Morning! Welcome to World Weather Hub!"
    elif 12 <= hour < 17:
        return "🌞Good Afternoon! Welcome to World Weather Hub!"
    elif 17 <= hour < 20:
        return "🌙Good Evening! Welcome to World Weather Hub!"
    else:
        return "🌦️Welcome to World Weather Hub!"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_weather", methods=["POST"])
def get_weather():
    data = request.get_json()
    location = data.get("location")
    lat = data.get("lat")
    lon = data.get("lon")

    if lat is not None and lon is not None:
        weather = fetch_weather_by_coords(lat, lon)
        return jsonify(weather)

    elif location:
        # Validate city name using OpenWeatherMap Geo API
        geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={location}&limit=1&appid={OWM_KEY}"
        geo_resp = requests.get(geo_url)
        geo_data = geo_resp.json() if geo_resp.status_code == 200 else []
        if not geo_data:
            return jsonify({"error": "Invalid location. Please enter a real city, state, or country."})
        
        loc_data = geo_data[0]
        weather = fetch_weather_by_coords(loc_data["lat"], loc_data["lon"], loc_data)
        return jsonify(weather)

    else:
        return jsonify({"error": "No location or coordinates provided."})



@app.route("/autocomplete")
def autocomplete():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify([])

    url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={OWM_KEY}"
    resp = requests.get(url)
    if resp.status_code != 200:
        return jsonify([])

    data = resp.json()
    # Filter out invalid entries
    valid = []
    for loc in data:
        if loc.get("name") and loc.get("country"):
            valid.append({
                "name": loc["name"],
                "state": loc.get("state", ""),
                "country": loc["country"]
            })
    return jsonify(valid)


if __name__ == "__main__":
    app.run(debug=True)
