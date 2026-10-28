# Títere de recortes: anima por partes una ilustración original.
import math, json, sys, os
import numpy as np, cv2
from PIL import Image, ImageDraw

def cutout(path):
    im = np.array(Image.open(path).convert('RGB'))
    h, w = im.shape[:2]
    light = (im.min(axis=2) > 236).astype(np.uint8)
    # fondo = blancos conectados al borde (la piel y camisas blancas quedan)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    ff = light.copy() * 255
    for x in range(0, w, 7):
        for y in (0, h - 1):
            if ff[y, x] == 255: cv2.floodFill(ff, mask, (x, y), 128)
    for y in range(0, h, 7):
        for x in (0, w - 1):
            if ff[y, x] == 255: cv2.floodFill(ff, mask, (x, y), 128)
    bg = (ff == 128).astype(np.uint8)
    # borde suave
    alpha = (1 - bg) * 255
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (3, 3), 0).astype(np.uint8)
    return np.dstack([im, alpha])

def poly_mask(shape, pts, dil=0):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
    m = np.array(m)
    if dil: m = cv2.dilate(m, np.ones((dil, dil), np.uint8))
    return m

def build(spec):
    rgba = cutout(spec['src'])
    h, w = rgba.shape[:2]
    inp = np.zeros((h, w), np.uint8); clr = np.zeros((h, w), np.uint8)
    layers = []
    for L in spec['layers']:
        m = poly_mask(rgba.shape, L['poly'])
        ex = np.zeros_like(m)
        for e in L.get('exclude', []): ex |= poly_mask(rgba.shape, e)
        m[ex > 0] = 0
        if not L.get('static'): m = cv2.dilate(m, np.ones((3, 3), np.uint8))  # sin costuras entre partes vecinas
        part = rgba.copy(); part[..., 3] = (part[..., 3].astype(np.uint16) * m // 255).astype(np.uint8)
        layers.append({**L, 'img': part})
        if L.get('static'): continue
        hole = m > 0
        # detrás de la parte: se rellena solo donde hay algo detrás (fill), el resto queda vacío
        fill = poly_mask(rgba.shape, L['fill']) > 0 if L.get('fill') else np.zeros_like(hole)
        inp |= (hole & fill).astype(np.uint8); clr |= (hole & ~fill).astype(np.uint8)
    rgb = np.ascontiguousarray(rgba[..., :3]); a = np.ascontiguousarray(rgba[..., 3]).copy()
    a[clr > 0] = 0
    rgb_i = cv2.inpaint(rgb, inp * 255, 9, cv2.INPAINT_TELEA)
    a_i = a.copy()  # el relleno no inventa figura donde antes había fondo
    plate = np.dstack([rgb_i, a_i])
    return rgba, plate, layers

def matrix(ang, piv, tx=0, ty=0, sx=1, sy=1):
    # escala y giro alrededor de piv (ang>0 = horario en pantalla), luego traslado
    a = math.radians(ang); c, s = math.cos(a), math.sin(a)
    A = np.array([[c * sx, -s * sy], [s * sx, c * sy]])
    p = np.array(piv, float)
    b = p - A @ p + np.array([tx, ty])
    return np.hstack([A, b[:, None]])

def affine(img, ang, piv, tx=0, ty=0, sx=1, sy=1):
    h, w = img.shape[:2]
    return cv2.warpAffine(img, matrix(ang, piv, tx, ty, sx, sy), (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

def over(dst, src):
    sa = src[..., 3:4].astype(np.float32) / 255; da = dst[..., 3:4].astype(np.float32) / 255
    oa = sa + da * (1 - sa)
    oc = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([oc, oa * 255]).clip(0, 255).astype(np.uint8)

def render(spec, layers, plate, t):
    p = spec['pose'](t)
    out = plate.copy()
    for L in layers:
        out = over(out, affine(L['img'], *pose_of(p, L)))
    for fn in spec.get('draw', []):
        out = fn(out, t)
    g = p.get('_all', {})
    if g: out = affine(out, g.get('a', 0), g.get('piv', (0, 0)), g.get('tx', 0), g.get('ty', 0))
    return out

def pose_of(p, L):
    q = p.get(L['name'], {})
    return (q.get('a', 0), q.get('piv', L.get('piv', (0, 0))), q.get('tx', 0), q.get('ty', 0), q.get('sx', 1), q.get('sy', 1))
