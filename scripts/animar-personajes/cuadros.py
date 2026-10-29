# Uso: pip install numpy opencv-python-headless pillow
#   python3 scripts/animar-personajes/cuadros.py ruana /tmp/ruana          (cuadros PNG a 30 fps)
#   python3 scripts/animar-personajes/cuadros.py ruana /tmp/ruana dbg      (dibuja recortes y puntos sobre el original)
#   python3 scripts/animar-personajes/para_app.py /tmp/ruana src/features/micra-app/animado/ruana.mp4 360 15 26
# Los PNG originales no están en el repo: PERSONAJES_DIR apunta a la carpeta del proyecto.
import sys, os
from PIL import Image
from titere import build, render, debug
from figuras import FIGS
name, od = sys.argv[1], sys.argv[2]
spec = FIGS[name]
os.makedirs(od, exist_ok=True)
if len(sys.argv) > 3 and sys.argv[3] == 'dbg':
    debug(spec, f'{od}/dbg.png'); sys.exit()
rgba, order = build(spec)
fps = 30
ts = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else [i / fps for i in range(round(spec['dur'] * fps))]
for i, t in enumerate(ts): Image.fromarray(render(spec, order, t)).save(f'{od}/f{i:04d}.png')
