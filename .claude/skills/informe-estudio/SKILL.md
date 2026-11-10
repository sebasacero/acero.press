---
name: informe-estudio
description: Arma el informe del día o de la semana de Micra (estudio de calle, mapa en vivo, ventas del equipo y precio del café) con las herramientas del servidor MCP «micra». Úsala cuando pidan «informe», «cómo vamos», «resumen del estudio» o preparar la reunión con el distribuidor.
---

# Informe de Micra con el MCP

1. Llama, en paralelo, las cuatro herramientas del servidor `micra`: `estudio_resumen`, `mapa_en_vivo`, `dia_del_equipo` y `precio_cafe`. Si alguna devuelve error, sigue con las demás y di cuál faltó y por qué (sin sesión, sin migración, sin red).
2. Escribe el informe en español, en Markdown, con estas secciones y en este orden:
   - **Hoy en la calle**: baristas en la calle de cuántos, tazas, plata, apartados que esperan; la semana en una línea.
   - **Dónde buscan café**: las zonas con más señales (por bebida) y si hay baristas cerca.
   - **El estudio**: muestra (fichas, encuestas, zonas), precio del tinto (mediana y n), tazas al día, kilos de café al mes, actitud frente al café de especialidad. Lo que falta de `readiness`.
   - **El mercado**: carga FNC, bolsa de Nueva York y dólar, con el cambio.
   - **Tres acciones para mañana**, cada una con el número que se mira para saber si funcionó.
3. Reglas que no se rompen:
   - Toda cifra del estudio va con su n. Con n < 5 se dice «muy pocos datos» y no se saca conclusión.
   - En lo público se dice «barista», nunca «tintero». No se nombran aliados ni distribuidores.
   - Nada de nombres, notas ni fotos de las personas del estudio (las herramientas ya los quitan; no los pidas por otro lado).
4. Guarda el informe en `reports/informe-AAAA-MM-DD.md` (`reports/` no va a git) y muestra el resumen en el chat.

Sin `MICRA_TOKEN` el servidor usa los datos de demostración (`mcp/micra/demo.json`): dilo al principio del informe para no confundirlo con datos reales.
