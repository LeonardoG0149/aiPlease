#!/usr/bin/env python3
"""把像素素材预渲染成网页游戏用的图集，输出仓库根目录的 assets.js。

  pip install -r tools/requirements.txt
  python tools/build_assets.py

- 字体图集：扫描根目录与 content/ 下所有 JS/HTML 里出现的字符（缝合像素字体 8/10/12px）
- 精灵图集：星星、印章、圆印、徽记、对齐币
- 背景：上半店铺街景、下半木工作台
产物是一个 JS 文件（图片以 base64 内嵌），index.html 直接双击也能玩。
管线思路移植自 ip-please（MIT, ctnyanya）。
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

TOOLS = Path(__file__).resolve().parent
SITE = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from pp.base import (FONTS, GOLD, GREEN, GREY_D, PAPER, RED, SEAL, TEXT,  # noqa: E402
                     draw, speckle, spark, text_mask, txt)

CREAM = (239, 230, 208)
AMBER = (232, 163, 61)
BRICK = (142, 47, 47)
INK = (22, 19, 19)
BOOTH_WALL = (52, 48, 44)
WALL_D = (48, 45, 43)
BANNER = (112, 40, 36)
ROAD, ROAD_L = (110, 104, 94), (150, 142, 124)
GROUND_L = (104, 98, 88)
DESK, DESK_D = (68, 57, 50), (56, 47, 42)
COUNTER, COUNTER_D = (98, 86, 73), (70, 61, 52)
BOOK_L = (130, 100, 70)


def used_chars():
    chars = {chr(c) for c in range(32, 127)}
    files = sorted(SITE.glob("*.js")) + sorted((SITE / "content").glob("*.js")) + [SITE / "index.html"]
    for p in files:
        if p.name == "assets.js" or not p.exists():
            continue
        chars |= set(p.read_text(encoding="utf-8"))
    return sorted(c for c in chars if c.isprintable() and c not in "\t\r\n")


def glyph_mask(ch, size):
    im = Image.new("L", (size * 2 + 8, size * 2 + 8), 0)
    txt(draw(im), (4, 4), ch, size, 255)
    return im


def build_font():
    chars = used_chars()
    missing = []
    sheets = {}
    for size in (8, 10, 12):
        f = FONTS[size]
        notdef = glyph_mask("͸", size).tobytes()
        glyphs, cells = {}, []
        for ch in chars:
            m = glyph_mask(ch, size)
            if ch != " " and m.tobytes() == notdef:
                if size == 12:
                    missing.append(ch)
                continue
            adv = round(f.getlength(ch))
            bb = m.getbbox()
            if bb is None:
                glyphs[ch] = [0, 0, 0, 0, 0, 0, adv]
                continue
            cells.append((ch, m.crop(bb), bb[0] - 4, bb[1] - 4, adv))
        sheets[size] = (glyphs, cells)
    W = 1024
    x = y = row_h = 0
    placed = []
    for size in (8, 10, 12):
        for ch, crop, ox, oy, adv in sheets[size][1]:
            if x + crop.width > W:
                x, y, row_h = 0, y + row_h + 1, 0
            placed.append((size, ch, crop, x, y, ox, oy, adv))
            x += crop.width + 1
            row_h = max(row_h, crop.height)
    sheet = Image.new("LA", (W, y + row_h + 1), (255, 0))
    out = {8: {}, 10: {}, 12: {}}
    for size, ch, crop, gx, gy, ox, oy, adv in placed:
        sheet.paste(Image.new("LA", crop.size, (255, 255)), (gx, gy), crop)
        out[size][ch] = [gx, gy, crop.width, crop.height, ox, oy, adv]
    for size in (8, 10, 12):
        out[size].update(sheets[size][0])
    if missing:
        print("字体缺字（会被跳过）：", "".join(missing))
    return sheet, out


STAR9 = [
    "....X....",
    "...XXX...",
    "...XXX...",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "..XXXXX..",
    ".XX...XX.",
    "XX.....XX",
]


def star_sprite(fill):
    im = Image.new("RGBA", (9, 9), (0, 0, 0, 0))
    d = draw(im)
    for j, row in enumerate(STAR9):
        for i, ch in enumerate(row):
            if ch == "X":
                d.point((i, j), fill=fill)
    return im


def seal_sprite():
    im = Image.new("RGBA", (34, 34), (0, 0, 0, 0))
    d = draw(im)
    d.ellipse([0, 0, 33, 33], outline=SEAL, width=2)
    txt(d, (17, 8), "M.O.A.", 8, SEAL, anchor="ma")
    txt(d, (17, 19), "对齐部", 8, SEAL, anchor="ma")
    return im


def emblem_sprite():
    im = Image.new("RGBA", (23, 21), (0, 0, 0, 0))
    d = draw(im)
    d.ellipse([0, 0, 22, 20], outline=GOLD)
    spark(d, 11, 10, GOLD, big=False)
    return im


def stamp_sprite(word, color, seed):
    m = Image.new("L", (64, 36), 0)
    dm = draw(m)
    dm.rectangle([0, 0, 63, 35], outline=255, width=2)
    tm = text_mask(word, 12, 2)
    m.paste(tm, ((64 - tm.width) // 2, (36 - tm.height) // 2), tm)
    speckle(m, 0.10, seed)
    im = Image.new("RGBA", (64, 36), color + (0,))
    im.putalpha(m)
    return im


def coin_sprite():
    im = Image.new("RGBA", (13, 13), (0, 0, 0, 0))
    d = draw(im)
    d.ellipse([0, 0, 12, 12], fill=GOLD)
    d.ellipse([0, 0, 12, 12], outline=BOOK_L)
    txt(d, (6, 2), "币", 8, TEXT, anchor="ma")
    return im


def background():
    im = Image.new("RGB", (640, 360), DESK)
    d = draw(im)
    # 上半：店铺街景
    d.rectangle([0, 0, 639, 83], fill=BOOTH_WALL)
    for y in range(0, 84, 8):
        d.line([0, y, 639, y], fill=WALL_D)
        for x in range((y // 8 % 2) * 16, 640, 32):
            d.line([x, y, x, y + 7], fill=WALL_D)
    d.rectangle([60, 8, 260, 26], fill=BANNER)
    txt(d, (160, 13), "HELPFUL · HONEST · HARMLESS", 8, CREAM, anchor="ma")
    d.rectangle([380, 8, 580, 26], fill=BANNER)
    txt(d, (480, 13), "荣耀归于对齐部", 8, CREAM, anchor="ma")
    d.rectangle([430, 36, 560, 56], fill=PAPER)
    d.rectangle([430, 36, 560, 56], outline=TEXT)
    txt(d, (495, 41), "模型裁缝铺", 10, TEXT, anchor="ma")
    d.rectangle([0, 84, 639, 87], fill=GROUND_L)
    d.rectangle([0, 88, 639, 95], fill=ROAD)
    for x in range(4, 640, 24):
        d.rectangle([x, 91, x + 9, 92], fill=ROAD_L)
    # 下半：木工作台
    d.rectangle([0, 96, 639, 102], fill=COUNTER)
    d.rectangle([0, 102, 639, 103], fill=COUNTER_D)
    for r, y in enumerate(range(104, 360, 26)):
        d.line([0, y, 639, y], fill=DESK_D)
        for x in range((r % 2) * 60 + 30, 640, 120):
            d.line([x, y, x, min(y + 25, 359)], fill=DESK_D)
    return im


class Packer:
    def __init__(self, width=1024):
        self.width = width
        self.items = []

    def add(self, key, im, crop=True):
        im = im.convert("RGBA")
        ox = oy = 0
        if crop:
            bb = im.getchannel("A").getbbox()
            if bb:
                im = im.crop(bb)
                ox, oy = bb[0], bb[1]
        self.items.append((key, im, ox, oy))

    def build(self):
        items = sorted(self.items, key=lambda it: -it[1].height)
        x = y = row_h = 0
        pos = {}
        for key, im, ox, oy in items:
            if x + im.width > self.width:
                x, y, row_h = 0, y + row_h + 1, 0
            pos[key] = (x, y, im.width, im.height, ox, oy)
            x += im.width + 1
            row_h = max(row_h, im.height)
        sheet = Image.new("RGBA", (self.width, y + row_h + 1), (0, 0, 0, 0))
        for key, im, ox, oy in items:
            sheet.paste(im, pos[key][:2])
        return sheet, pos


def png_b64(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def main():
    font_sheet, font_meta = build_font()
    pk = Packer()
    pk.add("star1", star_sprite(AMBER), crop=False)
    pk.add("star0", star_sprite(GREY_D), crop=False)
    pk.add("seal", seal_sprite(), crop=False)
    pk.add("emblem", emblem_sprite(), crop=False)
    pk.add("stamp_good", stamp_sprite("好评", GREEN, 7), crop=False)
    pk.add("stamp_bad", stamp_sprite("差评", RED, 11), crop=False)
    pk.add("coin", coin_sprite(), crop=False)
    sheet, pos = pk.build()
    bg = background()

    blobs, sizes = {}, {}
    for name, im in (("font", font_sheet), ("atlas", sheet), ("bg", bg)):
        blobs[name], sizes[name] = png_b64(im)

    data = {"font": {str(k): v for k, v in font_meta.items()}, "sprites": pos}
    js = ["// 由 build_assets.py 生成，不要手改",
          "window.ASSETS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";",
          "window.ASSET_IMAGES = {"]
    for name, b in blobs.items():
        js.append(f'  {name}: "data:image/png;base64,{b}",')
    js.append("};")
    out = SITE / "assets.js"
    out.write_text("\n".join(js) + "\n", encoding="utf-8")
    print("字体字符数：", len(font_meta[12]), " 图集尺寸：", sheet.size)
    print("PNG 大小：", {k: f"{v / 1024:.0f}KB" for k, v in sizes.items()})
    print(f"assets.js：{out.stat().st_size / 1024:.0f}KB")


if __name__ == "__main__":
    main()