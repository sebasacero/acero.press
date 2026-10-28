# Títere con deformación suave: cada capa de la ilustración se mueve con puntos
# de control (cadera, rodilla, tobillo…) y «mínimos cuadrados móviles» rígidos
# (Schaefer 2006), así la rodilla se dobla sin cortes y lo quieto queda quieto.
import math, os
import numpy as np, cv2
from PIL import Image, ImageDraw

def cutout(path):
    im = np.array(Image.open(path).convert('RGB'))
    h, w = im.shape[:2]
    light = (im.min(axis=2) > 236).astype(np.uint8)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    ff = light.copy() * 255
    for x in range(0, w, 7):
        for y in (0, h - 1):
            if ff[y, x] == 255: cv2.floodFill(ff, mask, (x, y), 128)
    for y in range(0, h, 7):
        for x in (0, w - 1):
            if ff[y, x] == 255: cv2.floodFill(ff, mask, (x, y), 128)
    bg = (ff == 128).astype(np.uint8)
    alpha = cv2.GaussianBlur(((1 - bg) * 255).astype(np.float32), (3, 3), 0).astype(np.uint8)
    return np.dstack([im, alpha])

def poly_mask(shape, polys, dil=0):
    m = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for pts in (polys if isinstance(polys[0], (list, tuple)) and isinstance(polys[0][0], (list, tuple)) else [polys]):
        d.polygon([tuple(p) for p in pts], fill=255)
    m = np.array(m)
    if dil: m = cv2.dilate(m, np.ones((dil, dil), np.uint8))
    return m

