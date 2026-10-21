"""Rutas de inteligencia de negocio (/api/v1/bi). Solo la cuenta owner.

Las usa el Panel ("Algoritmo") y, más adelante, el asistente de WhatsApp:
mismo algoritmo, mismos números en los dos lados.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field, model_validator

from ..pulse import BOGOTA
from .brief import Brief, Kind, build_brief
from .snapshot import load_snapshot
from .supabase import Supabase, SupabaseError, configured

def no_store(response: Response) -> None:
    """Datos privados del negocio: que ninguna caché (CDN o navegador) los guarde."""
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(prefix="/bi", tags=["inteligencia de negocio"], dependencies=[Depends(no_store)])


async def owner(authorization: str | None = Header(default=None)):
    """Sesión de Supabase del dueño (Authorization: Bearer <access_token>)."""
    if not configured():
        raise HTTPException(503, "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el servidor.")
    jwt = (authorization or "").removeprefix("Bearer ").strip()
    if not jwt:
        raise HTTPException(401, "Inicia sesión en el panel.")
    sb = Supabase(jwt)
    try:
        # Si la API no alcanza a Supabase (red, URL mal puesta, TLS), que se
        # sepa cuál fue el error y no un 500 mudo en texto plano.
        try:
            user = await sb.user()
            if not user:
                raise HTTPException(401, "La sesión venció: vuelve a entrar al panel.")
            rows = await sb.select("admin_users", {"select": "role", "auth_user_id": f"eq.{user['id']}"})
        except httpx.HTTPError as err:
            raise HTTPException(502, f"La API no pudo hablar con Supabase ({type(err).__name__}: {err}).") from err
        except SupabaseError as err:
            raise HTTPException(502, f"Supabase respondió {err.status} al validar la sesión: {err}.") from err
        if not rows or rows[0].get("role") != "owner":
            raise HTTPException(403, "Solo el dueño puede ver el algoritmo.")
        yield sb
    finally:
        await sb.aclose()


def db_error(err: SupabaseError) -> HTTPException:
    if err.missing_table:
        return HTTPException(409, "Faltan las tablas de la red de tinteros (migración 20261019120000_micra_tinteros).")
    return HTTPException(400 if err.status < 500 else 502, str(err))


@router.get("/brief", response_model=Brief, summary="Tablero, acciones y contenido (y el texto para WhatsApp)")
async def brief(kind: Kind = Query("daily", description="daily: el del día · weekly: el del lunes"), sb: Supabase = Depends(owner)) -> Brief:
    return build_brief(await load_snapshot(sb), kind)


# ── Red de tinteros ──────────────────────────────────────────────────────
Stage = Literal["prospecto", "piloto", "activo", "pausa", "salio"]
Kit = Literal["ninguno", "prestamo", "arriendo", "propio"]


class TinteroIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str | None = Field(default=None, pattern=r"^[0-9]{7,15}$")
    zone: str | None = Field(default=None, max_length=80)
    stage: Stage = "prospecto"
    kit: Kit = "ninguno"
    baseline_income: float | None = Field(default=None, ge=0, description="Ingreso neto diario antes de la red (COP)")
    baseline_cups: int | None = Field(default=None, ge=0, description="Tintos al día antes de la red")
    notes: str | None = Field(default=None, max_length=500)
    joined_at: date | None = None
    # Ficha de campo (estudio de calle): dónde está el puesto y qué se vio
    carrera: float | None = Field(default=None, ge=1, le=120)
    calle: float | None = Field(default=None, ge=1, le=200)
    photo_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    photo_consent: bool = False
    tinto_price: float | None = Field(default=None, ge=0, le=50000, description="Precio del tinto en el puesto (COP)")
    cups_per_hour: float | None = Field(default=None, ge=0, le=500, description="Tazas por hora observadas")
    surveyed_at: datetime | None = None

    @model_validator(mode="after")
    def _place_complete(self):
        # Las dos coordenadas o ninguna: el check de la base lo exige igual
        if (self.carrera is None) != (self.calle is None):
            raise ValueError("El lugar necesita carrera y calle.")
        return self


class TinteroPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = Field(default=None, pattern=r"^[0-9]{7,15}$")
    zone: str | None = Field(default=None, max_length=80)
    stage: Stage | None = None
    kit: Kit | None = None
    baseline_income: float | None = Field(default=None, ge=0)
    baseline_cups: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)
    joined_at: date | None = None
    carrera: float | None = Field(default=None, ge=1, le=120)
    calle: float | None = Field(default=None, ge=1, le=200)
    photo_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    photo_consent: bool | None = None
    tinto_price: float | None = Field(default=None, ge=0, le=50000)
    cups_per_hour: float | None = Field(default=None, ge=0, le=500)
    surveyed_at: datetime | None = None


class TinteroDayIn(BaseModel):
    cups_specialty: int = Field(default=0, ge=0, le=2000)
    cups_tinto: int = Field(default=0, ge=0, le=2000)
    price_specialty: float | None = Field(default=None, ge=0)
    net_income: float | None = Field(default=None, ge=0)
    hours: float | None = Field(default=None, gt=0, le=24)
    source: Literal["panel", "whatsapp", "app"] = "panel"


# ── Piloto (estudio de calle) ────────────────────────────────────────────
GRAMS_PER_CUP = 18  # receta de la barra: 18 g por taza


def _week(now: datetime, back: int) -> tuple[date, date]:
    today = now.astimezone(BOGOTA).date()
    return (today - timedelta(days=6 + 7 * back), today - timedelta(days=7 * back))


@router.get("/piloto", summary="Piloto del estudio de calle: ventas con lugar, tinteros y la semana")
async def piloto(days: int = Query(90, ge=1, le=365), sb: Supabase = Depends(owner)):
    """Lo que se muestra en la reunión: dónde se vendió, a quién se mapeó y los números de la semana.
    Ventas: solo las de Micra completadas con lugar (sin teléfono ni datos del cliente)."""
    now = datetime.now(BOGOTA)
    since = (now - timedelta(days=days)).isoformat()
    try:
        orders = await sb.select("orders", {
            "select": "id,total,created_at,place_carrera,place_calle,place_zone,order_items(qty,product_name_snapshot,variant_label_snapshot)",
            "source": "eq.esspresale", "status": "eq.completed", "place_carrera": "not.is.null",
            "created_at": f"gte.{since}", "order": "created_at.desc", "limit": "500",
        })
        tinteros = await sb.select("tinteros", {"select": "*", "order": "created_at.desc"})
    except SupabaseError as err:
        raise db_error(err) from err

    sales = []
    for o in orders:
        items = o.get("order_items") or []
        sales.append({
            "id": o["id"], "at": o["created_at"], "total": float(o.get("total") or 0),
            "cups": sum(int(i.get("qty") or 0) for i in items),
            "what": ", ".join(f"{i.get('product_name_snapshot')} {i.get('variant_label_snapshot') or ''}".strip() for i in items)[:120],
            "carrera": o.get("place_carrera"), "calle": o.get("place_calle"), "zone": o.get("place_zone"),
        })

    def week_stats(span: tuple[date, date]) -> dict:
        rows = [x for x in sales if span[0] <= datetime.fromisoformat(x["at"].replace("Z", "+00:00")).astimezone(BOGOTA).date() <= span[1]]
        cups = sum(x["cups"] for x in rows)
        return {
            "cups": cups, "sales": len(rows), "income": round(sum(x["total"] for x in rows)),
            "blocks": len({(round(x["carrera"]), round(x["calle"])) for x in rows}),
            "zones": sorted({x["zone"] for x in rows if x["zone"]}),
            "kg": round(cups * GRAMS_PER_CUP / 1000, 2),
        }

    cur, prev = week_stats(_week(now, 0)), week_stats(_week(now, 1))
    surveyed = [t for t in tinteros if t.get("carrera") is not None]
    prices = [float(t["tinto_price"]) for t in surveyed if t.get("tinto_price")]
    rates = [float(t["cups_per_hour"]) for t in surveyed if t.get("cups_per_hour")]
    return {
        "generatedAt": now.isoformat(), "days": days,
        "week": {"from": _week(now, 0)[0].isoformat(), "to": _week(now, 0)[1].isoformat(), "cur": cur, "prev": prev},
        "sales": sales,
        "tinteros": [{k: v for k, v in t.items() if k != "phone"} for t in tinteros],
        "study": {
            "surveyed": len(surveyed), "with_photo": sum(1 for t in surveyed if t.get("photo_url")),
            "consented": sum(1 for t in surveyed if t.get("photo_consent")),
            "tinto_price_avg": round(sum(prices) / len(prices)) if prices else None,
            "cups_per_hour_avg": round(sum(rates) / len(rates), 1) if rates else None,
            "zones": sorted({t["zone"] for t in surveyed if t.get("zone")}),
        },
    }


@router.get("/tinteros", summary="Tinteros y sus últimos 30 días")
async def list_tinteros(sb: Supabase = Depends(owner)):
    since = (datetime.now(BOGOTA).date() - timedelta(days=29)).isoformat()
    try:
        tinteros = await sb.select("tinteros", {"select": "*", "order": "created_at.asc"})
        logged = await sb.select("tintero_days", {"select": "*", "day": f"gte.{since}", "order": "day.desc"})
    except SupabaseError as err:
        raise db_error(err) from err
    days: dict[str, list[dict]] = {}
    for d in logged:
        days.setdefault(d["tintero_id"], []).append(d)
    return [{**t, "days": days.get(t["id"], [])} for t in tinteros]


@router.post("/tinteros", status_code=201, summary="Registrar un tintero")
async def create_tintero(body: TinteroIn, sb: Supabase = Depends(owner)):
    try:
        return await sb.insert("tinteros", body.model_dump(mode="json", exclude_none=True))
    except SupabaseError as err:
        raise db_error(err) from err


@router.patch("/tinteros/{tintero_id}", summary="Actualizar etapa, kit o línea base")
async def update_tintero(tintero_id: UUID, body: TinteroPatch, sb: Supabase = Depends(owner)):
    values = body.model_dump(mode="json", exclude_unset=True)
    if not values:
        raise HTTPException(422, "No hay cambios.")
    try:
        rows = await sb.update("tinteros", {"id": str(tintero_id)}, values)
    except SupabaseError as err:
        raise db_error(err) from err
    if not rows:
        raise HTTPException(404, "No existe ese tintero.")
    return rows[0]


@router.put("/tinteros/{tintero_id}/days/{day}", summary="Registrar (o corregir) el día de un tintero")
async def log_day(tintero_id: UUID, day: date, body: TinteroDayIn, sb: Supabase = Depends(owner)):
    try:
        return await sb.insert("tintero_days", {"tintero_id": str(tintero_id), "day": day.isoformat(), **body.model_dump(mode="json")}, upsert=True)
    except SupabaseError as err:
        raise db_error(err) from err
