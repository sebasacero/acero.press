# API de Acero en FastAPI (función de Python en Vercel). Todo /api/v1/* llega
# aquí por vercel.json; el código vive en api/_acero (el guion bajo evita que
# Vercel convierta esos archivos en funciones aparte).
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from _acero.app import app  # noqa: E402,F401
