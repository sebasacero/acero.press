import sys, os
from puppet import *
from figs import FIGS
name, od = sys.argv[1], sys.argv[2]
spec = FIGS[name]
rgba, plate, layers = build(spec)
os.makedirs(od, exist_ok=True)
fps = 30
ts = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else [i / fps for i in range(round(spec['dur'] * fps))]
for i, t in enumerate(ts): Image.fromarray(render(spec, layers, plate, t)).save(f'{od}/f{i:04d}.png')
