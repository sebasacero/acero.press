# Versión sin deformar: el dibujo original se mueve entero y rígido (respira,
# se inclina, sube y baja), con el vapor, la sombra y el piso que pasa dando la
# sensación de marcha. Nada estira piernas ni ropa: el títere (figuras.py) lo
# hacía y se veía roto.
import math, os
import numpy as np, cv2
from titere import cutout, build, over, steam, rot

D = os.environ.get('PERSONAJES_DIR', '/mnt/project-files/micra-app/personajes-28oct') + '/'
TAU = 2 * math.pi
INK = (31, 36, 82)

def rigid(img, dx=0.0, dy=0.0, deg=0.0, pivot=(424, 1200), scale=1.0):
    M = cv2.getRotationMatrix2D(pivot, -deg, scale)
    M[:, 2] += (dx, dy)
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

def shadow(out, cx, cy, rx, ry, alpha):
    """sombra suave bajo los pies: se achica cuando el cuerpo sube"""
    lay = np.zeros(out.shape[:2], np.uint8)
    cv2.ellipse(lay, (int(cx), int(cy)), (int(rx), int(ry)), 0, 0, 360, 255, -1)
    lay = cv2.GaussianBlur(lay, (0, 0), 9)
    col = np.zeros_like(out); col[..., :3] = (120, 112, 96); col[..., 3] = (lay * alpha).astype(np.uint8)
    return over(col, out)

def ground(out, y, x0, x1, t, dur, speed, dash=58, gap=46):
    """un trazo de andén con rayas que pasan bajo los pies (speed > 0: hacia la derecha)"""
    lay = np.zeros(out.shape[:2], np.uint8)
    off = (t / dur * speed) % (dash + gap)
    x = x0 - (dash + gap) + off
    while x < x1:
        a, b = max(x0, x), min(x1, x + dash)
        if b > a: cv2.line(lay, (int(a), int(y)), (int(b), int(y)), 255, 3, cv2.LINE_AA)
        x += dash + gap
    # se desvanece en las puntas
    fade = np.ones(out.shape[1], np.float32)
    w = 90
    xs = np.arange(out.shape[1])
    fade = np.clip((xs - x0) / w, 0, 1) * np.clip((x1 - xs) / w, 0, 1)
    lay = (lay * fade[None, :] * 0.55).astype(np.uint8)
    col = np.zeros_like(out); col[..., :3] = INK; col[..., 3] = lay
    return over(col, out)

def spokes(img, cx, cy, a, b, deg, inner=0.86):
    """gira los rayos de una rueda vista en escorzo (elipse a×b): se desproyecta a
    círculo, se gira y se vuelve a proyectar; el aro queda quieto"""
    H, W = img.shape[:2]
    y0, y1 = max(0, int(cy - b - 4)), min(H, int(cy + b + 5)); x0, x1 = max(0, int(cx - a - 4)), min(W, int(cx + a + 5))
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    u = (xs - cx) / a; v = (ys - cy) / b
    r = math.radians(deg)
    su = u * math.cos(r) - v * math.sin(r); sv = u * math.sin(r) + v * math.cos(r)
    mx = (su * a + cx).astype(np.float32); my = (sv * b + cy).astype(np.float32)
    patch = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    m = ((u * u + v * v) <= inner * inner).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), 2)[..., None]
    out = img.copy()
    out[y0:y1, x0:x1] = (patch * m + img[y0:y1, x0:x1] * (1 - m)).astype(np.uint8)
    return out

def bob(u, amp, steps=2):
    """sube y baja: dos pasos por vuelta, suave arriba y seco abajo como un paso"""
    return -amp * abs(math.sin(math.pi * steps * u)) ** 1.3

# ---------------------------------------------------------------- las cinco
def caminando(t, F):
    u = (t / F['dur']) % 1
    dy = bob(u, 9); sway = 4 * math.sin(TAU * u); deg = 1.2 * math.sin(TAU * u)
    out = rigid(F['img'], sway, dy, deg, pivot=(430, 1190))
    out = shadow(out, 430 + sway * 0.5, 1198, 95 + dy * 1.5, 14 + dy * 0.3, 0.5)
    return out

def carrito(t, F):
    u = (t / F['dur']) % 1
    dy = bob(u, 7); deg = 1.0 + 0.8 * math.sin(TAU * u * 2 - 0.8)
    out = rigid(F['img'], 0, dy, deg, pivot=(420, 1110))
    out = shadow(out, 330, 1118, 150, 12, 0.35)
    out = ground(out, 1152, 40, 808, t, F['dur'], -310)
    out = steam(out, [(690, 495, 0.0), (706, 500, 0.45), (778, 495, 0.2)], t, F['dur'])
    return out

def ruana(t, F):
    u = (t / F['dur']) % 1
    dy = bob(u, 8); deg = -0.8 + 0.9 * math.sin(TAU * u * 2 - 0.6); sway = 2 * math.sin(TAU * u)
    out = rigid(F['img'], sway, dy, deg, pivot=(420, 1190))
    out = shadow(out, 400, 1196, 170 + dy, 13, 0.42)
    out = ground(out, 1228, 40, 808, t, F['dur'], 260)
    out = steam(out, [(664, 300, 0.0), (676, 300, 0.5)], t, F['dur'])
    return out

def aeropress(t, F):
    u = (t / F['dur']) % 1
    # presiona: se inclina un poco sobre la prensa y vuelve; la respiración encima
    press = 0.5 - 0.5 * math.cos(TAU * u)
    deg = -1.6 * press; dy = 2.5 * press + 1.2 * math.sin(TAU * u * 3)
    out = rigid(F['img'], 0, dy, deg, pivot=(600, 1140))
    out = steam(out, [(258, 500, 0.0), (276, 496, 0.55)], t, F['dur'])
    return out

def servir(t, F):
    u = (t / F['dur']) % 1
    tilt = -7 * (0.5 - 0.5 * math.cos(TAU * u))
    br = 1.5 * math.sin(TAU * u * 2)
    plate, termo = F['order']
    th = rigid(termo['img'], 0, 0, tilt, pivot=(335, 450))
    out = over(plate['img'], th)
    out = rigid(out, 0, br, 0.4 * math.sin(TAU * u), pivot=(600, 1180))
    out = steam(out, [(455, 488, 0.0), (470, 486, 0.5), (590, 625, 0.3), (662, 640, 0.7)], t, F['dur'])
    return out

SERVIR_LAYERS = [
    {'name': 'placa', 'plate': True},
    {'name': 'termo', 'poly': [(280,448),(440,440),(448,470),(445,490),(300,560),(275,520)], 'fill': [(250,400),(460,400),(460,600),(250,600)], 'handles': {'mano': (335, 450)}},
]

FIGS = {
    'caminando': {'src': D + '02-barista-termo-aeropress.png', 'dur': 1.3, 'draw': caminando},
    'carrito': {'src': D + '05-barista-empujando-carrito.png', 'dur': 1.5, 'draw': carrito},
    'ruana': {'src': D + '03-barista-ruana.png', 'dur': 1.7, 'draw': ruana},
    'aeropress': {'src': D + '01-barista-carrito.png', 'dur': 2.4, 'draw': aeropress},
    'servir': {'src': D + '07-barista-carrito-sombrilla.png', 'dur': 2.4, 'draw': servir, 'layers': SERVIR_LAYERS},
}

def load(name):
    F = dict(FIGS[name])
    if F.get('layers'):
        _, order = build({'src': F['src'], 'layers': F['layers']})
        F['order'] = order
    else:
        F['img'] = cutout(F['src'])
    return F

def frame(F, t):
    return F['draw'](t, F)
