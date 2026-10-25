"""PDF exports remain readable, linked, validated, and independent of weather access."""
from datetime import date, timedelta
from io import BytesIO
import unittest
from unittest.mock import patch
from urllib.parse import urlparse

from pypdf import PdfReader
import app as weather_app


def payload(days=1):
    return {"unit": "c", "plan": {"city": "Dubai, AE", "pace": "full", "days": [
        {"date": (date(2026, 10, 25) + timedelta(days=i)).isoformat(), "title": f"Discover the city - day {i + 1}",
         "note": "🌤️ A flexible mix of exploring and breaks.",
         "forecast": {"max_c": 30, "min_c": 20, "rain_chance": 20, "partial": False},
         "stops": [{"title": title, "description": "Explore at your own pace, with a break nearby."}
                   for title in ("Al Fahidi Historical Neighbourhood", "Al Shindagha Museum", "Dubai Creek")]}
        for i in range(days)
    ]}}


class ItineraryPDFTests(unittest.TestCase):
    def setUp(self):
        self.client = weather_app.app.test_client()

    def test_download_is_a_pdf_attachment_without_calling_weather(self):
        with patch.object(weather_app, "provider_get") as provider:
            response = self.client.post("/download_itinerary", json=payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/pdf")
        self.assertTrue(response.data.startswith(b"%PDF-"))
        self.assertIn('attachment;', response.headers["Content-Disposition"])
        self.assertIn('.pdf', response.headers["Content-Disposition"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        provider.assert_not_called()
        pdf = PdfReader(BytesIO(response.data))
        self.assertEqual(len(pdf.pages), 1)
        text = pdf.pages[0].extract_text()
        for expected in ("WORLD WEATHER HUB", "Dubai, AE", "MORNING", "AFTERNOON", "EVENING", "Saima Usman", "30°C"):
            self.assertIn(expected, text)

    def test_five_day_plan_has_complete_days_and_safe_clickable_maps(self):
        response = self.client.post("/download_itinerary", json=payload(5))
        pdf = PdfReader(BytesIO(response.data))
        self.assertEqual(len(pdf.pages), 5)
        for index, page in enumerate(pdf.pages):
            text = page.extract_text()
            self.assertIn(f"DAY {index + 1}", text)
            self.assertIn(f"Page {index + 1}", text)
            self.assertIn("Dubai Creek", text)
            links = [annotation.get_object()["/A"]["/URI"] for annotation in page.get("/Annots", [])]
            self.assertEqual(len(links), 3)
            self.assertTrue(all(urlparse(link).hostname == "www.google.com" for link in links))

    def test_units_accents_and_markup_are_preserved_as_text(self):
        body = payload()
        body["unit"] = "f"
        body["plan"]["city"] = "Café <test> & Paris"
        body["plan"]["days"][0]["stops"][0]["title"] = '<b>Not markup</b> & café'
        response = self.client.post("/download_itinerary", json=body)
        self.assertEqual(response.status_code, 200)
        text = PdfReader(BytesIO(response.data)).pages[0].extract_text()
        self.assertIn("86°F", text)
        self.assertIn("Café <test> & Paris", text)
        self.assertIn("<b>Not markup</b> & café", text)

    def test_unavailable_forecast_is_not_fabricated(self):
        body = payload()
        body["plan"]["days"][0]["forecast"] = None
        body["plan"]["days"][0]["note"] = "No forecast for this date yet. Recheck closer to travel."
        response = self.client.post("/download_itinerary", json=body)
        text = PdfReader(BytesIO(response.data)).pages[0].extract_text()
        self.assertIn("No forecast for this date yet", text)
        self.assertNotIn("Rain chance up to", text)

    def test_malformed_export_requests_return_json_errors(self):
        invalid = [None, [], {}, {"plan": {"city": "Dubai"}}]
        for field, value in [("city", "x" * 121), ("pace", "bad"), ("days", [])]:
            body = payload()
            body["plan"][field] = value
            invalid.append(body)
        for field, value in [("date", "not a date"), ("stops", []), ("forecast", {"max_c": float("inf"), "min_c": 0, "rain_chance": 5})]:
            body = payload()
            body["plan"]["days"][0][field] = value
            invalid.append(body)
        for body in invalid:
            with self.subTest(body=body):
                response = self.client.post("/download_itinerary", json=body) if body is not None else self.client.post("/download_itinerary", data="null", content_type="application/json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)


if __name__ == "__main__":
    unittest.main()
