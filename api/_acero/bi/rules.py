"""El algoritmo: de los indicadores a las acciones del día, en orden.

Cada regla mira la foto del negocio y su tablero, y devuelve una acción con
por qué (el dato), qué hacer y qué número vigilar para saber si funcionó; o
nada si no aplica. Las reglas salen del estudio de tinteros y del plan de
contenido. Para agregar una, escribe la función y súmala a RULES.
"""

from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta
from typing import Callable, Literal

from pydantic import BaseModel

from ..pulse import BOGOTA, Pulse
from .metrics import ACTIVE_STAGES, SOLD, TARGET_PRICE, Scorecard, Snapshot, Weeks, engagement, grams, sold_items, to_day

Area = Literal["operacion", "red", "negocio", "redes", "mercado"]


class Action(BaseModel):
    id: str
    priority: Literal[1, 2, 3]  # 1 hoy sin falta · 2 esta semana · 3 cuando se pueda
    area: Area
    title: str
    why: str
    do: str
    watch: str


def kpi(card: Scorecard, kid: str):
    for level in card.levels:
        for k in level.kpis:
            if k.id == kid:
                return k
    return card.north if card.north.id == kid else None


def cop(n: float) -> str:
    return "$" + f"{round(n):,}".replace(",", ".")


def pct(n: float) -> str:
    """Variación sin signo (el verbo ya dice si subió o bajó): 42,5 %"""
    return f"{abs(n):.1f} %".replace(".", ",")


def plural(n: float, one: str, many: str) -> str:
    return f"{int(n)} {one if int(n) == 1 else many}"


# ── reglas ──────────────────────────────────────────────────────────────
def pending_orders(s: Snapshot, card: Scorecard, w: Weeks):
    n = kpi(card, "pending_orders").value
    if n:
        return Action(id="pending_orders", priority=1, area="operacion", title=f"Confirma {plural(n, 'pedido pendiente', 'pedidos pendientes')}",
                      why="Un pedido sin confirmar es una venta que se puede perder.", do="Panel → Pedidos: confirma o cancela cada uno.",
                      watch="Pedidos pendientes en 0")


def sales_trend(s: Snapshot, card: Scorecard, w: Weeks):
    k = kpi(card, "revenue_week")
    if k.value == 0 and k.prev == 0:
        return Action(id="no_sales", priority=1, area="negocio", title="No hay ventas registradas en dos semanas",
                      why="Sin ventas registradas el algoritmo no puede medir nada.",
                      do="Registra cada venta de barra en Micra (también las de efectivo) y cada pedido de WhatsApp en el Panel.",
                      watch="Ingresos de la semana")
    if k.delta_pct is not None and k.delta_pct <= s.config.get("sales_velocity", -10):
        return Action(id="sales_drop", priority=1, area="negocio", title=f"Las ventas bajaron {pct(k.delta_pct)} frente a la semana pasada",
                      why=f"Semana: {cop(k.value)} · anterior: {cop(k.prev)}.",
                      do="Escríbeles por WhatsApp a quienes compraron en los últimos 60 días con la receta de la semana y un sachet de regalo en su próxima compra.",
                      watch="Ingresos de la semana")
    if k.delta_pct is not None and k.delta_pct >= 20:
        return Action(id="sales_up", priority=3, area="negocio", title=f"Las ventas subieron {pct(k.delta_pct)}",
                      why=f"Semana: {cop(k.value)} · anterior: {cop(k.prev)}.", do="Asegura café y sachets para no perder el impulso.",
                      watch="Ventas perdidas por falta de stock")


def stock(s: Snapshot, card: Scorecard, w: Weeks):
    rows = [r for r in s.inventory if (r.get("product_variants") or {}).get("active", True)]
    if not rows:
        return None
    zero = [r for r in rows if int(r.get("stock_qty") or 0) <= 0]
    if len(zero) >= len(rows) * 0.8:
        return Action(id="inventory_unset", priority=2, area="operacion", title=f"Carga el inventario real ({len(zero)} de {len(rows)} presentaciones en 0)",
                      why="Con todo en cero no se pueden calcular alertas de stock ni la rotación.",
                      do="Panel → Inventario: escribe lo que tienes hoy de cada presentación.", watch="Presentaciones con stock real")
    sold30 = {it.get("product_name_snapshot") for d, it in sold_items(s) if d and d >= w.today - timedelta(days=29)}
    low = [r for r in rows if int(r.get("stock_qty") or 0) <= int(r.get("low_stock_threshold") or 0)]
    hot = [r for r in low if ((r.get("product_variants") or {}).get("products") or {}).get("name") in sold30]
    if hot:
        names = ", ".join(f"{r['product_variants']['products']['name']} {r['product_variants']['label']}" for r in hot[:4])
        return Action(id="restock", priority=1, area="operacion", title="Repón lo que se está vendiendo", why=f"Stock bajo y con ventas en 30 días: {names}.",
                      do="Pide al tostador aliado antes del fin de semana.", watch="Presentaciones con stock bajo")


