"""Pulso del café: los datos reales que pasan por las cintas de la página.

  · Carga FNC → precio interno de referencia de la Federación Nacional de
    Cafeteros (carga de 125 kg de pergamino seco). Se lee de sus páginas y de
    la hoja diaria en PDF que enlazan; gana la publicación más reciente.
  · Bolsa NY  → contrato C de arábica (ICE), en centavos de dólar por libra.
  · Dólar     → TRM certificada por la Superfinanciera (datos.gov.co).
  · Bogotá    → clima de hoy (Open-Meteo).

Cada fuente se lee por separado y con tiempo límite: si una falla, esa cifra
no sale (nunca se inventa) y las demás sí. "status" dice qué pasó con cada una.
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode, urljoin

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel
from pypdf import PdfReader

UA = "Mozilla/5.0 (compatible; AceroPressPulse/1.0; +https://www.aceropress.com)"
TIMEOUT = httpx.Timeout(5.0)
BOGOTA = timezone(timedelta(hours=-5))
BOGOTA_LAT, BOGOTA_LON = 4.711, -74.0721

# Páginas de la FNC que muestran el precio del día
FNC_PAGES = [
    "https://federaciondecafeteros.org/",
    "https://federaciondecafeteros.org/publicaciones/",
    "https://tolima.federaciondecafeteros.org/precio-delcafe/",
    "https://cauca.federaciondecafeteros.org/precio-delcafe/",
]
MAX_PDFS = 2

# pypdf avisa por cada PDF raro; aquí basta con saltarlo
logging.getLogger("pypdf").setLevel(logging.ERROR)

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


class Quote(BaseModel):
    value: float
    prev: float | None = None
    date: str | None = None


class Market(BaseModel):
    fnc: Quote | None = None
    ny: Quote | None = None
    trm: Quote | None = None


class Bogota(BaseModel):
    tempC: int
    code: int
    max: int | None = None
    min: int | None = None
    rainProb: int | None = None


class Pulse(BaseModel):
    updatedAt: str
    market: Market
    bogota: Bogota | None = None
    status: dict[str, str]


def today_bogota() -> date:
    return datetime.now(BOGOTA).date()


def describe(err: BaseException) -> str:
    """Motivo corto para "status": HTTP 403, tiempo agotado, …"""
    if isinstance(err, httpx.HTTPStatusError):
        return f"HTTP {err.response.status_code}"
    if isinstance(err, httpx.TimeoutException):
        return "tiempo agotado"
    return str(err) or type(err).__name__


def within(n: float | None, lo: float, hi: float) -> float | None:
    return n if n is not None and lo <= n <= hi else None


def num(s: str) -> float:
    """"2.160.000" → 2160000 · "305,60" → 305.6 · "3.238,88" / "3,238.88" → 3238.88"""
    t = s.strip()
    i = max(t.rfind(","), t.rfind("."))
    if i >= 0 and len(t) - i - 1 <= 2:
        return float(re.sub(r"[.,]", "", t[:i]) + "." + t[i + 1:])
    return float(re.sub(r"[.,]", "", t))


def find_date(text: str) -> str | None:
    """Fecha publicada cerca del precio: 2026-10-16 · 16/10/2026 · 16 de octubre de 2026 · octubre 16 de 2026"""
    word = r"([a-záéíóú]+)"
    patterns = [
        (r"(20\d{2})-(\d{2})-(\d{2})", lambda m: (m[1], m[2], m[3])),
        (r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b", lambda m: (m[3], m[2], m[1])),
        (rf"\b(\d{{1,2}})\s+de\s+{word}\s+(?:de|del)?\s*(20\d{{2}})", lambda m: (m[3], MONTHS.get(m[2].lower()), m[1])),
        (rf"\b{word}\s+(\d{{1,2}})\s*(?:de|del|,)?\s*(20\d{{2}})", lambda m: (m[3], MONTHS.get(m[1].lower()), m[2])),
    ]
    for pattern, pick in patterns:
        for m in re.finditer(pattern, text, re.I):
            y, mo, d = pick(m)
            if not mo:
                continue
            try:
                found = date(int(y), int(mo), int(d))
            except ValueError:
                continue
            age = (today_bogota() - found).days
            if -1 <= age < 45:
                return found.isoformat()
    return None


def parse_fnc_text(text: str) -> dict:
    """Lee el precio interno (y, si están, la bolsa y la tasa) del texto de una página o del PDF."""
    text = re.sub(r"\s+", " ", text)
    value, at = None, -1
    # "Precio interno" puede salir también en el menú: se prueba cada aparición
    for m in re.finditer(r"precio interno", text, re.I):
        price = re.search(r"(?:\$|cop)?\s*(\d{1,2}[.,]\d{3}[.,]\d{3})\b", text[m.start(): m.start() + 700], re.I)
        value = within(num(price[1]), 300_000, 20_000_000) if price else None
        if value:
            at = m.start()
            break
    if not value:
        raise ValueError("no se pudo leer el precio interno")
    ny = re.search(r"(?:bolsa de (?:ny|nueva york|new york)|contrato c(?: de)? nueva york)\D{0,60}?(\d{2,3}[.,]\d{1,2})\b", text, re.I)
    trm = re.search(r"tasa de cambio\D{0,40}?(\d{1,2}[.,]\d{3}(?:[.,]\d{1,2})?)\b", text, re.I)
    return {
        "value": value,
        "date": find_date(text[max(0, at - 400): at + 1000]),
        "ny": within(num(ny[1]), 50, 1000) if ny else None,
        "trm": within(num(trm[1]), 1500, 10000) if trm else None,
    }


async def _get(client: httpx.AsyncClient, url: str) -> httpx.Response:
    res = await client.get(url)
    res.raise_for_status()
    return res


async def read_fnc(client: httpx.AsyncClient) -> dict:
    pages = await asyncio.gather(*(_get(client, url) for url in FNC_PAGES), return_exceptions=True)
    readings, pdfs, errors = [], [], []
    for url, res in zip(FNC_PAGES, pages):
        if isinstance(res, Exception):
            errors.append(describe(res))
            continue
        soup = BeautifulSoup(res.text, "html.parser")
        for link in soup.select('a[href$=".pdf"]'):
            href = urljoin(url, link["href"])
            if "precio" in href.lower() and href not in pdfs:
                pdfs.append(href)
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        try:
            readings.append(parse_fnc_text(soup.get_text(" ")))
        except ValueError as err:
            errors.append(describe(err))

    # La hoja diaria en PDF es la publicación oficial
    sheets = await asyncio.gather(*(_get(client, url) for url in pdfs[:MAX_PDFS]), return_exceptions=True)
    for res in sheets:
        try:
            if isinstance(res, Exception):
                raise res
            reader = PdfReader(io.BytesIO(res.content))
            readings.append(parse_fnc_text(" ".join(page.extract_text() or "" for page in reader.pages[:2])))
        except Exception as err:  # noqa: BLE001 — un PDF raro no tumba el resto
            errors.append(describe(err))

    if not readings:
        raise ValueError(errors[0] if errors else "sin datos")
    return max(readings, key=lambda r: r["date"] or "")


async def read_ny(client: httpx.AsyncClient) -> Quote:
    j = (await _get(client, "https://query1.finance.yahoo.com/v8/finance/chart/KC=F?range=10d&interval=1d")).json()
    r = (j.get("chart", {}).get("result") or [{}])[0]
    closes = ((r.get("indicators", {}).get("quote") or [{}])[0]).get("close") or []
    pts = [(t, c) for t, c in zip(r.get("timestamp") or [], closes) if isinstance(c, (int, float))]
    if not pts:
        raise ValueError("sin cierres")
    t, value = pts[-1]
    if not within(value, 50, 1000):
        raise ValueError("cierre fuera de rango")
    prev = round(pts[-2][1], 2) if len(pts) > 1 else None
    return Quote(value=round(value, 2), prev=prev, date=datetime.fromtimestamp(t, BOGOTA).date().isoformat())


async def read_trm(client: httpx.AsyncClient) -> Quote:
    q = urlencode({
        "$select": "valor,vigenciadesde",
        "$where": f"vigenciadesde <= '{today_bogota().isoformat()}T00:00:00'",
        "$order": "vigenciadesde DESC",
        "$limit": "2",
    }).replace("+", "%20")
    rows = (await _get(client, f"https://www.datos.gov.co/resource/32sa-8pi3.json?{q}")).json()
    value = within(float(rows[0]["valor"]), 1500, 10000) if rows else None
    if not value:
        raise ValueError("sin TRM")
    prev = round(float(rows[1]["valor"]), 2) if len(rows) > 1 else None
    return Quote(value=round(value, 2), prev=prev, date=rows[0]["vigenciadesde"][:10])


async def read_bogota(client: httpx.AsyncClient) -> Bogota:
    q = urlencode({
        "latitude": BOGOTA_LAT,
        "longitude": BOGOTA_LON,
        "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "America/Bogota",
        "forecast_days": "1",
    })
    j = (await _get(client, f"https://api.open-meteo.com/v1/forecast?{q}")).json()
    cur, daily = j.get("current") or {}, j.get("daily") or {}
    if not isinstance(cur.get("temperature_2m"), (int, float)):
        raise ValueError("sin clima")
    first = lambda key: (daily.get(key) or [None])[0]  # noqa: E731
    rnd = lambda v: round(v) if isinstance(v, (int, float)) else None  # noqa: E731
    return Bogota(
        tempC=round(cur["temperature_2m"]),
        code=int(cur.get("weather_code") or 0),
        max=rnd(first("temperature_2m_max")),
        min=rnd(first("temperature_2m_min")),
        rainProb=rnd(first("precipitation_probability_max")),
    )


async def read_pulse(client: httpx.AsyncClient | None = None) -> Pulse:
    own = client is None
    client = client or httpx.AsyncClient(headers={"User-Agent": UA}, timeout=TIMEOUT, follow_redirects=True)
    try:
        fnc, ny, trm, bogota = await asyncio.gather(
            read_fnc(client), read_ny(client), read_trm(client), read_bogota(client), return_exceptions=True,
        )
    finally:
        if own:
            await client.aclose()

    ok = lambda r: None if isinstance(r, BaseException) else r  # noqa: E731
    f = ok(fnc)
    # La página de la FNC también trae la bolsa y la tasa: sirven de respaldo
    market = Market(
        fnc=Quote(value=f["value"], date=f["date"]) if f else None,
        ny=ok(ny) or (Quote(value=f["ny"], date=f["date"]) if f and f["ny"] else None),
        trm=ok(trm) or (Quote(value=f["trm"], date=f["date"]) if f and f["trm"] else None),
    )
    status = {
        k: "ok" if not isinstance(r, BaseException) else describe(r)
        for k, r in {"fnc": fnc, "ny": ny, "trm": trm, "bogota": bogota}.items()
    }
    return Pulse(
        updatedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        market=market,
        bogota=ok(bogota),
        status=status,
    )
