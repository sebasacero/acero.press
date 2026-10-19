"""Rutas de inteligencia de negocio (/api/v1/bi). Solo la cuenta owner.

Las usa el Panel ("Algoritmo") y, más adelante, el asistente de WhatsApp:
mismo algoritmo, mismos números en los dos lados.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field

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
        user = await sb.user()
        if not user:
            raise HTTPException(401, "La sesión venció: vuelve a entrar al panel.")
        rows = await sb.select("admin_users", {"select": "role", "auth_user_id": f"eq.{user['id']}"})
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


class TinteroDayIn(BaseModel):
    cups_specialty: int = Field(default=0, ge=0, le=2000)
    cups_tinto: int = Field(default=0, ge=0, le=2000)
    price_specialty: float | None = Field(default=None, ge=0)
    net_income: float | None = Field(default=None, ge=0)
    hours: float | None = Field(default=None, gt=0, le=24)
    source: Literal["panel", "whatsapp", "app"] = "panel"


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
