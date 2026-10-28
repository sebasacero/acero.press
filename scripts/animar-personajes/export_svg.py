# Uso: pip install numpy opencv-python-headless pillow
#      python3 scripts/animar-personajes/export_svg.py src/features/micra-app/animado ruana carrito caminando aeropress servir
#      (run.py <nombre> <carpeta> saca los cuadros PNG para video)
# Escribe un SVG animado (SMIL) con las capas recortadas de la ilustración:
# la placa quieta y cada parte en su grupo con giro, escala y traslado muestreados.
import sys, io, base64, math
import numpy as np
from PIL import Image
from puppet import build, pose_of
from figs import FIGS

N = 48
TITLES = {'ruana': 'Señor de ruana caminando', 'carrito': 'Barista empujando el carrito', 'caminando': 'Barista caminando con su AeroPress', 'aeropress': 'Barista prensando la AeroPress', 'servir': 'Barista sirviendo del termo'}

def r1(v): return f'{round(v, 2):g}'

def webp(arr, scale, q=82):
    im = Image.fromarray(arr)
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 3)
    if len(xs) == 0: return None
    x0, y0, x1, y1 = max(xs.min() - 2, 0), max(ys.min() - 2, 0), min(xs.max() + 3, im.width), min(ys.max() + 3, im.height)
    # en múltiplos de 1/scale para que el recorte caiga en píxeles enteros
    k = round(1 / scale) if abs(1 / scale - round(1 / scale)) < 1e-6 else 1
    x0 -= x0 % k; y0 -= y0 % k
    crop = im.crop((x0, y0, x1, y1))
    w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((w, h), Image.LANCZOS)
    b = io.BytesIO(); crop.save(b, 'WEBP', quality=q, method=6)
    return (x0, y0, x1 - x0, y1 - y0, base64.b64encode(b.getvalue()).decode())

def image_el(c):
    x, y, w, h, data = c
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/webp;base64,{data}"/>'

def anim(kind, vals, dur):
    return f'<animateTransform attributeName="transform" type="{kind}" values="{";".join(vals)}" dur="{dur}s" repeatCount="indefinite"/>'

def wrap(inner, samples, dur):
    # samples: lista de (a, piv, tx, ty, sx, sy) por muestra
    a = [s[0] for s in samples]; px, py = samples[0][1]
    tx = [s[2] for s in samples]; ty = [s[3] for s in samples]
    sx = [s[4] for s in samples]; sy = [s[5] for s in samples]
    out = inner
    if any(abs(v - 1) > 1e-6 for v in sx + sy):
        out = f'<g transform="translate({r1(px)} {r1(py)})"><g>{anim("scale", [f"{r1(u)} {r1(v)}" for u, v in zip(sx, sy)], dur)}<g transform="translate({r1(-px)} {r1(-py)})">{out}</g></g></g>'
    if any(abs(v) > 1e-6 for v in a):
        out = f'<g>{anim("rotate", [f"{r1(v)} {r1(px)} {r1(py)}" for v in a], dur)}{out}</g>'
    if any(abs(v) > 1e-6 for v in tx + ty):
        out = f'<g>{anim("translate", [f"{r1(u)} {r1(v)}" for u, v in zip(tx, ty)], dur)}{out}</g>'
    return out

def export(name, scale=0.6):
    spec = FIGS[name]; dur = spec['dur']
    rgba, plate, layers = build(spec)
    H, W = rgba.shape[:2]
    ts = [dur * i / N for i in range(N + 1)]
    poses = [spec['pose'](t) for t in ts]
    body = image_el(webp(plate, scale))
    for L in layers:
        c = webp(L['img'], scale)
        if not c: continue
        body += wrap(image_el(c), [pose_of(p, L) for p in poses], dur)
    g = [p.get('_all', {}) for p in poses]
    allp = [(q.get('a', 0), q.get('piv', (0, 0)), q.get('tx', 0), q.get('ty', 0), 1, 1) for q in g]
    body = wrap(body, allp, dur)
    # margen arriba y abajo para el rebote
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -16 {W} {H + 24}" width="{W}" height="{H + 24}" role="img" '
            f'aria-label="{TITLES[name]}" data-name="{name}" data-dur="{dur}">{body}</svg>\n')

if __name__ == '__main__':
    out = sys.argv[1]
    for n in sys.argv[2:]:
        s = export(n)
        open(f'{out}/{n}.svg', 'w').write(s)
        print(n, len(s) // 1024, 'KB')
