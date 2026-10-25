"""Provider-free regression tests. Never load or send real credentials."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import Mock, patch

import requests

import app as weather_app


class FrozenDateTime(datetime):
    instant = datetime(2026, 10, 25, 10, tzinfo=timezone.utc)

    @classmethod
    def now(cls, tz=None):
        return cls.instant.astimezone(tz or timezone.utc)


def fixture(offset=14400):
    current = {
        "dt": int(FrozenDateTime.instant.timestamp()), "timezone": offset,
        "name": "Dubai", "sys": {"country": "AE"},
        "main": {"temp": 31.5, "feels_like": 34, "humidity": 42},
        "wind": {"speed": 5},
        "weather": [{"main": "Clear", "description": "clear sky", "icon": "01d"}],
    }
    forecasts = []
    for index in range(40):
        item = deepcopy(current)
        item.pop("timezone")
        item["dt"] += (index + 1) * 3 * 3600
        item["main"]["temp"] = 20 + index % 8
        item["main"]["temp_min"] = item["main"]["temp"] - 1
        item["main"]["temp_max"] = item["main"]["temp"] + 1
        item["pop"] = (index % 5) / 10
        forecasts.append(item)
    return current, {"list": forecasts, "city": {"name": "Dubai"}}


class WeatherTests(unittest.TestCase):
    def setUp(self):
        self.config = patch.dict(weather_app.app.config, TESTING=True, OWM_KEY="test-key-never-sent")
        self.config.start()
        self.addCleanup(self.config.stop)
        self.client = weather_app.app.test_client()
        self.clock = patch.object(weather_app, "datetime", FrozenDateTime)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        FrozenDateTime.instant = datetime(2026, 10, 25, 10, tzinfo=timezone.utc)

    def mock_provider(self, offset=14400):
        current, forecast = fixture(offset)
        def provider(path, **params):
            if path.endswith('/weather'):
                return current
            if path.endswith('/forecast'):
                return forecast
            return [{"name": "Dubai", "state": "Dubai", "country": "AE", "lat": 25.2, "lon": 55.3}]
        mock = patch.object(weather_app, 'provider_get', side_effect=provider)
        return mock, current, forecast

    def test_home_static_and_health(self):
        for path in ('/', '/health', '/static/css/style.css', '/static/js/app.js', '/static/js/trip-planner.js'):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_invalid_json_shapes_and_coordinate_values_never_call_provider(self):
        payloads = [None, [], 'Dubai', {}, {"location": 42}, {"location": " "},
                    {"location": "x" * 121}, {"lat": 25}, {"lat": True, "lon": 0},
                    {"lat": 91, "lon": 0}, {"lat": 0, "lon": -181},
                    {"lat": "25", "lon": 55}, {"lat": float('nan'), "lon": 1},
                    {"lat": 0, "lon": float('inf')}, {"lat": 10 ** 400, "lon": 0}]
        with patch.object(weather_app, 'provider_get') as provider:
            for payload in payloads:
                with self.subTest(payload=payload):
                    response = self.client.post('/get_weather', json=payload) if payload is not None else self.client.post('/get_weather', data='null', content_type='application/json')
                    self.assertEqual(response.status_code, 400)
                    self.assertIn('error', response.json)
            provider.assert_not_called()

    def test_invalid_content_and_large_body_have_json_errors(self):
        for body, expected in [('{bad', 400), ('x' * 17000, 413)]:
            response = self.client.post('/get_weather', data=body, content_type='application/json')
            self.assertEqual(response.status_code, expected)
            self.assertIn('error', response.json)

    def test_missing_key_fails_without_upstream_request(self):
        with patch.dict(weather_app.app.config, OWM_KEY=''), patch.object(weather_app.requests, 'get') as get:
            response = self.client.post('/get_weather', json={"lat": 0, "lon": 0})
            self.assertEqual(response.status_code, 503)
            get.assert_not_called()

    def test_transport_has_https_params_timeout_and_redacts_failures(self):
        for error, status in [(requests.Timeout('secret-url'), 504), (requests.ConnectionError('secret-url'), 502), (ValueError('secret-url'), 502)]:
            with self.subTest(error=type(error).__name__), patch.object(weather_app.requests, 'get', side_effect=error) as get:
                response = self.client.post('/get_weather', json={"lat": 0, "lon": 0})
                self.assertEqual(response.status_code, status)
                self.assertNotIn('secret', response.get_data(as_text=True))
                args, kwargs = get.call_args
                self.assertTrue(args[0].startswith('https://'))
                self.assertNotIn('appid=', args[0])
                self.assertEqual(kwargs['timeout'], (3.05, 10))
                self.assertEqual(kwargs['params']['lat'], 0)

    def test_provider_auth_rate_limit_and_http_failures(self):
        for status in (401, 403, 429, 500):
            with self.subTest(status=status):
                response = Mock(status_code=status)
                if status == 500:
                    response.raise_for_status.side_effect = requests.HTTPError('secret')
                with patch.object(weather_app.requests, 'get', return_value=response):
                    result = self.client.post('/get_weather', json={"lat": 0, "lon": 0})
                self.assertEqual(result.status_code, 502 if status == 500 else 503)
                self.assertNotIn('secret', result.get_data(as_text=True))

    def test_current_is_observation_forecasts_are_local_and_aggregated(self):
        mock, current, forecast = self.mock_provider()
        with mock:
            response = self.client.post('/get_weather', json={"location": "Dubai"})
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertEqual(data['current']['temp_c'], current['main']['temp'])
        self.assertNotEqual(data['current']['temp_c'], forecast['list'][0]['main']['temp'])
        self.assertEqual(data['current']['wind_kph'], 18)
        self.assertEqual(data['greeting'], 'Good afternoon')
        self.assertTrue(data['location']['localtime'].endswith('+04:00'))
        self.assertEqual(data['location']['region'], 'Dubai')
        self.assertEqual(len(data['hourly']), 8)
        self.assertEqual(len(data['daily']), 5)
        self.assertEqual(data['outlook']['title'], 'This evening')
        self.assertGreaterEqual(datetime.fromisoformat(data['outlook']['time']).hour, 18)
        for day in data['daily']:
            entries = [entry for entry in forecast['list'] if datetime.fromtimestamp(entry['dt'], timezone(timedelta(hours=4))).date().isoformat() == day['date']]
            self.assertEqual(day['min_c'], min(entry['main']['temp_min'] for entry in entries))
            self.assertEqual(day['max_c'], max(entry['main']['temp_max'] for entry in entries))
            self.assertEqual(day['rain_chance'], round(max(entry['pop'] for entry in entries) * 100))
        self.assertTrue(data['daily'][0]['partial'])

    def test_next_morning_uses_correct_date_across_timezone_offsets(self):
        for offset in (14400, -18000, 19800):
            for hour in (2, 14, 22):
                with self.subTest(offset=offset, hour=hour):
                    tz = timezone(timedelta(seconds=offset))
                    local_now = datetime(2026, 10, 25, hour, tzinfo=tz)
                    FrozenDateTime.instant = local_now.astimezone(timezone.utc)
                    mock, _, _ = self.mock_provider(offset)
                    with mock:
                        result = self.client.post('/get_weather', json={"lat": 1, "lon": 1}).json
                    outlook = datetime.fromisoformat(result['outlook']['time'])
                    morning = hour < 6 or hour >= 18
                    self.assertEqual(result['outlook']['title'], 'Next morning' if morning else 'This evening')
                    expected_date = local_now.date() + timedelta(days=1 if hour >= 18 else 0)
                    self.assertEqual(outlook.date(), expected_date)
                    self.assertGreaterEqual(outlook.hour, 6 if morning else 18)
                    self.assertLess(outlook.hour, 9 if morning else 21)

    def test_empty_or_malformed_forecast_returns_502(self):
        for malformed in ({'list': []}, {}, {'list': [{'dt': 1}]}, None):
            with self.subTest(malformed=malformed):
                current, _ = fixture()
                with patch.object(weather_app, 'provider_get', side_effect=[current, malformed]):
                    response = self.client.post('/get_weather', json={"lat": 0, "lon": 0})
                self.assertEqual(response.status_code, 502)

    def test_malformed_measurements_or_icon_return_502(self):
        for field, value in [("temp", float("nan")), ("temp", "hot"),
                             ("condition", None), ("icon", "<script>")]:
            with self.subTest(field=field, value=value):
                current, forecast = fixture()
                if field == "temp":
                    current["main"]["temp"] = value
                else:
                    current["weather"][0]["main" if field == "condition" else "icon"] = value
                with patch.object(weather_app, "provider_get", side_effect=[current, forecast]):
                    response = self.client.post("/get_weather", json={"lat": 0, "lon": 0})
                self.assertEqual(response.status_code, 502)

    def test_city_not_found_and_autocomplete_coordinates(self):
        with patch.object(weather_app, 'provider_get', return_value=[]):
            self.assertEqual(self.client.post('/get_weather', json={"location": "Atlantis"}).status_code, 404)
        mock, _, _ = self.mock_provider()
        with mock:
            response = self.client.get('/autocomplete?query=Du')
        self.assertEqual(response.json[0]['lat'], 25.2)
        self.assertEqual(response.json[0]['lon'], 55.3)
        with patch.object(weather_app, 'provider_get') as provider:
            self.assertEqual(self.client.get('/autocomplete?query=D').json, [])
            self.assertEqual(self.client.get('/autocomplete?query=' + 'x' * 121).status_code, 400)
            provider.assert_not_called()


if __name__ == '__main__':
    unittest.main()
