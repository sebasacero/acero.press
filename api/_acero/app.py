"""API de Acero (FastAPI): datos e integraciones del negocio en /api/v1.

Vive como una función de Python en Vercel, al lado del sitio (Vite) y de las
funciones de Node que ya existen (pagos, barista, asistente). La documentación
interactiva queda en /api/v1/docs y el contrato en /api/v1/openapi.json, que
sirve para generar el cliente de la app Android de Micra.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from .bi.routes import router as bi_router
from .pulse import Pulse, read_pulse

PREFIX = "/api/v1"

app = FastAPI(
    title="Acero API",
    version="1.0.0",
    summary="Datos e integraciones de ACERO.press: pulso del café, algoritmo de negocio (BI), Micra y asistente.",
    docs_url=f"{PREFIX}/docs",
    openapi_url=f"{PREFIX}/openapi.json",
    redoc_url=None,
)


class RestoreVercelPath:
    """vercel.json manda /api/v1/<ruta> a esta función como /api/v1?__path=<ruta>.

    Según cómo lo entregue Vercel, la app ve la ruta original o la reescrita:
    aquí se deja siempre la original para que el ruteo de FastAPI funcione igual
    en Vercel y en local (uvicorn).
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            query = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
            sub = next((v for k, v in query if k == "__path"), None)
            if sub is not None:
                path = f"{PREFIX}/{sub.strip('/')}".rstrip("/")
                rest = urlencode([(k, v) for k, v in query if k != "__path"])
                scope = {**scope, "path": path, "raw_path": path.encode(), "query_string": rest.encode()}
        await self.inner(scope, receive, send)


app.add_middleware(RestoreVercelPath)
app.include_router(bi_router, prefix=PREFIX)


@app.exception_handler(Exception)
async def unexpected(_: Request, err: Exception) -> JSONResponse:
    # Vercel convertiría la excepción en «Internal Server Error» en texto plano y el
    # panel solo diría «la API no respondió»: mejor un JSON con la causa (sin traza).
    return JSONResponse(status_code=500, content={"detail": f"Error inesperado en la API ({type(err).__name__}: {str(err)[:200]})."})


@app.get(PREFIX, include_in_schema=False)
def root():
    return {"name": "Acero API", "version": app.version, "docs": f"{PREFIX}/docs"}


@app.get(f"{PREFIX}/pulse", response_model=Pulse, tags=["pulso"], summary="Mercado del café y clima de Bogotá")
async def pulse(response: Response) -> Pulse:
    """Carga FNC, Bolsa NY y TRM con su fecha y variación, más el clima de hoy.

    La CDN de Vercel guarda la respuesta una hora (10 minutos si faltó alguna
    fuente), así que las fuentes se consultan unas pocas veces al día.
    """
    data = await read_pulse()
    complete = all([data.market.fnc, data.market.ny, data.market.trm, data.bogota])
    response.headers["Cache-Control"] = f"public, s-maxage={3600 if complete else 600}, stale-while-revalidate=86400"
    return data
