"""Resumen del algoritmo: tablero + acciones + contenido, y el texto listo
para mandar por WhatsApp (diario a las 7 a. m., semanal el lunes).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel

from .metrics import Kpi, Scorecard, Weeks, scorecard
from .rules import Action, actions, best_post_hour, cop, wet_day
from .snapshot import Snapshot

Kind = Literal["daily", "weekly"]
WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

# Pilares del plan de contenido, uno por día (lunes = 0)
PILLARS = [
    ("Detrás de la red", "Carrusel", "Los números de la semana a la vista: tazas, tinteros y lo que aprendimos."),
    ("Receta campeona en la calle", "Reel", "Una receta del World AeroPress Championship preparada en la esquina con {coffee}."),
    ("Tinto vs. especial", "Reel", "Cata a ciegas en la calle: ¿cuál prefieres? Precio y sabor lado a lado."),
    ("Historias de tinteros", "Reel", "Un día con un tintero de la red: cuánto vendía antes y cuánto vende ahora."),
    ("Aliados", "Reel", "El tostador del mes: de dónde viene {coffee} y quién lo tuesta."),
    ("Receta campeona en la calle", "Reel", "La receta de la semana con {coffee}, en 30 segundos."),
    ("Detrás de la red", "Historias", "Resumen del fin de semana y lo que viene."),
]


class ContentIdea(BaseModel):
    day: str
    pillar: str
    format: str
    idea: str
    hour: str


class Brief(BaseModel):
    kind: Kind
    generatedAt: str
    period: dict[str, str]
    scorecard: Scorecard
    actions: list[Action]
    content: list[ContentIdea]
    missing: list[str]
    text: str


def hour_label(h: int) -> str:
    return f"{(h % 12) or 12}:00 {'a. m.' if h < 12 else 'p. m.'}"


def day_label(d) -> str:
    return f"{WEEKDAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}"


def content_plan(s: Snapshot, w: Weeks, top: str | None, days: int) -> list[ContentIdea]:
    hour, from_data = best_post_hour(s)
    when = hour_label(hour) + ("" if from_data else " (hora del tinto; aún sin datos de Instagram)")
    coffee = top or "el café de la semana"
    plan = []
    for i in range(days):
        d = w.today + timedelta(days=i)
        pillar, fmt, idea = PILLARS[d.weekday()]
        if i == 0 and wet_day(s.pulse):
            idea += " Hoy llueve: muéstralo con el termo y el vapor."
        plan.append(ContentIdea(day=day_label(d), pillar=pillar, format=fmt, idea=idea.format(coffee=coffee), hour=when))
    return plan


def fmt_value(k: Kpi) -> str:
    if k.value is None:
        return "sin datos"
    v = k.value
    text = {
        "cop": lambda: cop(v),
        "pct": lambda: f"{v:.1f} %".replace(".", ","),
        "kg": lambda: f"{v:.2f} kg".replace(".", ","),
        "per_h": lambda: f"{v:.1f}/h".replace(".", ","),
        "cents_lb": lambda: f"{v:.2f} ¢/lb".replace(".", ","),
        "c": lambda: f"{v:.0f} °C",
    }.get(k.unit, lambda: f"{v:,.0f}".replace(",", "."))()
    return text + trend(k.delta_pct)


def trend(delta_pct: float | None) -> str:
    """ ▲3,3 % · ▼42 % · vacío si no hay con qué comparar"""
    if delta_pct is None:
        return ""
    arrow = "▲" if delta_pct > 0 else "▼" if delta_pct < 0 else "="
    d = abs(delta_pct)
    return f" {arrow}{d:.1f} %".replace(".", ",") if d < 10 else f" {arrow}{d:.0f} %"


def whatsapp_text(kind: Kind, w: Weeks, card: Scorecard, acts: list[Action], plan: list[ContentIdea]) -> str:
    get = {k.id: k for lvl in card.levels for k in lvl.kpis}
    title = "Resumen de la semana" if kind == "weekly" else "Buenos días"
    lines = [f"☕ *Micra · {title}* — {day_label(w.today)}", ""]
    n = card.north
    lines.append(f"*Norte:* {int(n.value or 0)} tazas de especialidad{trend(n.delta_pct)} (semana anterior: {int(n.prev or 0)})")
    lines.append(f"*Ventas 7 días:* {fmt_value(get['revenue_week'])} · {int(get['orders_week'].value or 0)} pedidos · {fmt_value(get['kg_week'])}")
    if get.get("tinteros_active") and get["tinteros_active"].status != "nodata":
        lines.append(f"*Red:* {int(get['tinteros_active'].value or 0)} tinteros activos · ingreso vs. base {fmt_value(get['income_uplift'])}")
    else:
        lines.append("*Red:* aún sin tinteros registrados")
    if get["reach_week"].status != "nodata":
        lines.append(f"*Redes:* alcance {fmt_value(get['reach_week'])} · guardados+compartidos {fmt_value(get['saves_shares'])}")
    market = [f"carga FNC {fmt_value(get['fnc'])}" if get["fnc"].value else None,
              f"NY {fmt_value(get['ny'])}" if get["ny"].value else None,
              f"Bogotá {fmt_value(get['weather'])}" if get["weather"].value is not None else None]
    if any(market):
        lines.append("*Mercado:* " + " · ".join(m for m in market if m))

    top = acts[: 7 if kind == "weekly" else 4]
    if top:
        lines += ["", "*Hoy, en orden:*" if kind == "daily" else "*Prioridades de la semana:*"]
        lines += [f"{i}. {a.title} — {a.do}" for i, a in enumerate(top, 1)]
    if plan:
        lines += ["", "*Contenido:*" if kind == "weekly" else "*Contenido de hoy:*"]
        lines += [f"• {c.day}: {c.pillar} ({c.format}, {c.hour.split(' (')[0]}) — {c.idea}" for c in plan]
    return "\n".join(lines)


def build_brief(s: Snapshot, kind: Kind = "daily") -> Brief:
    w = Weeks(s.now)
    card = scorecard(s)
    acts = actions(s, card)
    top_coffee = next((a.title.removeprefix("Receta de la semana con ") for a in acts if a.id == "recipe_of_week"), None)
    plan = content_plan(s, w, top_coffee, 7 if kind == "weekly" else 1)
    return Brief(
        kind=kind,
        generatedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        period={"from": w.cur[0].isoformat(), "to": w.cur[1].isoformat()},
        scorecard=card,
        actions=acts,
        content=plan,
        missing=s.missing,
        text=whatsapp_text(kind, w, card, acts, plan),
    )
