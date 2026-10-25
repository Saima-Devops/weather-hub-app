"""Check a running deployment without needing a live weather credential."""
import sys
from io import BytesIO
from pathlib import Path

import requests
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))
from test_itinerary_pdf import payload

base = sys.argv[1].rstrip("/")
response = requests.get(f"{base}/health", timeout=10)
response.raise_for_status()
assert response.json()["status"] == "ok"
for path in ("/", "/static/css/style.css", "/static/js/app.js", "/static/js/trip-planner.js", "/static/icons/weather-hub.svg"):
    response = requests.get(base + path, timeout=10)
    response.raise_for_status()
response = requests.post(f"{base}/download_itinerary", json=payload(), timeout=30)
response.raise_for_status()
assert response.headers["Content-Type"].startswith("application/pdf")
assert response.content.startswith(b"%PDF-")
pdf = PdfReader(BytesIO(response.content))
assert len(pdf.pages) == 1
assert "Saima Usman" in pdf.pages[0].extract_text()
print("Deployment smoke check passed: health, homepage, assets, and real PDF export.")
