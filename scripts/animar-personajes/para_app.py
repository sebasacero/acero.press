# Recorta al cuadro que ocupa la figura y manda los cuadros a ffmpeg (fondo crema, h264 liviano para la app).
import sys, glob, subprocess, os
import numpy as np
from PIL import Image
src, out, height, fps, crf = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
fs = sorted(glob.glob(src + '/f*.png')); ims = [Image.open(f).convert('RGBA') for f in fs]
x0 = y0 = 10**9; x1 = y1 = 0
for im in ims:
    a = np.array(im)[..., 3]; ys, xs = np.nonzero(a > 8)
    x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max()), max(y1, ys.max())
m = 10; x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), x1 + m, y1 + m
s = height / (y1 - y0); w = round((x1 - x0) * s / 2) * 2
tmp = out + '.frames'; os.makedirs(tmp, exist_ok=True)
for i, im in enumerate(ims):
    f = im.crop((x0, y0, x1, y1)).resize((w, height), Image.LANCZOS)
    bg = Image.new('RGB', f.size, '#F7F3E8'); bg.paste(f, (0, 0), f); bg.save(f'{tmp}/f{i:04d}.png')
    if i == 0: bg.save(out.replace('.mp4', '-poster.webp'), quality=70, method=6)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '30', '-i', f'{tmp}/f%04d.png', '-vf', f'fps={fps}', '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', 'slow', '-movflags', '+faststart', '-an', out], check=True)
for f in glob.glob(tmp + '/*'): os.remove(f)
os.rmdir(tmp)
print(out, (w, height), os.path.getsize(out) // 1024, 'KB', os.path.getsize(out.replace('.mp4', '-poster.webp')) // 1024, 'KB póster')
