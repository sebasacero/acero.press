"""Recolección diaria del mercado del café (la corre el cron de Vercel).

Lee el mismo pulso que las cintas (`pulse.read_pulse`: precio interno de la FNC,
contrato C de Nueva York y TRM) y lo guarda:

  · `coffee_market_daily`: una fila por cifra y día publicado, para tener la serie
    (hoy el pulso solo se ve en vivo y no queda historia).
  · `app_config` `micra_precio_*`: el precio de Hoy en la app Micra, que hasta
    ahora el equipo escribía a mano y está vacío.

Reglas: solo se guarda lo que trae fecha publicada (nunca se inventa el día), y
el precio de Hoy no pisa uno que el equipo haya puesto con una fecha más nueva.
Las fuentes son públicas y se leen una vez al día con un User-Agent que dice quiénes somos.
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

import httpx

from .pulse import FNC_PAGES, Pulse, read_pulse, today_bogota

PRICE_KEYS = ["micra_precio_carga", "micra_precio_ny", "micra_precio_fecha", "micra_precio_carga_ant", "micra_precio_ny_ant"]

# Cifra → unidad y de dónde sale (lo que queda en cada fila de la serie)
METRICS = {
    "fnc_carga": ("COP por carga de 125 kg de pergamino seco", "fnc", FNC_PAGES[0]),
    "ny_c": ("centavos de US$ por libra (contrato C, ICE)", "ice", "https://finance.yahoo.com/quote/KC=F/"),
    "trm": ("COP por US$ (TRM)", "datos.gov.co", "https://www.datos.gov.co/resource/32sa-8pi3.json"),
}


def series_rows(pulse: Pulse, fetched_at: str) -> list[dict]:
    """Las filas de `coffee_market_daily`: solo cifras con su fecha publicada."""
    quotes = {"fnc_carga": pulse.market.fnc, "ny_c": pulse.market.ny, "trm": pulse.market.trm}
    rows = []
    for metric, q in quotes.items():
        if not q or not q.date or not q.value:
            continue
        unit, source, url = METRICS[metric]
        rows.append({"metric": metric, "day": q.date, "value": q.value, "unit": unit, "source": source, "source_url": url, "fetched_at": fetched_at})
    return rows


def _plain(n: float) -> str:
    """2020000.0 → "2020000" · 2.8 → "2.8" (lo que lee `readPrices` en feed.js)."""
    return str(int(n)) if float(n).is_integer() else f"{n:.2f}".rstrip("0")


def config_rows(pulse: Pulse, cfg: dict) -> list[dict]:
    """Igual que `priceRows` de feed.js, con la fecha que publicó la FNC.

    Nada si no hay precio FNC con fecha, o si el equipo ya guardó una fecha más nueva.
    El mismo día se vuelve a escribir sin mover el «anterior» (la flechita).
    """
    fnc = pulse.market.fnc
    if not fnc or not fnc.date:
        return []
    current = (cfg.get("micra_precio_fecha") or "").strip()
    if current and current > fnc.date:
        return []
    ny = pulse.market.ny
    carga, ny_usd = _plain(fnc.value), _plain(round(ny.value / 100, 2)) if ny and ny.value else ""
    same = current == fnc.date
    prev_carga = cfg.get("micra_precio_carga_ant") if same else cfg.get("micra_precio_carga")
    prev_ny = cfg.get("micra_precio_ny_ant") if same else cfg.get("micra_precio_ny")
    pairs = [
        ("micra_precio_carga", carga), ("micra_precio_ny", ny_usd or cfg.get("micra_precio_ny") or ""), ("micra_precio_fecha", fnc.date),
        ("micra_precio_carga_ant", prev_carga), ("micra_precio_ny_ant", prev_ny),
    ]
    return [{"key": k, "value": str(v or "").strip()} for k, v in pairs if not k.endswith("_ant") or str(v or "").strip()]


def authorized(header: str | None, secret: str | None) -> bool:
    """Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`; sin secreto no corre."""
    if not secret:
        return False
    return hmac.compare_digest((header or "").encode(), f"Bearer {secret}".encode())


def _env(name: str) -> str:
    return os.environ.get(name, "").strip().strip("\"'").strip()


class ServiceStore:
    """PostgREST con la llave de servicio: solo en el servidor, solo para este cron."""

    def __init__(self, http: httpx.AsyncClient):
        self.url = (_env("SUPABASE_URL") or _env("VITE_SUPABASE_URL")).rstrip("/")
        key = _env("SUPABASE_SERVICE_ROLE_KEY")
        if not self.url.startswith("https://") or not key:
            raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.")
        self.http = http
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    async def _req(self, method: str, path: str, **kw):
        res = await self.http.request(method, f"{self.url}/rest/v1/{path}", headers={**self.headers, **kw.pop("headers", {})}, **kw)
        if res.status_code >= 400:
            raise RuntimeError(f"{path}: HTTP {res.status_code} {res.text[:200]}")
        return res.json() if res.content else None

    async def config(self) -> dict:
        rows = await self._req("GET", "app_config", params={"select": "key,value", "key": f"in.({','.join(PRICE_KEYS)})"})
        return {r["key"]: r["value"] for r in rows or []}

    async def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if rows:
            await self._req("POST", table, params={"on_conflict": on_conflict}, json=rows, headers={"Prefer": "resolution=merge-duplicates,return=minimal"})

    async def log(self, entry: dict) -> None:
        await self._req("POST", "coffee_collect_log", json=entry, headers={"Prefer": "return=minimal"})


async def collect() -> dict:
    """Lee el pulso y lo guarda. Devuelve qué se guardó y el estado de cada fuente."""
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as http:
        store = ServiceStore(http)
        pulse = await read_pulse()
        series = series_rows(pulse, fetched_at)
        await store.upsert("coffee_market_daily", series, "metric,day")
        prices = config_rows(pulse, await store.config())
        await store.upsert("app_config", prices, "key")
        summary = {
            "ran_at": fetched_at,
            "today": today_bogota().isoformat(),
            "saved": [f"{r['metric']} {r['day']}" for r in series],
            "hoy_price": next((r["value"] for r in prices if r["key"] == "micra_precio_carga"), None),
            "status": pulse.status,
        }
        await store.log({"ran_at": fetched_at, "status": pulse.status, "saved": len(series), "hoy_updated": bool(prices)})
        return summary
