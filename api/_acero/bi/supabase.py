"""Cliente mínimo de Supabase (Auth + PostgREST) para la API de Acero.

Trabaja con la sesión de quien pregunta (su JWT): las reglas RLS de Supabase
siguen aplicando, así que solo una cuenta admin lee los datos del negocio.
"""

from __future__ import annotations

import os

import httpx


class SupabaseError(Exception):
    def __init__(self, status: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code

    @property
    def missing_table(self) -> bool:
        return self.code in ("PGRST205", "42P01")


def configured() -> bool:
    return bool(_url() and _key())


def _clean(name: str) -> str:
    # Variables pegadas en el panel de Vercel llegan a veces con comillas, espacios
    # o un salto de línea al final: httpx falla al instante con eso.
    return os.environ.get(name, "").strip().strip("\"'").strip()


def _url() -> str:
    # La primera que sea una URL válida; en el navegador VITE_SUPABASE_URL ya probó serlo.
    for name in ("SUPABASE_URL", "VITE_SUPABASE_URL"):
        value = _clean(name).rstrip("/")
        if value.startswith(("https://", "http://")):
            return value
    return ""


def _key() -> str:
    return _clean("SUPABASE_ANON_KEY") or _clean("VITE_SUPABASE_ANON_KEY")


class Supabase:
    def __init__(self, jwt: str, http: httpx.AsyncClient | None = None):
        self.url = _url()
        if not self.url:
            raise RuntimeError("Ni SUPABASE_URL ni VITE_SUPABASE_URL es una URL https:// válida en el servidor.")
        self.jwt = jwt
        self.http = http or httpx.AsyncClient(timeout=httpx.Timeout(8.0))
        self._headers = {"apikey": _key(), "Authorization": f"Bearer {jwt}"}

    async def aclose(self) -> None:
        await self.http.aclose()

    async def _send(self, method: str, path: str, *, params=None, json=None, prefer: str | None = None):
        headers = {**self._headers, **({"Prefer": prefer} if prefer else {})}
        res = await self.http.request(method, f"{self.url}{path}", params=params, json=json, headers=headers)
        if res.status_code >= 400:
            try:
                body = res.json()
            except ValueError:
                body = {}
            raise SupabaseError(res.status_code, body.get("message") or body.get("msg") or res.text[:200], body.get("code"))
        return res.json() if res.content else None

    async def user(self) -> dict | None:
        try:
            return await self._send("GET", "/auth/v1/user")
        except SupabaseError:
            return None

    async def select(self, table: str, params: dict) -> list[dict]:
        return await self._send("GET", f"/rest/v1/{table}", params=params) or []

    async def rpc(self, fn: str, body: dict | None = None):
        return await self._send("POST", f"/rest/v1/rpc/{fn}", json=body or {})

    async def insert(self, table: str, row: dict, *, upsert: bool = False) -> dict:
        prefer = "return=representation" + (",resolution=merge-duplicates" if upsert else "")
        rows = await self._send("POST", f"/rest/v1/{table}", json=row, prefer=prefer)
        return rows[0] if rows else {}

    async def update(self, table: str, match: dict, values: dict) -> list[dict]:
        params = {k: f"eq.{v}" for k, v in match.items()}
        return await self._send("PATCH", f"/rest/v1/{table}", params=params, json=values, prefer="return=representation") or []
