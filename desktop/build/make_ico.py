#!/usr/bin/env python3
"""Windows icon (.ico) from the app's 512px icon: rounded corners; the small
sizes (16-32px, where the lettering can't be read) show just the die.

    python3 make_ico.py icon-512.png out.ico [out-rounded.png]
"""
import io, struct, sys
from PIL import Image, ImageDraw

src = Image.open(sys.argv[1]).convert('RGBA').resize((512, 512), Image.LANCZOS)
BG = src.getpixel((8, 8))


def rounded(img, radius_frac=0.2):
    s = img.size[0]
    mask = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * radius_frac), fill=255)
    mask = mask.resize((s, s), Image.LANCZOS)
    out = img.copy()
    out.putalpha(Image.composite(img.getchannel('A'), Image.new('L', (s, s), 0), mask))
    return out


full = rounded(src)
# the die alone, centred on the background colour
die = Image.new('RGBA', (512, 512), BG)
crop = src.crop((92, 48, 392, 348)).resize((440, 440), Image.LANCZOS)
die.alpha_composite(crop, (36, 36))
small = rounded(die)


def frame(size):
    img = (small if size <= 32 else full).resize((size, size), Image.LANCZOS)
    if size >= 256:
        b = io.BytesIO(); img.save(b, 'PNG'); return img, b.getvalue()
    # classic DIB frame: BITMAPINFOHEADER + BGRA rows bottom-up + AND mask
    px = img.tobytes('raw', 'BGRA')
    rows = [px[y * size * 4:(y + 1) * size * 4] for y in range(size)][::-1]
    mask_row = align4 = ((size + 31) // 32) * 4
    hdr = struct.pack('<IiiHHIIiiII', 40, size, size * 2, 1, 32, 0, size * size * 4 + mask_row * size, 0, 0, 0, 0)
    return img, hdr + b''.join(rows) + b'\0' * (align4 * size)


sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
frames = [frame(s) for s in sizes]
out = struct.pack('<HHH', 0, 1, len(frames))
off = 6 + 16 * len(frames)
blobs = b''
for s, (_, blob) in zip(sizes, frames):
    out += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(blob), off + len(blobs))
    blobs += blob
open(sys.argv[2], 'wb').write(out + blobs)
if len(sys.argv) > 3:
    full.save(sys.argv[3])
print(sys.argv[2], len(out + blobs), 'bytes')
