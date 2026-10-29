# Uso: pip install numpy opencv-python-headless pillow
#   python3 scripts/animar-personajes/cuadros.py ruana /tmp/ruana            (cuadros PNG a 30 fps, versión rígida)
#   python3 scripts/animar-personajes/cuadros.py ruana /tmp/ruana titere     (la versión de títere, figuras.py)
#   python3 scripts/animar-personajes/para_app.py /tmp/ruana src/features/micra-app/animado/ruana.mp4 360 15 26
# Los PNG originales no están en el repo: PERSONAJES_DIR apunta a la carpeta del proyecto.
import sys, os
from PIL import Image
name, od = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'rigido'
os.makedirs(od, exist_ok=True)
fps = 30
if mode == 'titere':
    from titere import build, render
    from figuras import FIGS
    spec = FIGS[name]; rgba, order = build(spec)
    draw = lambda t: render(spec, order, t); dur = spec['dur']
else:
    from rigido import load, frame
    F = load(name); draw = lambda t: frame(F, t); dur = F['dur']
for i in range(round(dur * fps)):
    Image.fromarray(draw(i / fps)).save(f'{od}/f{i:04d}.png')
