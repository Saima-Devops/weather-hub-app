"""Validate and render itinerary downloads as PDFs, entirely in memory."""
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from xml.sax.saxutils import escape
import re

import reportlab
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)

FONT_DIR = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("HubRegular", str(FONT_DIR / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("HubBold", str(FONT_DIR / "VeraBd.ttf")))
INK = colors.HexColor("#272027")
ORANGE = colors.HexColor("#9b380d")
MUTED = colors.HexColor("#68606a")
PALE = colors.HexColor("#fff3e9")


def text(value, maximum, field):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"Invalid itinerary {field}.")
    return value.strip()


def validate_plan(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("plan"), dict):
        raise ValueError("Send an itinerary to download.")
    plan = payload["plan"]
    unit = payload.get("unit", "c")
    if unit not in ("c", "f"):
        raise ValueError("Invalid temperature unit.")
    text(plan.get("city"), 120, "destination")
    if plan.get("pace") not in ("relaxed", "full"):
        raise ValueError("Invalid itinerary pace.")
    days = plan.get("days")
    if not isinstance(days, list) or not 1 <= len(days) <= 5:
        raise ValueError("An itinerary must contain 1 to 5 days.")
    for day in days:
        if not isinstance(day, dict):
            raise ValueError("Invalid itinerary day.")
        try:
            date.fromisoformat(day.get("date", ""))
        except (ValueError, TypeError):
            raise ValueError("Invalid itinerary date.") from None
        text(day.get("title"), 160, "day title")
        text(day.get("note"), 400, "weather note")
        stops = day.get("stops")
        if not isinstance(stops, list) or len(stops) != 3:
            raise ValueError("Each itinerary day needs three activity periods.")
        for stop in stops:
            if not isinstance(stop, dict):
                raise ValueError("Invalid itinerary activity.")
            text(stop.get("title"), 160, "activity title")
            text(stop.get("description"), 600, "activity description")
            if stop.get("query") is not None:
                text(stop["query"], 200, "map search")
        forecast = day.get("forecast")
        if forecast is not None:
            if not isinstance(forecast, dict):
                raise ValueError("Invalid itinerary forecast.")
            for key in ("max_c", "min_c", "rain_chance"):
                value = forecast.get(key)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not -150 <= value <= 150:
                    raise ValueError("Invalid itinerary forecast measurement.")
    return plan, unit


def clean(value):
    # PDF uses embedded text fonts; leave decorative emoji in the web interface.
    value = re.sub(r"[\U00010000-\U0010ffff\u2300-\u2bff\ufe0f\u200d]", "", value)
    return escape(value.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-").strip())


def render_itinerary_pdf(payload):
    plan, unit = validate_plan(payload)
    output = BytesIO()
    styles = {
        "kicker": ParagraphStyle("kicker", fontName="HubBold", fontSize=8, leading=12, textColor=ORANGE, spaceAfter=8),
        "title": ParagraphStyle("title", fontName="HubBold", fontSize=25, leading=33, textColor=INK, spaceAfter=8),
        "subtitle": ParagraphStyle("subtitle", fontName="HubRegular", fontSize=9, leading=15, textColor=MUTED),
        "day": ParagraphStyle("day", fontName="HubBold", fontSize=16, leading=23, textColor=INK, spaceAfter=6),
        "body": ParagraphStyle("body", fontName="HubRegular", fontSize=9, leading=15, textColor=INK),
        "stop": ParagraphStyle("stop", fontName="HubBold", fontSize=11, leading=17, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("small", fontName="HubRegular", fontSize=8, leading=13, textColor=MUTED),
        "time": ParagraphStyle("time", fontName="HubBold", fontSize=8, leading=14, textColor=ORANGE),
    }
    def paragraph(value, style="body"):
        return Paragraph(clean(value), styles[style])
    def page_chrome(canvas, doc):
        width, height = A4
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#141116"))
        canvas.rect(0, height - 88, width, 88, fill=1, stroke=0)
        icon = Path(__file__).parent / "static" / "icons" / "apple-touch-icon.png"
        if icon.exists():
            canvas.drawImage(str(icon), 40, height - 63, width=39, height=39, mask="auto")
        canvas.setFillColor(colors.HexColor("#ffac70"))
        canvas.setFont("HubBold", 8)
        canvas.drawString(91, height - 35, "WORLD WEATHER HUB")
        canvas.setFillColor(colors.white)
        canvas.setFont("HubRegular", 11)
        canvas.drawString(91, height - 54, "A little planning. A world to explore.")
        canvas.setStrokeColor(colors.HexColor("#d78651"))
        canvas.setLineWidth(0.5)
        canvas.line(42, 43, width - 42, 43)
        canvas.setFillColor(MUTED)
        canvas.setFont("HubRegular", 7)
        canvas.drawString(42, 28, f"© {date.today().year} World Weather Hub | Developed by Saima Usman")
        canvas.drawRightString(width - 42, 28, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        output, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=111, bottomMargin=61,
        title=f"{plan['city']} - World Weather Hub itinerary", author="Saima Usman",
        subject="Suggested travel itinerary", pageCompression=1,
    )
    story = []
    for index, day in enumerate(plan["days"]):
        if index:
            story.append(PageBreak())
        start = date.fromisoformat(day["date"])
        story.extend([
            paragraph(f"YOUR {len(plan['days'])}-DAY ESCAPE / DAY {index + 1}", "kicker"),
            paragraph(plan["city"], "title"),
            paragraph(f"{start.strftime('%A, %d %B %Y')} | {'Slow & easy' if plan['pace'] == 'relaxed' else 'Make the most of it'}", "subtitle"),
            Spacer(1, 20), paragraph(day["title"], "day"),
        ])
        forecast = day.get("forecast")
        if forecast:
            def degree(value):
                return f"{round(value * 9 / 5 + 32 if unit == 'f' else value)}°{unit.upper()}"
            summary = f"High {degree(forecast['max_c'])} / Low {degree(forecast['min_c'])} | Rain chance up to {round(forecast['rain_chance'])}%"
            if forecast.get("partial"):
                summary += " | Partial day"
            story.extend([paragraph(summary, "subtitle"), Spacer(1, 8)])
        note = Table([[paragraph(day["note"], "small")]], colWidths=[doc.width])
        note.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PALE),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#edc7ac")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.extend([note, Spacer(1, 20)])
        for slot, stop in enumerate(day["stops"]):
            query = f"{stop.get('query') or stop['title']}, {plan['city']}"
            url = "https://www.google.com/maps/search/?" + urlencode({"api": "1", "query": query})
            link = Paragraph(f'<link href="{escape(url, {chr(34): "&quot;"})}" color="#9b380d"><u>Explore this stop on Maps</u></link>', styles["small"])
            activity = [paragraph(stop["title"], "stop"), paragraph(stop["description"]), Spacer(1, 5), link]
            table = Table([[paragraph(("MORNING", "AFTERNOON", "EVENING")[slot], "time"), activity]], colWidths=[87, doc.width - 87])
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 17),
            ]))
            story.append(KeepTogether([table]))
        story.extend([
            Spacer(1, 8),
            paragraph("Suggested stops, not bookings. Check opening days, tickets and travel times. Forecasts can change; dates without a forecast are not predictions.", "small"),
        ])
    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)
    output.seek(0)
    return output, f"world-weather-hub-itinerary-{plan['days'][0]['date']}.pdf"
