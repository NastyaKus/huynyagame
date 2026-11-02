"""Генерирует иконку и сплэш Android из портрета героини.
Запуск из корня проекта: python3 tools/make_android_icons.py"""
import glob, os, re
from PIL import Image, ImageDraw, ImageFilter

RES = 'android/app/src/main/res'
portrait = Image.open('public/assets/portraits/hana_smile.png').convert('RGBA')
BG = (29, 20, 40, 255)
PINK = (247, 183, 210, 255)

# квадратный кроп лица
w, h = portrait.size
face = portrait.crop((0, int(h * 0.08), w, int(h * 0.08) + w))

def icon(size, round_=False, fg_only=False):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if fg_only:
        # адаптивная иконка: значимая область — центральные 66%
        inner = int(size * 0.62)
        f = face.resize((inner, inner), Image.LANCZOS)
        m = Image.new('L', (inner, inner), 0)
        ImageDraw.Draw(m).ellipse((0, 0, inner - 1, inner - 1), fill=255)
        im.paste(f, ((size - inner) // 2, (size - inner) // 2), m)
        ImageDraw.Draw(im).ellipse(((size - inner) // 2, (size - inner) // 2, (size + inner) // 2, (size + inner) // 2), outline=PINK, width=max(2, size // 60))
        return im
    base = Image.new('RGBA', (size, size), BG)
    f = face.resize((int(size * 0.92), int(size * 0.92)), Image.LANCZOS)
    base.paste(f, (int(size * 0.04), int(size * 0.06)), f)
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    if round_:
        d.ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=255)
    im.paste(base, (0, 0), m)
    d2 = ImageDraw.Draw(im)
    if round_:
        d2.ellipse((1, 1, size - 2, size - 2), outline=PINK, width=max(2, size // 40))
    else:
        d2.rounded_rectangle((1, 1, size - 2, size - 2), radius=size // 5, outline=PINK, width=max(2, size // 40))
    return im

for path in glob.glob(f'{RES}/mipmap-*/ic_launcher*.png'):
    size = Image.open(path).size[0]
    name = os.path.basename(path)
    if name == 'ic_launcher_foreground.png':
        icon(size, fg_only=True).save(path)
    else:
        icon(size, round_=name == 'ic_launcher_round.png').save(path)

def splash(wh):
    W, H = wh
    im = Image.new('RGBA', (W, H), BG)
    # мягкое розовое свечение
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(min(W, H) * 0.42)
    gd.ellipse((W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r), fill=(255, 143, 192, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(r // 3))
    im.alpha_composite(glow)
    s = int(min(W, H) * 0.42)
    ic = icon(s, round_=True)
    im.alpha_composite(ic, ((W - s) // 2, (H - s) // 2))
    return im

for path in glob.glob(f'{RES}/drawable*/splash.png'):
    splash(Image.open(path).size).convert('RGB').save(path)

# фон адаптивной иконки
for p in glob.glob(f'{RES}/values/ic_launcher_background.xml'):
    s = open(p).read()
    s = re.sub(r'#[0-9A-Fa-f]{6}', '#1D1428', s)
    open(p, 'w').write(s)
print('ok')
