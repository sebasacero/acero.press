# Las cinco ilustraciones animadas por partes. Coordenadas en píxeles del PNG original (848×1264).
import math, os
# Los PNG originales (848×1264) no están en el repo: viven en la carpeta del proyecto
D = os.environ.get('PERSONAJES_DIR', '/mnt/project-files/micra-app/personajes-28oct') + '/'
TAU = 2 * math.pi
def ease(x): x = max(0, min(1, x)); return x * x * (3 - 2 * x)
def seg(t, a, b): return ease((t - a) / (b - a))

def ruana_pose(t, dur=1.6):
    c = (1 - math.cos(TAU * t / dur)) / 2
    return {'pierna_atras': {'a': -17 * c}, 'pierna_adelante': {'a': 12 * c}, 'brazo_termo': {'a': -3.5 * c}, '_all': {'ty': -10 * c}}

def carrito_pose(t, dur=1.6):
    c = (1 - math.cos(TAU * t / dur)) / 2
    return {'pierna_atras': {'a': -10 * c}, 'pierna_adelante': {'a': 6 * c}, '_all': {'ty': -6 * c}}

def aeropress_pose(t, dur=2.8):
    u = t / dur
    d = 16 * (seg(u, 0.08, 0.62) if u < 0.75 else 1 - seg(u, 0.78, 0.96))
    y0, y1 = 380, 505   # codo y mano: el antebrazo baja sin despegarse del codo
    return {'brazo': {'piv': (330, y0), 'sy': 1 + d / (y1 - y0)}, 'embolo': {'ty': d}, '_all': {'ty': 0}}

def servir_pose(t, dur=2.4):
    w = TAU * t / dur
    return {'termo': {'a': -4 * (1 - math.cos(w)) / 2}, '_all': {}}

def caminando_pose(t, dur=1.4):
    w = TAU * t / dur
    l = max(0, math.sin(w)); r = max(0, -math.sin(w))
    return {
        'pierna_izq': {'piv': (380, 705), 'sy': 1 - 0.045 * l, 'tx': 2 * l},
        'pierna_der': {'piv': (480, 705), 'sy': 1 - 0.045 * r, 'tx': -2 * r},
        'termo': {'a': 7 * math.sin(w)},
        '_all': {'tx': 4 * math.sin(w), 'ty': -5 * abs(math.cos(w))},
    }

FIGS = {
  'ruana': {'src': D + '03-barista-ruana.png', 'dur': 1.6, 'pose': ruana_pose, 'layers': [
    {'name': 'pierna_atras', 'poly': [(288,798),(345,792),(372,880),(388,950),(396,1000),(392,1175),(195,1175),(195,1005),(245,945),(290,880)], 'piv': (330,800)},
    {'name': 'pierna_adelante', 'poly': [(345,792),(400,775),(505,768),(508,880),(503,1000),(512,1105),(585,1175),(585,1212),(408,1212),(404,1060),(388,950),(372,880)], 'piv': (440,780)},
    {'name': 'ruedo', 'static': True, 'poly': [(282,690),(518,690),(518,795),(400,785),(345,805),(282,815)]},
    {'name': 'brazo_termo', 'poly': [(205,535),(292,535),(300,690),(312,725),(312,962),(212,962),(214,722),(198,655)], 'piv': (252,530), 'fill': [(150,520),(320,520),(330,800),(200,830),(150,700)]},
  ]},
  'carrito': {'src': D + '05-barista-empujando-carrito.png', 'dur': 1.6, 'pose': carrito_pose, 'layers': [
    {'name': 'pierna_atras', 'poly': [(240,650),(265,650),(300,760),(330,890),(270,960),(240,1000),(250,1050),(258,1118),(100,1118),(100,1000),(150,960),(200,880),(240,800),(255,720)], 'piv': (275,690), 'exclude': [[(105,772),(300,772),(285,830),(272,888),(105,888)]]},
    {'name': 'pierna_adelante', 'poly': [(265,650),(300,760),(330,890),(345,1000),(380,1060),(412,1120),(585,1120),(585,1045),(470,1038),(425,1020),(415,870),(425,760),(420,640)], 'piv': (345,680), 'fill': [(262,648),(300,760),(330,890),(345,960),(392,960),(380,648)]},
    {'name': 'cadera', 'static': True, 'poly': [(205,560),(430,560),(430,648),(345,650),(265,652),(205,665)]},
  ]},
  'aeropress': {'src': D + '01-barista-carrito.png', 'dur': 2.8, 'pose': aeropress_pose, 'layers': [
    {'name': 'embolo', 'poly': [(386,512),(442,512),(442,548),(386,548)]},
    {'name': 'brazo', 'poly': [(298,372),(348,368),(382,438),(426,468),(452,488),(452,512),(380,512),(368,472),(298,402)]},
  ]},
  'servir': {'src': D + '07-barista-carrito-sombrilla.png', 'dur': 2.4, 'pose': servir_pose, 'layers': [
    {'name': 'termo', 'poly': [(235,415),(400,405),(440,440),(462,505),(300,575),(270,540)], 'piv': (300,470), 'fill': [(200,400),(440,400),(440,600),(200,600)]},
  ]},
  'caminando': {'src': D + '02-barista-termo-aeropress.png', 'dur': 1.4, 'pose': caminando_pose, 'layers': [
    {'name': 'pierna_der', 'poly': [(428,712),(548,700),(512,800),(497,900),(482,1000),(492,1132),(455,1132),(455,1100),(430,1095)]},
    {'name': 'pierna_izq', 'poly': [(318,712),(428,712),(430,1095),(456,1100),(456,1202),(378,1202),(372,1000),(330,800)]},
    {'name': 'short', 'static': True, 'poly': [(300,640),(548,640),(548,712),(300,725)]},
    {'name': 'termo', 'poly': [(240,640),(300,640),(305,700),(325,870),(260,880),(236,720)], 'piv': (272,650)},
  ]},
}
