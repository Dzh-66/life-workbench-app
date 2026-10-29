# -*- coding: utf-8 -*-
"""任务笔记工作台 - 图标生成器（仅用 Python 标准库，无第三方依赖）
绘制：深色圆角方 + 霓虹渐变描边 + 发光的生长树（三分支）。
输出到 ../icons/：icon-192.png / icon-512.png / icon-maskable-512.png / icon-180.png
"""
import struct, zlib, math, os

CYAN = (0, 240, 255)
PINK = (255, 43, 214)
GREEN = (57, 255, 136)
YELLOW = (255, 217, 79)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

class Canvas:
    def __init__(self, s):
        self.s = s
        self.px = [[[0, 0, 0, 0] for _ in range(s)] for _ in range(s)]  # RGBA

    def blend(self, x, y, color, alpha):
        if x < 0 or y < 0 or x >= self.s or y >= self.s:
            return
        p = self.px[y][x]
        a = clamp(alpha, 0, 1)
        if a <= 0:
            return
        na = a + p[3] * (1 - a)
        if na <= 0:
            return
        for i in range(3):
            p[i] = int((color[i] * a + p[i] * p[3] * (1 - a)) / na)
        p[3] = na

    def fill_circle(self, cx, cy, r, color, alpha=1.0):
        r2 = r * r
        x0, x1 = int(cx - r) - 1, int(cx + r) + 1
        y0, y1 = int(cy - r) - 1, int(cy + r) + 1
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2
                if d2 <= r2:
                    self.blend(x, y, color, alpha)

    def glow_circle(self, cx, cy, r, color, layers=4, core_alpha=1.0):
        for i in range(layers, 0, -1):
            rr = r * (1 + 0.45 * (layers - i + 1) / layers)
            self.fill_circle(cx, cy, rr, color, alpha=core_alpha * 0.10 * (i / layers) * (i / layers))

    def thick_line(self, x0, y0, x1, y1, w, color):
        """圆头粗线：对线段邻域逐像素判断距离"""
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy
        r = w / 2.0
        r2 = r * r
        pad = int(r) + 2
        xlo, xhi = int(min(x0, x1)) - pad, int(max(x0, x1)) + pad
        ylo, yhi = int(min(y0, y1)) - pad, int(max(y0, y1)) + pad
        for y in range(ylo, yhi + 1):
            for x in range(xlo, xhi + 1):
                px, py = x + 0.5, y + 0.5
                if L2 < 1e-6:
                    d2 = (px - x0) ** 2 + (py - y0) ** 2
                else:
                    t = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1)
                    d2 = (px - (x0 + t * dx)) ** 2 + (py - (y0 + t * dy)) ** 2
                if d2 <= r2:
                    self.blend(x, y, color, 1.0)

    def rounded_rect_bg(self, radius, maskable=False):
        """渐变背景；maskable 满幅无圆角，常规版圆角外透明。
        存储约定：RGB 通道存原始 0-255 值，alpha 存归一化 [0,1]（与 blend 一致）。"""
        s = self.s
        top, bottom = (26, 34, 64), (11, 14, 26)
        r = radius
        for y in range(s):
            for x in range(s):
                if maskable:
                    in_rect = True
                else:
                    in_rect = (r <= x < s - r) or (r <= y < s - r) or (
                        (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r) or (
                        (x + 0.5 - (s - r)) ** 2 + (y + 0.5 - r) ** 2 <= r * r) or (
                        (x + 0.5 - r) ** 2 + (y + 0.5 - (s - r)) ** 2 <= r * r) or (
                        (x + 0.5 - (s - r)) ** 2 + (y + 0.5 - (s - r)) ** 2 <= r * r)
                if in_rect:
                    t = y / (s - 1)
                    col = [int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)]
                    self.px[y][x] = [col[0], col[1], col[2], 1.0]

    def border_glow(self, radius, color_from, color_to):
        """沿圆角矩形边缘的渐变霓虹描边 + 外发光"""
        s = self.s
        r = radius
        for y in range(s):
            for x in range(s):
                # 到圆角矩形边缘的距离（负值在内部）
                d = 1e9
                px, py = x + 0.5, y + 0.5
                # 中心矩形区域
                if r <= px <= s - r or r <= py <= s - r:
                    inside = (r <= px <= s - r) and (r <= py <= s - r)
                    # 到四条边的距离
                    d = min(abs(py - 0), abs(py - s), abs(px - 0), abs(px - s))
                    if inside:
                        d = -min(min(px - r, s - r - px), min(py - r, s - r - py))
                    else:
                        # 在边缘带的角区外部
                        pass
                else:
                    # 四个圆角附近：到最近圆心距离 - r
                    cxs = (r, s - r, r, s - r)
                    cys = (r, r, s - r, s - r)
                    d = min(math.hypot(px - cxs[i], py - cys[i]) for i in range(4)) - r
                if -2.2 <= d <= 3.5:
                    t = clamp((px + py) / (2 * s), 0, 1)
                    col = [int(color_from[i] + (color_to[i] - color_from[i]) * t) for i in range(3)]
                    if d < 0:  # 内侧描边
                        self.blend(x, y, col, 0.9)
                    elif d <= 1.5:  # 紧贴外缘
                        self.blend(x, y, col, 0.85)
                    elif d <= 3.5:  # 外发光
                        self.blend(x, y, col, 0.28 * (3.5 - d) / 2.0)

    def draw_tree(self, scale=1.0):
        s = self.s
        cx = s / 2
        base = s * 0.82
        top = s * 0.38
        # 主干（青色）
        self.thick_line(cx, base, cx, top, s * 0.032, CYAN)
        # 三分支
        self.thick_line(cx, top * 1.05, cx - s * 0.17, s * 0.22, s * 0.024, PINK)
        self.thick_line(cx, top * 1.05, cx + s * 0.18, s * 0.20, s * 0.024, GREEN)
        self.thick_line(cx, top, cx, s * 0.13, s * 0.022, CYAN)
        # 树根横线
        self.thick_line(cx - s * 0.10, base + s * 0.02, cx + s * 0.10, base + s * 0.02, s * 0.02, YELLOW)
        # 叶（发光圆）
        lr = s * 0.045
        self.glow_circle(cx - s * 0.17, s * 0.22, lr, PINK)
        self.glow_circle(cx + s * 0.18, s * 0.20, lr, GREEN)
        self.glow_circle(cx, s * 0.13, lr, CYAN)
        self.glow_circle(cx - s * 0.10, s * 0.17, lr * 0.7, YELLOW)
        self.glow_circle(cx + s * 0.10, s * 0.16, lr * 0.7, PINK)
        self.glow_circle(cx - s * 0.07, s * 0.28, lr * 0.62, GREEN)
        self.glow_circle(cx + s * 0.08, s * 0.27, lr * 0.62, CYAN)

    def save(self, path):
        raw = b""
        for y in range(self.s):
            raw += b"\x00"
            for x in range(self.s):
                p = self.px[y][x]
                # 通道为原始 0-255，alpha 为归一化 [0,1]
                raw += bytes([clamp(int(p[0]), 0, 255), clamp(int(p[1]), 0, 255), clamp(int(p[2]), 0, 255), clamp(int(p[3] * 255), 0, 255)])
        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        ihdr = struct.pack(">IIBBBBB", self.s, self.s, 8, 6, 0, 0, 0)
        png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
        with open(path, "wb") as f:
            f.write(png)

def render(size, maskable, out):
    c = Canvas(size)
    c.rounded_rect_bg(size * 0.22, maskable)
    c.border_glow(size * 0.22, CYAN, PINK)
    if maskable:
        c.draw_tree(0.74)  # 内容缩到安全区（80% 圆形安全区）
    else:
        c.draw_tree(1.0)
    c.save(out)
    print("已生成", out)

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    render(192, False, os.path.join(out_dir, "icon-192.png"))
    render(512, False, os.path.join(out_dir, "icon-512.png"))
    render(512, True, os.path.join(out_dir, "icon-maskable-512.png"))
    render(180, False, os.path.join(out_dir, "icon-180.png"))
