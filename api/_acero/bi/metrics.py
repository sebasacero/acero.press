"""Indicadores del Plan Micra, por nivel (estudio de mercado + plan de contenido).

  Norte    → tazas de especialidad vendidas por la red en la semana
  Red      → tinteros activos, tazas por hora, ingreso frente a su línea base
  Negocio  → ingresos, pedidos, kilos, recurrencia, suscripciones, meta
  Redes    → alcance, guardados + compartidos, seguidores, contenido programado
  Mercado  → carga FNC, Bolsa NY, TRM y clima (del pulso)

Todo es cálculo puro sobre la foto del negocio (Snapshot): se puede probar sin
red. Si un dato no existe, el indicador queda "nodata" y no se inventa.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel

from ..pulse import BOGOTA
from .snapshot import Snapshot

Status = Literal["ok", "warn", "alert", "nodata", "info"]
SOLD = {"confirmed", "completed"}
ACTIVE_STAGES = {"piloto", "activo"}
CUP_MAX_GRAMS = 30  # una presentación de hasta 30 g es una taza (el sachet de 18 g)
TARGET_UPLIFT_PCT = 50  # estudio: a $3.500+ con clientes nuevos el tintero gana +50–86 %
TARGET_PRICE = 3500


class Kpi(BaseModel):
    id: str
    label: str
    value: float | None = None
    prev: float | None = None
    unit: Literal["n", "cop", "pct", "kg", "per_h", "cents_lb", "c"] = "n"
    delta_pct: float | None = None
    target: float | None = None
    status: Status = "info"
    note: str | None = None


class Level(BaseModel):
    id: str
    label: str
    kpis: list[Kpi]


class Scorecard(BaseModel):
    north: Kpi
    levels: list[Level]


# ── utilidades ───────────────────────────────────────────────────────────
def to_day(ts: str | None) -> date | None:
    if not ts:
        return None
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(BOGOTA).date()


def order_day(o: dict) -> date | None:
    return to_day(o.get("closed_at") or o.get("created_at"))


def grams(label: str | None) -> float | None:
    """'18G' → 18 · '250G' → 250 · '1KG' → 1000 · 'UNIDAD' → None"""
    m = re.match(r"^\s*(\d+(?:[.,]\d+)?)\s*(kg|g)\b", (label or "").lower())
    if not m:
        return None
    n = float(m[1].replace(",", "."))
    return n * 1000 if m[2] == "kg" else n


def delta(cur: float | None, prev: float | None) -> float | None:
    if cur is None or not prev:
        return None
    return round((cur - prev) / prev * 100, 1)


class Weeks:
    """Semana actual (hoy y los 6 días anteriores) y la anterior."""

    def __init__(self, now: datetime):
        self.today = now.astimezone(BOGOTA).date()
        self.cur = (self.today - timedelta(days=6), self.today)
        self.prev = (self.today - timedelta(days=13), self.today - timedelta(days=7))

    @staticmethod
    def has(span: tuple[date, date], d: date | None) -> bool:
        return d is not None and span[0] <= d <= span[1]


# ── por nivel ────────────────────────────────────────────────────────────
def sold_items(s: Snapshot) -> list[tuple[date | None, dict]]:
    out = []
    for it in s.items:
        o = it.get("orders") or {}
        if o.get("status") in SOLD:
            out.append((order_day(o), it))
    return out


def cups_from_orders(s: Snapshot, span) -> int:
    return sum(
        int(it.get("qty") or 0)
        for d, it in sold_items(s)
        if Weeks.has(span, d) and (grams(it.get("variant_label_snapshot")) or 999) <= CUP_MAX_GRAMS
    )


def network_days(s: Snapshot, span) -> list[dict]:
    return [d for d in s.tintero_days if Weeks.has(span, date.fromisoformat(d["day"]))]


def north_star(s: Snapshot, w: Weeks) -> Kpi:
    cur = cups_from_orders(s, w.cur) + sum(int(d.get("cups_specialty") or 0) for d in network_days(s, w.cur))
    prev = cups_from_orders(s, w.prev) + sum(int(d.get("cups_specialty") or 0) for d in network_days(s, w.prev))
    d = delta(cur, prev)
    return Kpi(
        id="cups_week", label="Tazas de especialidad esta semana", value=cur, prev=prev, delta_pct=d,
        status="nodata" if cur == 0 and prev == 0 else ("alert" if d is not None and d < 0 else "ok"),
        note="Barra y sachets (Micra, POS, web) más lo que registran los tinteros.",
    )


def network_level(s: Snapshot, w: Weeks) -> Level:
    if s.tinteros is None:
        note = "Faltan las tablas de la red de tinteros."
        return Level(id="red", label="Red de tinteros", kpis=[Kpi(id="tinteros_active", label="Tinteros activos", status="nodata", note=note)])

    cur, prev = network_days(s, w.cur), network_days(s, w.prev)
    staged = {t["id"] for t in s.tinteros if t.get("stage") in ACTIVE_STAGES}
    active = {d["tintero_id"] for d in cur if d["tintero_id"] in staged}
    active_prev = {d["tintero_id"] for d in prev if d["tintero_id"] in staged}
    prospects = sum(1 for t in s.tinteros if t.get("stage") == "prospecto") + len(s.waitlist_baristas)

    hours = sum(float(d.get("hours") or 0) for d in cur if d.get("hours"))
    cups_h = sum(int(d.get("cups_specialty") or 0) for d in cur if d.get("hours"))
    per_hour = round(cups_h / hours, 1) if hours else None

    # Ingreso frente a la línea base: promedio por tintero con base registrada
    base = {t["id"]: float(t["baseline_income"]) for t in s.tinteros if t.get("baseline_income")}
    uplifts = []
    for tid, b in base.items():
        incomes = [float(d["net_income"]) for d in cur if d["tintero_id"] == tid and d.get("net_income") is not None]
        if incomes and b:
            uplifts.append((sum(incomes) / len(incomes) - b) / b * 100)
    uplift = round(sum(uplifts) / len(uplifts), 1) if uplifts else None

    prices = [float(d["price_specialty"]) for d in cur if d.get("price_specialty")]
    price = round(sum(prices) / len(prices)) if prices else None

    return Level(id="red", label="Red de tinteros", kpis=[
        Kpi(id="tinteros_active", label="Tinteros activos (con registro esta semana)", value=len(active), prev=len(active_prev),
            delta_pct=delta(len(active), len(active_prev)), status="nodata" if not s.tinteros else ("ok" if active else "warn")),
        Kpi(id="prospects", label="Prospectos (tinteros y baristas en lista)", value=prospects, status="info"),
        Kpi(id="cups_per_hour", label="Tazas especiales por hora", value=per_hour, unit="per_h",
            status="nodata" if per_hour is None else "info", note="Promedio del turno; en el pico, con AeroPress se sostienen 20–30 tazas/h."),
        Kpi(id="income_uplift", label="Ingreso del tintero vs. su base", value=uplift, unit="pct", target=TARGET_UPLIFT_PCT,
            status="nodata" if uplift is None else ("ok" if uplift >= TARGET_UPLIFT_PCT else "alert" if uplift < 0 else "warn")),
        Kpi(id="price_specialty", label="Precio promedio de la taza especial", value=price, unit="cop", target=TARGET_PRICE,
            status="nodata" if price is None else ("ok" if price >= TARGET_PRICE else "warn"),
            note="Estudio: a $3.000 el tintero gana +4 %; a $3.500+ con clientes nuevos, +50–86 %."),
    ])


def business_level(s: Snapshot, w: Weeks) -> Level:
    sold = [o for o in s.orders if o.get("status") in SOLD]
    rev = lambda span: sum(float(o.get("total") or 0) for o in sold if Weeks.has(span, order_day(o)))  # noqa: E731
    count = lambda span: sum(1 for o in sold if Weeks.has(span, order_day(o)))  # noqa: E731
    revenue, revenue_prev = rev(w.cur), rev(w.prev)
    d_rev = delta(revenue, revenue_prev)
    drop_threshold = s.config.get("sales_velocity", -10)

    last30 = (w.today - timedelta(days=29), w.today)
    sold30 = [o for o in sold if Weeks.has(last30, order_day(o))]
    ticket = round(sum(float(o.get("total") or 0) for o in sold30) / len(sold30)) if sold30 else None

    kg = lambda span: sum(  # noqa: E731
        (grams(it.get("variant_label_snapshot")) or 0) * int(it.get("qty") or 0)
        for d, it in sold_items(s) if Weeks.has(span, d)
    ) / 1000
    kg_cur, kg_prev = round(kg(w.cur), 2), round(kg(w.prev), 2)

    # Recurrencia: clientes (cuenta o teléfono) con 2+ compras en 90 días
    buys: dict[str, int] = {}
    for o in sold:
        who = o.get("customer_id") or o.get("customer_phone")
        if who:
            buys[who] = buys.get(who, 0) + 1
    repeat = round(sum(1 for n in buys.values() if n > 1) / len(buys) * 100, 1) if buys else None
    repeat_target = s.config.get("repeat_customer_rate", 20)

    subs = sum(1 for c in s.customers if c.get("monthly_subscription"))
    pending = sum(1 for o in s.orders if o.get("status") == "pending")
    goal_pct = round(s.sales_total / s.sales_goal * 100, 3) if s.sales_goal and s.sales_total is not None else None

    return Level(id="negocio", label="Negocio", kpis=[
        Kpi(id="revenue_week", label="Ingresos de la semana", value=revenue, prev=revenue_prev, unit="cop", delta_pct=d_rev,
            status="nodata" if not revenue and not revenue_prev else ("alert" if d_rev is not None and d_rev <= drop_threshold else "ok")),
        Kpi(id="orders_week", label="Pedidos vendidos en la semana", value=count(w.cur), prev=count(w.prev), delta_pct=delta(count(w.cur), count(w.prev))),
        Kpi(id="ticket_30d", label="Ticket promedio (30 días)", value=ticket, unit="cop", status="nodata" if ticket is None else "info"),
        Kpi(id="kg_week", label="Café vendido en la semana", value=kg_cur, prev=kg_prev, unit="kg", delta_pct=delta(kg_cur, kg_prev),
            note="Kilos que se le compran al tostador aliado."),
        Kpi(id="repeat_rate", label="Clientes que repiten (90 días)", value=repeat, unit="pct", target=repeat_target,
            status="nodata" if repeat is None else ("ok" if repeat >= repeat_target else "warn")),
        Kpi(id="subscriptions", label="Suscripciones mensuales", value=subs),
        Kpi(id="pending_orders", label="Pedidos pendientes por confirmar", value=pending, status="alert" if pending else "ok"),
        Kpi(id="goal_progress", label="Avance hacia la meta de ventas", value=goal_pct, unit="pct", target=100,
            status="nodata" if goal_pct is None else "info"),
    ])


def engagement(m: dict) -> int:
    return int(m.get("saved") or 0) + int(m.get("shares") or 0)


def social_level(s: Snapshot, w: Weeks) -> Level:
    posts = lambda span: [m for m in s.ig_media if Weeks.has(span, to_day(m.get("posted_at")))]  # noqa: E731
    cur, prev = posts(w.cur), posts(w.prev)
    reach = sum(int(m.get("reach") or 0) for m in cur)
    reach_prev = sum(int(m.get("reach") or 0) for m in prev)
    eng = round(sum(map(engagement, cur)) / len(cur), 1) if cur else None
    eng_prev = round(sum(map(engagement, prev)) / len(prev), 1) if prev else None

    followers = [f for f in s.ig_daily if f.get("followers_count") is not None]
    last = followers[0]["followers_count"] if followers else None
    week_ago = next((f["followers_count"] for f in followers if date.fromisoformat(f["day"]) <= w.today - timedelta(days=7)), None)

    ahead = w.today + timedelta(days=7)
    scheduled = sum(
        1 for p in s.publications
        if not p.get("published") and (d := to_day(p.get("scheduled_at"))) and w.today <= d <= ahead
    )
    no_ig = not s.ig_media
    return Level(id="redes", label="Redes", kpis=[
        Kpi(id="reach_week", label="Alcance de lo publicado esta semana", value=None if no_ig else reach, prev=None if no_ig else reach_prev,
            delta_pct=delta(reach, reach_prev), status="nodata" if no_ig else "info"),
        Kpi(id="saves_shares", label="Guardados + compartidos por publicación", value=eng, prev=eng_prev, delta_pct=delta(eng, eng_prev),
            status="nodata" if eng is None else "info", note="Pesan más que los likes: dicen si el contenido sirve."),
        Kpi(id="followers", label="Seguidores en Instagram", value=last, prev=week_ago,
            delta_pct=delta(last, week_ago), status="nodata" if last is None else "info"),
        Kpi(id="scheduled_7d", label="Publicaciones programadas (7 días)", value=scheduled, status="ok" if scheduled >= 3 else "warn"),
    ])


def market_level(s: Snapshot) -> Level:
    p = s.pulse
    m = p.market if p else None
    b = p.bogota if p else None
    q = lambda x: (x.value if x else None, x.prev if x else None)  # noqa: E731
    fnc, (ny, ny_prev), (trm, trm_prev) = (m.fnc if m else None), q(m.ny if m else None), q(m.trm if m else None)
    return Level(id="mercado", label="Mercado", kpis=[
        Kpi(id="fnc", label="Carga FNC (125 kg)", value=fnc.value if fnc else None, unit="cop",
            status="nodata" if not fnc else "info", note=f"Al {fnc.date}" if fnc and fnc.date else None),
        Kpi(id="ny", label="Bolsa NY (contrato C)", value=ny, prev=ny_prev, unit="cents_lb", delta_pct=delta(ny, ny_prev),
            status="nodata" if ny is None else "info"),
        Kpi(id="trm", label="Dólar (TRM)", value=trm, prev=trm_prev, unit="cop", delta_pct=delta(trm, trm_prev),
            status="nodata" if trm is None else "info"),
        Kpi(id="weather", label="Bogotá ahora", value=b.tempC if b else None, unit="c",
            status="nodata" if not b else "info", note=f"Lluvia {b.rainProb} %" if b and b.rainProb is not None else None),
    ])


def scorecard(s: Snapshot) -> Scorecard:
    w = Weeks(s.now)
    return Scorecard(
        north=north_star(s, w),
        levels=[network_level(s, w), business_level(s, w), social_level(s, w), market_level(s)],
    )
