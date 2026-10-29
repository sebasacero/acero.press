# Rigs de los cinco personajes (coordenadas del PNG original 848×1264).
import math, os
from titere import leg_fk, walk_angles, rot, ang

D = os.environ.get('PERSONAJES_DIR', '/mnt/project-files/micra-app/personajes-28oct') + '/'
TAU = 2 * math.pi
def ease(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def seg(t, a, b): return ease((t - a) / (b - a))
def sh(pts, dx, dy): return {k: (x + dx, y + dy) for k, (x, y) in pts.items()}

# ---------------------------------------------------------------- ruana
R_BACK = {'cadera': (335, 800), 'top_l': (290, 818), 'top_r': (345, 818), 'rodilla': (282, 975), 'tobillo': (262, 1058), 'talon': (232, 1072), 'punta': (342, 1150)}
R_FRONT = {'cadera': (445, 782), 'top_l': (350, 794), 'top_r': (500, 772), 'rodilla': (470, 960), 'tobillo': (482, 1128), 'talon': (420, 1182), 'punta': (575, 1182)}
R_PLATE = {'cabeza': (430, 190), 'hombro_i': (300, 320), 'hombro_d': (560, 320), 'cintura': (420, 560), 'ruana_i': (160, 560), 'ruana_d': (590, 580),
           'ruedo_i': (210, 790), 'ruedo_c': (420, 760), 'ruedo_d': (560, 770), 'mano_aero': (665, 420), 'termo_bolso': (355, 610)}
R_ARM = {'hombro': (250, 540), 'codo': (240, 640), 'mano': (262, 712), 'termo': (262, 900)}

def leg_pose(L, phase, amp, bend, dy):
    th, sn = walk_angles(phase, amp, bend)
    thigh = (L['cadera'], L['rodilla']); shin = (L['rodilla'], L['tobillo'])
    return leg_fk(L['cadera'], thigh, shin, {'talon': L['talon'], 'punta': L['punta']},
                  th - ang(*thigh), sn - ang(*shin), shift=(0, dy))

def walker(front, back, phase0, amp, bend, ground):
    """calcula las dos piernas y cuánto sube el cuerpo para que el pie de apoyo pise el suelo"""
    def at(u, dy=0.0):
        f = leg_pose(front, phase0 + 360 * u, amp, bend, dy)
        b = leg_pose(back, phase0 + 180 + 360 * u, amp, bend, dy)
        return f, b
    def pose(u):
        f, b = at(u)
        low = max(f['talon'][1], f['punta'][1], b['talon'][1], b['punta'][1])
        dy = ground - low
        f, b = at(u, dy)
        for L, src in ((f, front), (b, back)):
            for k in ('cadera', 'top_l', 'top_r'): L[k] = (src[k][0], src[k][1] + dy)
        ps = (phase0 + 360 * u) % 360
        return f, b, dy, math.sin(math.radians(ps + 180)) > math.sin(math.radians(ps))
    return pose

ruana_walk = walker(R_FRONT, R_BACK, 137, 15, 34, 1182)

def ruana_pose(t, dur=1.7):
    u = (t / dur) % 1
    f, b, dy, swap = ruana_walk(u)
    w = TAU * u
    # la ruana sigue al cuerpo con retraso y se abre un poco en cada paso
    lag = -6 * math.sin(2 * w - 1.2)
    sway = 4 * math.sin(2 * w)
    plate = sh(R_PLATE, 0, dy)
    for k in ('ruedo_i', 'ruedo_c', 'ruedo_d'): plate[k] = (plate[k][0] + sway * (1 if k != 'ruedo_d' else 1.4), plate[k][1] + lag)
    plate['ruana_i'] = (plate['ruana_i'][0] + sway * 0.6, plate['ruana_i'][1] + lag * 0.5)
    plate['ruana_d'] = (plate['ruana_d'][0] + sway * 0.6, plate['ruana_d'][1] + lag * 0.5)
    plate['cabeza'] = (plate['cabeza'][0] + 2 * math.sin(2 * w + 0.5), plate['cabeza'][1] + dy * 0.85)
    arm = sh(R_ARM, 0, dy)
    swing = 7 * math.sin(w + 0.4)
    arm['mano'] = rot(arm['mano'], arm['hombro'], swing); arm['termo'] = rot(arm['termo'], arm['hombro'], swing * 1.15)
    arm['codo'] = rot(arm['codo'], arm['hombro'], swing * 0.6)
    return {'pierna_atras': b, 'pierna_adelante': f, 'placa': plate, 'brazo_termo': arm, '_swap': swap}

RUANA = {'src': D + '03-barista-ruana.png', 'dur': 1.7, 'pose': ruana_pose, 'swap': ('pierna_atras', 'pierna_adelante'), 'steam': [(664, 300, 0.0), (676, 300, 0.5)], 'layers': [
    {'name': 'pierna_atras', 'poly': [(290,816),(345,816),(372,880),(388,950),(396,1000),(392,1175),(195,1175),(195,1005),(245,945),(290,880)],
     'under': ['pierna_adelante'],
     'handles': R_BACK},
    {'name': 'brazo_termo', 'poly': [(205,535),(292,535),(300,690),(312,725),(312,962),(212,962),(214,722),(198,655)],
     'fill': [(150,520),(320,520),(330,800),(200,830),(150,700)], 'handles': R_ARM},
    {'name': 'placa', 'plate': True, 'handles': R_PLATE},
    {'name': 'pierna_adelante', 'poly': [(345,792),(400,775),(505,768),(508,880),(503,1000),(512,1105),(585,1175),(585,1212),(408,1212),(404,1060),(388,950),(372,880)],
     'handles': R_FRONT},
]}


# ---------------------------------------------------------------- carrito (05)
C_BACK = {'cadera': (268, 690), 'top_l': (238, 652), 'top_r': (268, 652), 'rodilla': (205, 850), 'tobillo': (150, 985), 'talon': (88, 1040), 'punta': (195, 1075)}
C_FRONT = {'cadera': (350, 680), 'top_l': (272, 648), 'top_r': (415, 642), 'rodilla': (395, 850), 'tobillo': (405, 1005), 'talon': (372, 1065), 'punta': (515, 1072)}
C_PLATE = {'cabeza': (400, 230), 'capucha': (300, 330), 'hombro': (330, 330), 'espalda': (285, 500), 'cintura': (330, 600), 'cadera_c': (340, 640),
           'codo': (470, 560), 'mano_mango': (548, 622), 'brazo_alto': (590, 220), 'mano_alta': (640, 110),
           'carro_a': (660, 700), 'carro_b': (700, 950), 'mesa': (150, 780), 'mesa_b': (200, 880), 'piso': (420, 1150)}
carrito_walk = walker(C_FRONT, C_BACK, 137, 12, 30, 1092)

def carrito_pose(t, dur=1.5):
    u = (t / dur) % 1
    f, b, dy, swap = carrito_walk(u)
    w = TAU * u
    plate = dict(C_PLATE)
    for k in ('cabeza', 'capucha', 'hombro', 'espalda', 'cintura', 'cadera_c', 'codo'): plate[k] = (C_PLATE[k][0], C_PLATE[k][1] + dy)
    plate['codo'] = (C_PLATE['codo'][0], C_PLATE['codo'][1] + dy * 0.6)
    plate['brazo_alto'] = (C_PLATE['brazo_alto'][0] + 3 * math.sin(2 * w), C_PLATE['brazo_alto'][1] + dy * 0.9)
    plate['mano_alta'] = (C_PLATE['mano_alta'][0] + 6 * math.sin(2 * w - 0.6), C_PLATE['mano_alta'][1] + dy * 0.8 - 3 * math.sin(2 * w - 0.6))
    plate['cabeza'] = (C_PLATE['cabeza'][0] + 2 * math.sin(2 * w + 0.4), C_PLATE['cabeza'][1] + dy * 0.9)
    return {'pierna_atras': b, 'pierna_adelante': f, 'placa': plate, '_swap': swap}

CARRITO = {'src': D + '05-barista-empujando-carrito.png', 'dur': 1.5, 'pose': carrito_pose, 'swap': ('pierna_atras', 'pierna_adelante'), 'steam': [(690, 495, 0.0), (706, 500, 0.45), (778, 495, 0.2)], 'layers': [
    {'name': 'pierna_atras', 'poly': [(238,652),(268,652),(300,760),(330,890),(270,960),(240,1000),(250,1050),(258,1118),(100,1118),(100,1000),(150,960),(200,880),(240,800),(252,720)],
     'exclude': [[(105,772),(300,772),(285,830),(272,888),(105,888)]], 'hidden': [(268,652),(300,760),(330,890),(375,890),(348,760),(335,652)], 'hidden_shift': (55, 0), 'under': ['pierna_adelante'], 'handles': C_BACK},
    {'name': 'placa', 'plate': True, 'handles': C_PLATE},
    {'name': 'pierna_adelante', 'poly': [(272,648),(300,760),(330,890),(345,1000),(380,1060),(412,1120),(585,1120),(585,1045),(470,1038),(425,1020),(415,870),(425,760),(420,640)],
     'fill': [(262,648),(300,760),(330,890),(345,960),(392,960),(380,648)], 'handles': C_FRONT},
]}

# ---------------------------------------------------------------- caminando (02, de frente)
W_L = {'cadera': (385, 712), 'top_l': (335, 714), 'top_r': (428, 712), 'rodilla': (392, 880), 'tobillo': (398, 1060), 'talon': (405, 1115), 'punta': (392, 1182)}
W_R = {'cadera': (478, 712), 'top_l': (432, 712), 'top_r': (540, 704), 'rodilla': (472, 860), 'tobillo': (462, 1030), 'talon': (470, 1085), 'punta': (452, 1125)}
W_PLATE = {'cabeza': (420, 170), 'pelo_i': (335, 240), 'pelo_d': (490, 250), 'hombro_i': (300, 330), 'hombro_d': (560, 330), 'cintura': (430, 560),
           'codo_d': (620, 400), 'mano_aero': (650, 300), 'aero': (640, 200), 'bolso': (355, 560), 'short_i': (320, 690), 'short_d': (545, 690)}
W_ARM = {'hombro': (280, 470), 'codo': (272, 560), 'mano': (268, 690), 'termo': (280, 850)}

def caminando_pose(t, dur=1.4):
    u = (t / dur) % 1
    w = TAU * u
    lift_l = max(0.0, math.sin(w)); lift_r = max(0.0, -math.sin(w))
    dy = -5 * abs(math.cos(w)) - 3
    sway = 5 * math.sin(w)
    def leg(L, lift, side):
        o = {k: (x + sway, y + dy) for k, (x, y) in L.items()}
        o['rodilla'] = (o['rodilla'][0] + 8 * lift * side, o['rodilla'][1] + 22 * lift)
        for k in ('tobillo', 'talon', 'punta'): o[k] = (o[k][0] + 3 * lift * side, o[k][1] - 42 * lift)
        return o
    L = leg(W_L, lift_l, -1); R = leg(W_R, lift_r, 1)
    plate = {k: (x + sway, y + dy) for k, (x, y) in W_PLATE.items()}
    lag = 4 * math.sin(w - 1.0)
    plate['pelo_i'] = (plate['pelo_i'][0] + lag, plate['pelo_i'][1] - 2 * math.cos(w - 1.0)); plate['pelo_d'] = (plate['pelo_d'][0] + lag, plate['pelo_d'][1] - 2 * math.cos(w - 1.0))
    plate['cabeza'] = (plate['cabeza'][0] + 1.5 * math.sin(w), plate['cabeza'][1] + 1)
    plate['mano_aero'] = (plate['mano_aero'][0] + sway * 0.4, plate['mano_aero'][1] + dy * 0.5)
    plate['aero'] = (plate['aero'][0] + sway * 0.3, plate['aero'][1] + dy * 0.4)
    arm = {k: (x + sway, y + dy) for k, (x, y) in W_ARM.items()}
    swing = 9 * math.sin(w + 0.3)
    arm['mano'] = rot(arm['mano'], arm['hombro'], swing); arm['termo'] = rot(arm['termo'], arm['hombro'], swing * 1.1); arm['codo'] = rot(arm['codo'], arm['hombro'], swing * 0.5)
    return {'pierna_der': R, 'pierna_izq': L, 'placa': plate, 'termo': arm}

CAMINANDO = {'src': D + '02-barista-termo-aeropress.png', 'dur': 1.4, 'pose': caminando_pose, 'layers': [
    {'name': 'pierna_der', 'poly': [(430,712),(548,700),(512,800),(497,900),(482,1000),(492,1132),(455,1132),(455,1100),(432,1095)], 'under': ['pierna_izq'],
     'hidden': [(430,712),(432,1095),(410,1095),(405,712)], 'handles': W_R},
    {'name': 'pierna_izq', 'poly': [(318,712),(430,712),(432,1095),(456,1100),(456,1202),(378,1202),(372,1000),(330,800)], 'handles': W_L},
    {'name': 'termo', 'poly': [(240,640),(300,640),(305,700),(325,870),(260,880),(236,720)], 'handles': W_ARM},
    {'name': 'placa', 'plate': True, 'handles': W_PLATE},
]}

# ---------------------------------------------------------------- aeropress (01)
A_ARM = {'codo': (326, 385), 'brazo_a': (300, 372), 'brazo_b': (330, 372), 'muneca': (395, 470), 'mano': (420, 500), 'dedos': (440, 510)}
A_PLATE = {'cabeza': (520, 180), 'gorra': (520, 120), 'hombro_i': (470, 300), 'hombro_d': (650, 330), 'cintura': (560, 560), 'cadera': (560, 780),
           'mano_vaso': (440, 665), 'carro': (300, 800), 'termo': (200, 600), 'rueda': (490, 1050), 'pie': (640, 1130)}

def aeropress_pose(t, dur=2.6):
    u = (t / dur) % 1
    press = seg(u, 0.08, 0.6) if u < 0.72 else 1 - seg(u, 0.76, 0.96)
    d = 18 * press
    arm = dict(A_ARM)
    for k in ('muneca', 'mano', 'dedos'): arm[k] = (A_ARM[k][0], A_ARM[k][1] + d)
    emb = {'a': (390, 512 + d), 'b': (440, 512 + d), 'c': (390, 548 + d), 'd': (440, 548 + d)}
    lean = 4 * press
    plate = dict(A_PLATE)
    plate['cabeza'] = (A_PLATE['cabeza'][0] - lean * 0.8, A_PLATE['cabeza'][1] + lean * 0.8)
    plate['gorra'] = (A_PLATE['gorra'][0] - lean * 0.8, A_PLATE['gorra'][1] + lean * 0.8)
    plate['hombro_i'] = (A_PLATE['hombro_i'][0] - lean * 0.5, A_PLATE['hombro_i'][1] + lean * 0.6)
    plate['hombro_d'] = (A_PLATE['hombro_d'][0] - lean * 0.4, A_PLATE['hombro_d'][1] + lean * 0.5)
    plate['cintura'] = (A_PLATE['cintura'][0] - lean * 0.2, A_PLATE['cintura'][1] + lean * 0.2)
    return {'brazo': arm, 'embolo': emb, 'placa': plate}

AEROPRESS = {'src': D + '01-barista-carrito.png', 'dur': 2.6, 'pose': aeropress_pose, 'steam': [(258, 500, 0.0), (276, 496, 0.55)], 'layers': [
    {'name': 'placa', 'plate': True, 'handles': A_PLATE},
    {'name': 'embolo', 'poly': [(386,512),(442,512),(442,548),(386,548)], 'handles': {'a': (390, 512), 'b': (440, 512), 'c': (390, 548), 'd': (440, 548)}},
    {'name': 'brazo', 'poly': [(298,372),(348,368),(382,438),(426,468),(452,488),(452,512),(380,512),(368,472),(298,402)], 'handles': A_ARM},
]}

# ---------------------------------------------------------------- servir (07)
S_TERMO = {'mano': (335, 450), 'dedos': (360, 440), 'cuerpo': (310, 505), 'fondo': (290, 540), 'boca': (438, 478), 'tapa': (300, 480)}
S_PLATE = {'cabeza': (345, 150), 'mono': (265, 170), 'hombro_i': (210, 300), 'hombro_d': (430, 330), 'pecho': (340, 320), 'cintura': (300, 600),
           'brazo_d': (420, 420), 'mano_d': (355, 440), 'aero': (455, 560), 'carro': (600, 850), 'pie': (300, 1100)}

def servir_pose(t, dur=2.4):
    u = (t / dur) % 1
    w = TAU * u
    tilt = -5 * (1 - math.cos(w)) / 2
    th = {k: rot(v, S_TERMO['mano'], tilt) for k, v in S_TERMO.items()}
    th['mano'] = S_TERMO['mano']; th['dedos'] = S_TERMO['dedos']
    br = 1.5 * math.sin(2 * w)
    plate = dict(S_PLATE)
    plate['hombro_i'] = (S_PLATE['hombro_i'][0], S_PLATE['hombro_i'][1] - br); plate['hombro_d'] = (S_PLATE['hombro_d'][0], S_PLATE['hombro_d'][1] - br)
    plate['pecho'] = (S_PLATE['pecho'][0], S_PLATE['pecho'][1] - br)
    plate['cabeza'] = (S_PLATE['cabeza'][0] + 2 * math.sin(w), S_PLATE['cabeza'][1] - br + 1.5 * (1 - math.cos(w)) / 2)
    plate['mono'] = (S_PLATE['mono'][0] + 2 * math.sin(w - 0.6), S_PLATE['mono'][1] - br)
    return {'termo': th, 'placa': plate}

SERVIR = {'src': D + '07-barista-carrito-sombrilla.png', 'dur': 2.4, 'pose': servir_pose, 'steam': [(455, 488, 0.0), (470, 486, 0.5), (590, 625, 0.3), (662, 640, 0.7)], 'layers': [
    {'name': 'placa', 'plate': True, 'handles': S_PLATE},
    {'name': 'termo', 'poly': [(280,448),(440,440),(448,470),(445,490),(300,560),(275,520)], 'fill': [(250,400),(460,400),(460,600),(250,600)], 'handles': S_TERMO},
]}

FIGS = {'ruana': RUANA, 'carrito': CARRITO, 'caminando': CAMINANDO, 'aeropress': AEROPRESS, 'servir': SERVIR}