def top_variety(s: Snapshot, card: Scorecard, w: Weeks):
    qty: dict[str, int] = {}
    for d, it in sold_items(s):
        if d and d >= w.today - timedelta(days=29) and grams(it.get("variant_label_snapshot")):
            qty[it["product_name_snapshot"]] = qty.get(it["product_name_snapshot"], 0) + int(it.get("qty") or 0)
    if qty:
        name, n = max(qty.items(), key=lambda kv: kv[1])
        return Action(id="recipe_of_week", priority=2, area="redes", title=f"Receta de la semana con {name}",
                      why=f"Es el café más vendido de los últimos 30 días ({n} unidades).",
                      do=f"Graba con la cámara de Micra una receta campeona preparada con {name} (Reel) y ponla en la cinta de la página.",
                      watch=f"Ventas de {name} la próxima semana")


def network(s: Snapshot, card: Scorecard, w: Weeks):
    if s.tinteros is None:
        return Action(id="network_tables", priority=1, area="red", title="Activa la red de tinteros en la base de datos",
                      why="Sin las tablas de tinteros el algoritmo no puede medir la red, que es el centro del plan.",
                      do="Aprueba la migración «micra_tinteros», que crea las tablas de la red en Supabase.", watch="Tinteros registrados")
    staged = [t for t in s.tinteros if t.get("stage") in ACTIVE_STAGES]
    if not staged:
        baristas = len(s.waitlist_baristas)
        return Action(id="network_stage0", priority=1, area="red", title="Etapa 0: registra a los primeros tinteros",
                      why=f"La red aún no tiene tinteros en piloto. Hay {plural(len(s.tinteros), 'tintero registrado', 'tinteros registrados')} y {plural(baristas, 'barista', 'baristas')} en la lista de espera de Micra.",
                      do="Habla con 10 tinteros de Chapinero (calle 72 a 85) y anota su línea base: tintos al día e ingreso neto diario. Ofrece el kit en préstamo a los 4–6 del piloto.",
                      watch="Tinteros en piloto")


def tinteros_followup(s: Snapshot, card: Scorecard, w: Weeks):
    if not s.tinteros:
        return None
    by_id: dict[str, list[dict]] = {}
    for d in s.tintero_days:
        by_id.setdefault(d["tintero_id"], []).append(d)
    below, quiet = [], []
    for t in s.tinteros:
        if t.get("stage") not in ACTIVE_STAGES:
            continue
        days = sorted(by_id.get(t["id"], []), key=lambda d: d["day"], reverse=True)
        # Sin registro en 3 días (contando desde que entró, si aún no registra nada)
        last = date.fromisoformat(days[0]["day"]) if days else to_day(t.get("created_at"))
        if last and (w.today - last).days >= 3:
            quiet.append(t["name"])
        base = float(t["baseline_income"]) if t.get("baseline_income") else None
        recent = [float(d["net_income"]) for d in days[:3] if d.get("net_income") is not None]
        if base and len(recent) == 3 and all(x < base for x in recent):
            below.append(t["name"])
    out = []
    if below:
        one = len(below) == 1
        out.append(Action(id="tintero_below", priority=1, area="red", title=f"Visita a {', '.join(below[:3])}",
                          why=f"{'Lleva' if one else 'Llevan'} 3 días seguidos ganando menos que su línea base.",
                          do=f"Revisa ubicación, hora pico y precio; {'acompáñalo un turno y graba su historia si quiere' if one else 'acompáñalos un turno y graba su historia si quieren'}.",
                          watch="Ingreso vs. base de cada uno"))
    quiet = [n for n in quiet if n not in below]
    if quiet:
        out.append(Action(id="tintero_quiet", priority=2, area="red", title=f"Llama a {', '.join(quiet[:3])}",
                          why="3 días o más sin registrar ventas.", do="Pregunta cómo le va y ayúdale a registrar el día (por WhatsApp o en el Panel).",
                          watch="Tinteros activos con registro"))
    return out


def price(s: Snapshot, card: Scorecard, w: Weeks):
    k = kpi(card, "price_specialty")
    if k and k.value is not None and k.value < TARGET_PRICE:
        return Action(id="price_low", priority=2, area="red", title=f"La taza especial va a {cop(k.value)}: prueben {cop(TARGET_PRICE)}",
                      why="Según el estudio, a $3.000 el tintero gana +4 %; a $3.500+ con clientes nuevos, +50–86 %.",
                      do="Prueba durante una semana con dos tinteros y compara contra los demás.", watch="Ingreso del tintero vs. su base")