def build(spec):
    """Recorta las capas. Cada capa: poly (lo que se mueve), hidden (lo tapado
    que se reconstruye), fill (lo que hay detrás en la placa), handles."""
    rgba = cutout(spec['src'])
    h, w = rgba.shape[:2]
    rgb = np.ascontiguousarray(rgba[..., :3]); a = np.ascontiguousarray(rgba[..., 3])
    hole_fill = np.zeros((h, w), np.uint8); hole_clear = np.zeros((h, w), np.uint8)
    layers = []
    polys = {L['name']: poly_mask(rgba.shape, L['poly']) for L in spec['layers'] if L.get('poly')}
    for L in spec['layers']:
        if L.get('plate'): continue
        m = polys[L['name']].copy()
        for e in L.get('exclude', []): m[poly_mask(rgba.shape, e) > 0] = 0
        src_rgb, src_a = rgb, a
        # lo que tapa otra parte (dibujada encima) no entra con su trazo: se
        # rellena con el color plano de esta parte, por si asoma al moverse
        cover = np.zeros_like(m)
        for n in L.get('under', []): cover = np.maximum(cover, cv2.erode(polys[n], np.ones((5, 5), np.uint8)))
        hid = poly_mask(rgba.shape, L['hidden']) if L.get('hidden') else np.zeros_like(m)
        hid = np.maximum(hid, cover & m); hid[(m > 0) & (cover == 0)] = 0
        if hid.any():
            own = (m > 0) & (hid == 0) & (a > 200)
            px = rgb[own]; light = px[px.min(axis=1) > 120]
            col = np.median(light if len(light) > 50 else px, axis=0)
            src_rgb = rgb.copy(); src_rgb[hid > 0] = col
            if L.get('hidden_shift'):
                # mejor que el color plano: la tela de la parte que tapa, corrida, con sus pliegues
                dx, dy_ = L['hidden_shift']
                inner = cv2.erode(cover, np.ones((17, 17), np.uint8)) > 0
                ys, xs = np.nonzero(hid > 0)
                sx = np.clip(xs + dx, 0, w - 1); sy = np.clip(ys + dy_, 0, h - 1)
                ok = inner[sy, sx]
                src_rgb[ys[ok], xs[ok]] = rgb[sy[ok], sx[ok]]
            src_a = a.copy(); src_a[hid > 0] = 255
            m = np.maximum(m, hid)
            # y el borde de lo reconstruido lleva trazo, como el resto de la figura
            dark = px[px.min(axis=1) < 90]
            ink = np.median(dark, axis=0) if len(dark) > 20 else np.array([31, 36, 82])
            edge = (m > 0) & (cv2.erode(m, np.ones((7, 7), np.uint8)) == 0) & (hid > 0)
            edge &= cv2.dilate(cover, np.ones((9, 9), np.uint8)) > 0
            src_rgb[edge] = ink
        hole = m.copy()
        m = cv2.dilate(m, np.ones((3, 3), np.uint8))
        part = np.dstack([src_rgb, (src_a.astype(np.uint16) * m // 255).astype(np.uint8)])
        layers.append({**L, 'img': part})
        fill = poly_mask(rgba.shape, L['fill']) > 0 if L.get('fill') else np.zeros_like(hole, bool)
        hole_fill |= ((hole > 0) & fill).astype(np.uint8); hole_clear |= ((hole > 0) & ~fill).astype(np.uint8)
    pa = a.copy(); pa[hole_clear > 0] = 0
    # detrás de una parte que se mueve va el color plano de la tela (sin rayas de inpaint)
    prgb = rgb.copy()
    if hole_fill.any():
        ring = (cv2.dilate(hole_fill, np.ones((25, 25), np.uint8)) > 0) & (hole_fill == 0) & (a > 200)
        px = rgb[ring]; px = px[px.min(axis=1) > 120] if (px.min(axis=1) > 120).sum() > 50 else px
        col = np.median(px, axis=0) if len(px) else np.array([200, 190, 170])
        prgb[hole_fill > 0] = col
        pa[hole_fill > 0] = 255
    plate_spec = next((L for L in spec['layers'] if L.get('plate')), {'name': 'placa', 'plate': True, 'handles': {}})
    plate = {**plate_spec, 'img': np.dstack([prgb, pa])}
    order = []
    for L in spec['layers']:
        order.append(plate if L.get('plate') else next(x for x in layers if x['name'] == L['name']))
    return rgba, order

# ---------------------------------------------------------------- MLS rígido
def mls_rigid(v, p, q, alpha=1.0):
    """v (m,2) puntos destino; p (n,2) controles en destino; q (n,2) en origen.
    Devuelve el origen de cada v (mapa inverso)."""
    d2 = ((v[:, None, :] - p[None, :, :]) ** 2).sum(-1)
    w = 1.0 / (d2 + 1e-3) ** alpha
    sw = w.sum(1, keepdims=True)
    ps = (w[..., None] * p[None]).sum(1) / sw
    qs = (w[..., None] * q[None]).sum(1) / sw
    ph = p[None] - ps[:, None]; qh = q[None] - qs[:, None]
    vh = v - ps
    d = (ph * vh[:, None]).sum(-1)
    c = ph[..., 0] * vh[:, None, 1] - ph[..., 1] * vh[:, None, 0]
    fx = (w * (qh[..., 0] * d - qh[..., 1] * c)).sum(1)
    fy = (w * (qh[..., 0] * c + qh[..., 1] * d)).sum(1)
    fr = np.stack([fx, fy], -1)
    n = np.linalg.norm(fr, axis=1, keepdims=True)
    vn = np.linalg.norm(vh, axis=1, keepdims=True)
    return vn * fr / np.maximum(n, 1e-9) + qs

def warp(img, handles, moved, step=4, margin=40):
    """handles: {nombre: (x,y)} originales; moved: {nombre: (x,y)} nuevos
    (los que faltan quedan fijos). Deforma img (RGBA) y lo devuelve del mismo tamaño."""
    names = list(handles)
    q = np.array([handles[k] for k in names], float)
    p = np.array([moved.get(k, handles[k]) for k in names], float)
    if np.allclose(p, q): return img
    H, W = img.shape[:2]
    ys, xs = np.nonzero(img[..., 3] > 2)
    if len(xs) == 0: return img
    disp = int(np.abs(p - q).max()) + margin
    x0, x1 = max(xs.min() - disp, 0), min(xs.max() + disp + 1, W)
    y0, y1 = max(ys.min() - disp, 0), min(ys.max() + disp + 1, H)
    gx = np.arange(x0, x1 + step, step); gy = np.arange(y0, y1 + step, step)
    G = np.stack(np.meshgrid(gx, gy), -1).reshape(-1, 2).astype(float)
    S = mls_rigid(G, p, q).reshape(len(gy), len(gx), 2).astype(np.float32)
    mx = cv2.resize(S[..., 0], (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
    my = cv2.resize(S[..., 1], (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
    out = np.zeros_like(img)
    out[y0:y1, x0:x1] = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    return out

def over(dst, src):
    sa = src[..., 3:4].astype(np.float32) / 255; da = dst[..., 3:4].astype(np.float32) / 255
    oa = sa + da * (1 - sa)
    oc = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([oc, oa * 255]).clip(0, 255).astype(np.uint8)

def steam(out, puffs, t, dur, ink=(31, 36, 82)):
    """vapor a tinta: dos ondas que suben y se desvanecen, en bucle"""
    layer = np.zeros_like(out)
    for (x, y, off) in puffs:
        u = ((t / dur) * 1.5 + off) % 1          # cada hilo sube una vez y media por bucle
        rise = 46 * u
        alpha = math.sin(u * math.pi) ** 0.8 * 0.75
        pts = []
        for k in range(14):
            s = k / 13
            px = x + 5 * math.sin(s * 2 * math.pi * 1.1 + u * 4) * (0.4 + s)
            py = y - rise - 26 * s
            pts.append((px, py))
        pts = np.array(pts, np.int32).reshape(-1, 1, 2)
        tmp = np.zeros(out.shape[:2], np.uint8)
        cv2.polylines(tmp, [pts], False, 255, 3, cv2.LINE_AA)
        tmp = (tmp.astype(np.float32) * alpha).astype(np.uint8)
        col = np.zeros_like(out); col[..., :3] = ink; col[..., 3] = tmp
        layer = over(layer, col)
    return over(out, layer)

def render(spec, order, t):
    pose = spec['pose'](t)          # {capa: {handle: (x, y)}}
    out = None
    if pose.get('_swap') and spec.get('swap'):
        # la pierna de atrás pasa adelante al cruzar: se dibuja encima
        a, b = spec['swap']; names = [L['name'] for L in order]
        ia, ib = names.index(a), names.index(b)
        order = list(order); order[ia], order[ib] = order[ib], order[ia]
    for L in order:
        img = warp(L['img'], L.get('handles', {}), pose.get(L['name'], {})) if L.get('handles') else L['img']
        out = img if out is None else over(out, img)
    if spec.get('steam'): out = steam(out, spec['steam'], t, spec['dur'])
    return out

# ---------------------------------------------------------------- cinemática
def ang(a, b):
    """ángulo del segmento a→b medido desde «hacia abajo», positivo hacia la derecha"""
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))

def polar(o, L, deg):
    r = math.radians(deg); return (o[0] + L * math.sin(r), o[1] + L * math.cos(r))

def rot(pt, c, deg):
    r = math.radians(deg); dx, dy = pt[0] - c[0], pt[1] - c[1]
    return (c[0] + dx * math.cos(r) - dy * math.sin(r), c[1] + dx * math.sin(r) + dy * math.cos(r))

def leg_fk(h, thigh, shin, foot_pts, dthigh, dshin, shift=(0, 0)):
    """h: cadera; thigh/shin: (origen, destino) originales; foot_pts: puntos del
    pie; dthigh/dshin: cambio de ángulo. Devuelve {rodilla, tobillo, pie…}."""
    H = (h[0] + shift[0], h[1] + shift[1])
    L1 = math.dist(*thigh); L2 = math.dist(*shin)
    a1 = ang(*thigh) + dthigh; a2 = ang(*shin) + dshin
    K = polar(H, L1, a1); A = polar(K, L2, a2)
    out = {'rodilla': K, 'tobillo': A}
    for k, pt in foot_pts.items():
        d = (pt[0] - shin[1][0], pt[1] - shin[1][1])
        rr = math.radians(dshin)
        out[k] = (A[0] + d[0] * math.cos(rr) - d[1] * math.sin(rr), A[1] + d[0] * math.sin(rr) + d[1] * math.cos(rr))
    return out

def walk_angles(phase, amp=14, bend=32):
    """phase en grados; muslo = amp·sin, rodilla se dobla al pasar adelante (cos>0)."""
    s = math.sin(math.radians(phase)); c = math.cos(math.radians(phase))
    thigh = amp * s
    knee = bend * max(0.0, c) ** 1.4
    return thigh, thigh - knee

def debug(spec, path, crop=None):
    im = Image.open(spec['src']).convert('RGB'); d = ImageDraw.Draw(im)
    cols = ['red', 'blue', 'green', 'magenta', 'orange', 'cyan']
    for i, L in enumerate(spec['layers']):
        c = cols[i % 6]
        if L.get('poly'): d.line(L['poly'] + [L['poly'][0]], fill=c, width=3)
        for e in L.get('hidden', []) if L.get('hidden') and isinstance(L['hidden'][0][0], (list, tuple)) else ([L['hidden']] if L.get('hidden') else []):
            d.line(e + [e[0]], fill='black', width=2)
        for k, (x, y) in L.get('handles', {}).items():
            d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=c, outline='white'); d.text((x + 8, y - 6), k, fill=c)
    if crop: im = im.crop(crop)
    im.save(path)
