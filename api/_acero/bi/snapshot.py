"""Foto del negocio: todo lo que el algoritmo necesita, leído de una vez.

Cada lectura va por separado: si una tabla falta o falla, queda en "missing"
y el algoritmo sigue con lo demás (y dice qué no pudo medir).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from ..pulse import BOGOTA, Pulse, read_pulse
from .supabase import Supabase, SupabaseError

ORDERS_DAYS = 90  # recurrencia en 90 días; ventas y tendencias en las últimas semanas


@dataclass
class Snapshot:
    now: datetime
    orders: list[dict] = field(default_factory=list)
    items: list[dict] = field(default_factory=list)
    inventory: list[dict] = field(default_factory=list)
    customers: list[dict] = field(default_factory=list)
    ig_media: list[dict] = field(default_factory=list)
    ig_daily: list[dict] = field(default_factory=list)
    publications: list[dict] = field(default_factory=list)
    config: dict[str, float] = field(default_factory=dict)
    sales_goal: float | None = None
    sales_total: float | None = None
    waitlist_baristas: list[dict] = field(default_factory=list)
    tinteros: list[dict] | None = None  # None: la red aún no tiene tablas
    tintero_days: list[dict] = field(default_factory=list)
    pulse: Pulse | None = None
    missing: list[str] = field(default_factory=list)


async def load_snapshot(sb: Supabase, *, now: datetime | None = None, with_pulse: bool = True) -> Snapshot:
    now = now or datetime.now(BOGOTA)
    since = (now - timedelta(days=ORDERS_DAYS)).isoformat()
    since30 = (now - timedelta(days=30)).date().isoformat()

    reads = {
        "orders": sb.select("orders", {
            "select": "id,source,status,total,created_at,closed_at,customer_id,customer_phone",
            "created_at": f"gte.{since}",
        }),
        "items": sb.select("order_items", {
            "select": "qty,subtotal,product_name_snapshot,variant_label_snapshot,orders!inner(status,created_at,closed_at,source)",
            "orders.created_at": f"gte.{since}",
        }),
        "inventory": sb.select("inventory", {
            "select": "stock_qty,low_stock_threshold,product_variants(label,active,products(name,category,active))",
        }),
        "customers": sb.select("customers", {"select": "id,monthly_subscription,created_at"}),
        "ig_media": sb.select("ig_media", {
            "select": "id,media_product,caption,permalink,posted_at,reach,views,saved,shares,like_count,comments_count",
            "order": "posted_at.desc", "limit": "60",
        }),
        "ig_daily": sb.select("ig_account_daily", {"select": "day,followers_count", "order": "day.desc", "limit": "35"}),
        "publications": sb.select("publications", {
            "select": "id,scheduled_at,published,media_kind,created_at", "order": "created_at.desc", "limit": "60",
        }),
        "config": sb.select("growth_algorithm_config", {"select": "metric,threshold"}),
        "goal": sb.select("app_config", {"select": "value", "key": "eq.sales_goal"}),
        "sales_total": sb.rpc("get_sales_counts"),
        "waitlist": sb.select("app_waitlist", {"select": "id,zone,has_aeropress,created_at", "role": "eq.barista"}),
        "tinteros": sb.select("tinteros", {"select": "*", "order": "created_at.asc"}),
        "tintero_days": sb.select("tintero_days", {"select": "*", "day": f"gte.{since30}"}),
    }
    if with_pulse:
        reads["pulse"] = read_pulse()

    results = dict(zip(reads, await asyncio.gather(*reads.values(), return_exceptions=True)))
    snap = Snapshot(now=now)

    def take(key, default=None):
        r = results.get(key)
        if isinstance(r, BaseException):
            missing_table = isinstance(r, SupabaseError) and r.missing_table
            snap.missing.append(f"{key}: {'falta la tabla' if missing_table else str(r)[:120]}")
            return default
        return r

    snap.orders = take("orders", [])
    snap.items = take("items", [])
    snap.inventory = take("inventory", [])
    snap.customers = take("customers", [])
    snap.ig_media = take("ig_media", [])
    snap.ig_daily = take("ig_daily", [])
    snap.publications = take("publications", [])
    snap.config = {c["metric"]: float(c["threshold"]) for c in take("config", []) if c.get("threshold") is not None}
    goal = take("goal", [])
    snap.sales_goal = float(goal[0]["value"]) if goal and str(goal[0].get("value", "")).replace(".", "", 1).isdigit() else None
    totals = take("sales_total", None)
    snap.sales_total = sum(float(r.get("total_amount") or 0) for r in totals) if isinstance(totals, list) else None
    snap.waitlist_baristas = take("waitlist", [])
    snap.tinteros = take("tinteros", None)
    snap.tintero_days = take("tintero_days", []) if snap.tinteros is not None else []
    snap.pulse = take("pulse", None) if with_pulse else None
    return snap