def social(s: Snapshot, card: Scorecard, w: Weeks):
    if not s.ig_media:
        return Action(id="ig_sync", priority=3, area="redes", title="Sincroniza Instagram para medir el contenido",
                      why="Sin métricas de Instagram no se sabe qué formato repetir ni a qué hora publicar.",
                      do="Panel → Instagram: conecta la cuenta y sincroniza.", watch="Publicaciones con métricas")
    scores = [engagement(m) for m in s.ig_media]
    if len(scores) >= 4:
        p75 = statistics.quantiles(scores, n=4)[2]
        recent = [m for m in s.ig_media if (d := to_day(m.get("posted_at"))) and d >= w.today - timedelta(days=13)]
        best = max(recent, key=engagement, default=None)
        if best and engagement(best) > p75:
            hook = (best.get("caption") or "esa publicación").strip().split("\n")[0][:60]
            return Action(id="repeat_format", priority=2, area="redes", title="Repite el formato que funcionó",
                          why=f"“{hook}” tuvo {engagement(best)} guardados + compartidos (percentil 75: {p75:.0f}).",
                          do="Mismo formato y duración con otro tintero u otro café esta semana.", watch="Guardados + compartidos por publicación")


def content_gap(s: Snapshot, card: Scorecard, w: Weeks):
    k = kpi(card, "scheduled_7d")
    if k.value < 3:
        return Action(id="content_gap", priority=2, area="redes", title=f"Solo hay {plural(k.value, 'publicación programada', 'publicaciones programadas')} para los próximos 7 días",
                      why="El plan pide 4 Reels, 1 carrusel e historias diarias por semana.",
                      do="Usa el plan de contenido de abajo y prográmalo en Publicaciones.", watch="Publicaciones programadas (7 días)")


def wet_day(p: Pulse | None) -> bool:
    b = p.bogota if p else None
    return bool(b) and (b.code in range(51, 68) or b.code in (80, 81, 82, 95, 96, 99) or (b.rainProb or 0) >= 60)


def weather(s: Snapshot, card: Scorecard, w: Weeks):
    b = s.pulse.bogota if s.pulse else None
    if not b:
        return None
    if wet_day(s.pulse):
        return Action(id="weather_rain", priority=2, area="negocio", title="Día de lluvia: tinto caliente y sachets",
                      why=f"Bogotá {b.tempC} °C, probabilidad de lluvia {b.rainProb} %.",
                      do="Avisa a los tinteros (más termos en la mañana) y publica una historia de sachets a domicilio.", watch="Tazas y sachets vendidos hoy")
    if (b.max or 0) >= 22:
        return Action(id="weather_warm", priority=3, area="negocio", title="Día cálido: empuja el cold brew",
                      why=f"Máxima de {b.max} °C en Bogotá.", do="Destaca el cold brew en la barra y en historias.", watch="Ventas de cold brew hoy")


def market(s: Snapshot, card: Scorecard, w: Weeks):
    k = kpi(card, "ny")
    if k and k.delta_pct is not None and abs(k.delta_pct) >= 3:
        up = k.delta_pct > 0
        return Action(id="market_move", priority=3, area="mercado", title=f"El café en Nueva York {'subió' if up else 'bajó'} {pct(k.delta_pct)}",
                      why=f"Contrato C en {k.value:.2f} ¢/lb (antes {k.prev:.2f})".replace(".", ",") + ".",
                      do="Habla con el tostador aliado sobre el precio del próximo pedido y haz una historia de “cuánto vale el café hoy”.",
                      watch="Costo por kilo del próximo pedido")


def recurrence(s: Snapshot, card: Scorecard, w: Weeks):
    k = kpi(card, "repeat_rate")
    sold = [o for o in s.orders if o.get("status") in SOLD]
    if k.value is not None and k.value < (k.target or 20) and len(sold) >= 5:
        return Action(id="repeat_low", priority=2, area="negocio", title=f"Solo {k.value:.0f} % de los clientes repite".replace(".", ","),
                      why=f"La meta del algoritmo es {k.target:.0f} %.", do="Ofrece la suscripción mensual a quien compre esta semana y pídele su WhatsApp en Micra.",
                      watch="Clientes que repiten (90 días)")


# Cada regla devuelve una acción, varias (lista) o None
RULES: list[Callable[[Snapshot, Scorecard, Weeks], Action | list[Action] | None]] = [
    pending_orders, network, tinteros_followup, sales_trend, stock, price, weather, top_variety, content_gap, social, recurrence, market,
]


def actions(s: Snapshot, card: Scorecard) -> list[Action]:
    w = Weeks(s.now)
    out: list[Action] = []
    for rule in RULES:
        found = rule(s, card, w)
        out += found if isinstance(found, list) else [found] if found else []
    return sorted(out, key=lambda a: a.priority)  # estable: dentro de cada prioridad, el orden de RULES


def best_post_hour(s: Snapshot) -> tuple[int, bool]:
    """Hora (Bogotá) con más guardados + compartidos promedio; 7 a. m. si no hay datos (hora del tinto)."""
    by_hour: dict[int, list[int]] = {}
    for m in s.ig_media:
        if m.get("posted_at"):
            h = datetime.fromisoformat(m["posted_at"].replace("Z", "+00:00")).astimezone(BOGOTA).hour
            by_hour.setdefault(h, []).append(engagement(m))
    if sum(len(v) for v in by_hour.values()) < 5:
        return 7, False
    return max(by_hour.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))[0], True
