#!/usr/bin/env python3
"""
build-gifs.py — Procedurally render the three animated GIFs embedded in
README.md. Pure Python (PIL only); no ffmpeg SVG bridge needed.

Run from the project root:
    python scripts/build-gifs.py

Produces:
    gifs/chat-stream.gif     — chat typing + assistant streaming + action card
    gifs/agent-loop.gif      — prompt → stream → parse → write/run cycle
    gifs/preview-running.gif — dev server booting → ready with status pill

Designed to render quickly on a developer machine (each GIF is a couple
hundred KB, not a multi-MB screen recording). The SVG sources live in
gifs/svg/ as documentation of the same layouts.
"""
from __future__ import annotations

import math
import os
import random
import sys
from typing import Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageFont

# -- paths -----------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIF_DIR = os.path.join(ROOT, "gifs")
os.makedirs(GIF_DIR, exist_ok=True)

# -- palette ---------------------------------------------------------------
BG = (15, 23, 42)           # slate-900
PANEL = (30, 41, 59)        # slate-800
PANEL_HI = (51, 65, 85)     # slate-700
VIOLET = (124, 58, 237)
VIOLET_DEEP = (91, 33, 182)
AMBER = (251, 191, 36)
GREEN = (16, 185, 129)
GREEN_DEEP = (22, 163, 74)
RED = (239, 68, 68)
LIGHT = (226, 232, 240)
MUTED = (148, 163, 184)
FAINT = (71, 85, 105)
WHITE = (255, 255, 255)
APP_BG_TOP = (255, 255, 255)
APP_BG_BTM = (239, 246, 255)
APP_LINE = (226, 232, 240)

W, H = 720, 420
FPS = 24

# -- font loader -----------------------------------------------------------
def _font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        ("C:/Windows/Fonts/segoeui.ttf", size),
        ("C:/Windows/Fonts/consola.ttf", size),
        ("/System/Library/Fonts/Helvetica.ttc", size),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size),
    ]
    for path, sz in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, sz)
            except Exception:
                continue
    return ImageFont.load_default()

SANS_MD = _font(16)
SANS_SM = _font(13)
SANS_XS = _font(11)
MONO_XS = _font(12)
SANS_TITLE = _font(20)

# -- helpers ---------------------------------------------------------------
def text_w(d: ImageDraw.ImageDraw, s: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = d.textbbox((0, 0), s, font=font)
    return bbox[2] - bbox[0]

def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 2

def pill(d: ImageDraw.ImageDraw, xy: Tuple[int, int], label: str,
         size: Tuple[int, int], color, font: ImageFont.FreeTypeFont,
         border: int = 0, border_color=None):
    x, y = xy
    w, h = size
    r = h // 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=color)
    if border_color is not None:
        d.rounded_rectangle([x, y, x + w, y + h], radius=r, outline=border_color, width=2)
    tw = text_w(d, label, font)
    d.text((x + (w - tw) // 2, y + (h - font.size) // 2 - 1), label, fill=WHITE, font=font)

def rounded_panel(d, x, y, w, h, fill, radius=12, outline=None, width=1):
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill)
    if outline is not None:
        d.rounded_rectangle([x, y, x + w, y + h], radius=radius, outline=outline, width=width)

# ====================================================================
# 1) CHAT-STREAM GIF
# ====================================================================
def make_chat_stream(frames: int = 96) -> List[Image.Image]:
    images: List[Image.Image] = []
    prompt_full = "Build a Vite + React todo app styled with Tailwind."
    assistant_lines = [
        ("I'll write the files. Starting with package.json…", LIGHT),
        ("<boltAction type=\"file\" path=\"package.json\">", AMBER),
        ('{ "name": "todo-app", "private": true, "type": "module" }', MUTED),
        ("</boltAction>", AMBER),
    ]

    for f in range(frames):
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)

        # Header bar
        d.rectangle([0, 0, W, 48], fill=PANEL)
        d.ellipse([20, 20, 32, 32], fill=VIOLET)
        d.text((40, 25), "BoltWizard", fill=LIGHT, font=SANS_MD)
        d.text((130, 26), "/ workspace · main", fill=MUTED, font=SANS_SM)
        # pulsing status
        pulse = 0.6 + 0.4 * math.sin(f / 8)
        d.ellipse([664, 18, 678, 32], fill=(int(GREEN[0] * pulse), int(GREEN[1] * pulse), int(GREEN[2] * pulse)))
        d.text((680, 25), "local LLM", fill=GREEN, font=SANS_SM)
        d.text((680, 25), "local LLM", fill=GREEN, font=SANS_SM)  # badge right-aligned would need anchor hack

        # User prompt typing in (frames 0-40)
        chars_to_show = min(len(prompt_full), int(ease_out(f / 40) * (len(prompt_full) + 2)))
        chars_to_show = max(0, chars_to_show)
        d.rounded_rectangle([20, 80, 620, 122], radius=10, fill=VIOLET_DEEP)
        d.text((36, 96), prompt_full[:chars_to_show], fill=(237, 233, 254), font=SANS_SM)

        # Assistant header appears at frame ~36
        if f >= 36:
            d.text((20, 160), "✦ assistant", fill=(167, 139, 250), font=SANS_XS)

        # Assistant response: line by line reveal
        if f >= 44:
            line_y = 184
            for i, (line, color) in enumerate(assistant_lines):
                line_start = 44 + i * 6
                line_end = line_start + 16
                if f < line_start: continue
                visible = min(len(line), int((f - line_start) / max(1, line_end - line_start) * len(line)))
                d.text((20, line_y), line[:visible], fill=color, font=MONO_XS)
                line_y += 24

        # Action card slides in around frame 72
        if f >= 72:
            t = ease_out((f - 72) / 12)
            card_x = 20 + int((1 - t) * 60)
            card_alpha = int(t * 255)
            # blended fill (just darken with -card_alpha faked by overlay)
            d.rounded_rectangle([card_x, 282, card_x + 360, 346], radius=8,
                                fill=PANEL, outline=AMBER, width=1)
            d.text((card_x + 16, 290), "📄 package.json", fill=AMBER, font=SANS_SM)
            d.text((card_x + 16, 308), "write · 68 lines · 4 actions pending", fill=MUTED, font=SANS_XS)
            d.rounded_rectangle([card_x + 280, 292, card_x + 344, 336], radius=6, fill=GREEN_DEEP)
            tw = text_w(d, "run", SANS_SM)
            d.text((card_x + 280 + (64 - tw) // 2, 304), "run", fill=(240, 253, 244), font=SANS_SM)
            del card_alpha  # unused
        # Terminal tail
        d.rounded_rectangle([20, 360, 700, 416], radius=8, fill=(11, 17, 32), outline=PANEL_HI)
        d.text((36, 378), "$ npm install", fill=GREEN, font=MONO_XS)
        if f >= 60:
            t = ease_out((f - 60) / 10)
            d.text((36, 396), "added 142 packages, audited 144 packages in 3s",
                   fill=(int(MUTED[0] * (0.4 + 0.6 * t)), int(MUTED[1] * (0.4 + 0.6 * t)), int(MUTED[2] * (0.4 + 0.6 * t))),
                   font=MONO_XS)
        # Cursor blink
        if (f // 4) % 2 == 0:
            d.rectangle([210, 376, 218, 390], fill=GREEN)

        # Watermark
        d.text((W - 8, H - 12), "BoltWizard · demo · 4s loop", fill=FAINT, font=SANS_XS, anchor="ra")
        images.append(img)
    return images


# ====================================================================
# 2) AGENT-LOOP GIF
# ====================================================================
def make_agent_loop(frames: int = 72) -> List[Image.Image]:
    images: List[Image.Image] = []

    # Pipeline box positions
    boxes = [
        (40, 80, 160, 136, "Prompt", "user", (238, 242, 255), (99, 102, 241), (55, 48, 163)),
        (200, 80, 320, 136, "Stream", "model", (245, 243, 255), (124, 58, 237), (91, 33, 182)),
        (360, 80, 480, 136, "Parse", "<boltAction>", (236, 254, 255), (6, 182, 212), (14, 116, 144)),
    ]
    # Branches off Parse
    write_box = (520, 60, 660, 96)
    run_box = (520, 120, 660, 156)
    pulse_path = [
        (100, 108), (260, 108), (420, 108),  # Prompt -> Stream -> Parse
        (590, 78),                            # Parse -> Write
        (590, 138),                           # Write -> Run
        (590, 78),                            # Run -> Write
        (590, 138),                           # back to Run for loop
    ]
    cycle_len = len(pulse_path)
    cyc_frames = 36  # one pulse per 1.5s

    for f in range(frames):
        img = Image.new("RGB", (W, 320), BG)
        d = ImageDraw.Draw(img)

        # Title row
        d.text((24, 24), "agent loop · live", fill=MUTED, font=SANS_SM)
        pulse_dot = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(f / 6))
        d.ellipse([157, 21, 169, 33], fill=(int(GREEN[0] * pulse_dot), int(GREEN[1] * pulse_dot), int(GREEN[2] * pulse_dot)))
        d.text((175, 24), "streaming", fill=GREEN, font=SANS_XS)

        # Pipeline boxes
        for x0, y0, x1, y1, label, sub, fill, stroke, txt in boxes:
            d.rounded_rectangle([x0, y0, x1, y1], radius=12, fill=fill, outline=stroke, width=2)
            tw = text_w(d, label, SANS_MD)
            d.text((x0 + (x1 - x0 - tw) // 2, y0 + 10), label, fill=txt, font=SANS_MD)
            tw2 = text_w(d, sub, SANS_XS)
            d.text((x0 + (x1 - x0 - tw2) // 2, y0 + 30), sub, fill=stroke, font=SANS_XS)
        # Branch boxes
        d.rounded_rectangle(write_box, radius=8, fill=(254, 243, 199), outline=(245, 158, 11), width=2)
        tw = text_w(d, "Write file", SANS_SM)
        d.text((write_box[0] + (140 - tw) // 2, write_box[1] + 6), "Write file", fill=(146, 64, 14), font=SANS_SM)
        d.rounded_rectangle(run_box, radius=8, fill=(220, 252, 231), outline=(22, 163, 74), width=2)
        tw = text_w(d, "Run cmd", SANS_SM)
        d.text((run_box[0] + (140 - tw) // 2, run_box[1] + 6), "Run cmd", fill=(22, 101, 52), font=SANS_SM)

        # Static arrows
        for ax1, ay1, ax2, ay2 in [(160, 108, 200, 108), (320, 108, 360, 108),
                                  (480, 108, 520, 78), (480, 108, 520, 138)]:
            d.line([ax1, ay1, ax2 - 8, ay2], fill=(120, 130, 150), width=2)
            d.polygon([(ax2 - 8, ay2 - 5), (ax2, ay2), (ax2 - 8, ay2 + 5)], fill=VIOLET)

        # Animated pulse travelling
        idx_a = int((f % cyc_frames) / cyc_frames * (cycle_len - 1))
        idx_b = min(cycle_len - 1, idx_a + 1)
        t = ((f % cyc_frames) / cyc_frames * (cycle_len - 1)) - idx_a
        ax = pulse_path[idx_a][0] + (pulse_path[idx_b][0] - pulse_path[idx_a][0]) * t
        ay = pulse_path[idx_a][1] + (pulse_path[idx_b][1] - pulse_path[idx_a][1]) * t
        # Glow ring
        glow_r = 14 + 4 * math.sin(f / 4)
        for r, alpha in [(glow_r + 4, 30), (glow_r, 60), (glow_r - 4, 120)]:
            d.ellipse([ax - r, ay - r, ax + r, ay + r],
                      fill=(251, 191, 36, alpha) if False else AMBER)
        d.ellipse([ax - 6, ay - 6, ax + 6, ay + 6], fill=AMBER)

        # Live counters (numbers animate)
        f_progress = (f / frames)
        files = int(2 + 10 * f_progress + 0.5 + random.uniform(-0.3, 0.3))
        cmds = int(1 + 7 * f_progress)
        tokens = int(800 + 4032 * f_progress)
        d.text((24, 200), "files written:", fill=MUTED, font=MONO_XS)
        d.text((140, 200), str(files), fill=AMBER, font=MONO_XS)
        d.text((24, 220), "cmds run:    ", fill=MUTED, font=MONO_XS)
        d.text((140, 220), str(cmds), fill=GREEN, font=MONO_XS)
        d.text((24, 240), "tokens:      ", fill=MUTED, font=MONO_XS)
        d.text((140, 240), f"{tokens:,}".replace(",", " "), fill=(167, 139, 250), font=MONO_XS)
        d.text((24, 260), "cost so far: ", fill=MUTED, font=MONO_XS)
        d.text((140, 260), "$0.00 (local)", fill=(103, 232, 249), font=MONO_XS)

        # Status pill
        d.rounded_rectangle([500, 200, 700, 248], radius=24, fill=GREEN_DEEP)
        d.ellipse([520, 215, 532, 227], fill=WHITE)
        d.text((548, 213), "READY · awaiting next prompt", fill=WHITE, font=SANS_SM)

        images.append(img)
    return images


# ====================================================================
# 3) PREVIEW-RUNNING GIF
# ====================================================================
def make_preview_running(frames: int = 96) -> List[Image.Image]:
    images: List[Image.Image] = []
    # Each phase length (out of 96 frames)
    boot_frames = 24
    start_frames = 16
    skeleton_frames = 24
    ready_frames = frames - (boot_frames + start_frames + skeleton_frames)

    for f in range(frames):
        img = Image.new("RGB", (W, 360), BG)
        d = ImageDraw.Draw(img)

        # Preview pane background
        for y in range(54, 340):
            t = (y - 54) / 286
            r = int(APP_BG_TOP[0] * (1 - t) + APP_BG_BTM[0] * t)
            g = int(APP_BG_TOP[1] * (1 - t) + APP_BG_BTM[1] * t)
            b = int(APP_BG_TOP[2] * (1 - t) + APP_BG_BTM[2] * t)
            d.line([20, y, 700, y], fill=(r, g, b))

        # Browser chrome
        d.rectangle([20, 20, 700, 54], fill=(241, 245, 249))
        d.ellipse([36, 31, 46, 41], fill=RED)
        d.ellipse([54, 31, 64, 41], fill=(245, 158, 11))
        d.ellipse([72, 31, 82, 41], fill=GREEN)
        d.rounded_rectangle([100, 26, 600, 48], radius=11, fill=WHITE, outline=(203, 213, 225))
        d.text((120, 31), "🔒  http://localhost:5173", fill=(100, 116, 139), font=SANS_XS)
        d.ellipse([684, 31, 696, 43], fill=(148, 163, 184))

        # Status pill animates
        ph = f / frames
        if f < boot_frames:
            pill_color = VIOLET_DEEP
            pill_label = "booting"
        elif f < boot_frames + start_frames:
            pill_color = (5, 150, 105)
            pill_label = "starting server"
        else:
            pill_color = GREEN_DEEP
            pill_label = "✓ dev server ready"
        d.rounded_rectangle([280, 70, 440, 102], radius=16, fill=pill_color)
        d.ellipse([296, 80, 310, 92], fill=WHITE)
        tw = text_w(d, pill_label, SANS_SM)
        d.text((318, 79), pill_label, fill=WHITE, font=SANS_SM)

        # Skeleton fades out as ready begins
        show_skeleton = f < boot_frames + start_frames + skeleton_frames
        skel_alpha = 1.0 if show_skeleton else 0.0
        if show_skeleton:
            d.rounded_rectangle([60, 130, 660, 150], radius=4, fill=(224, 231, 255))
            d.rounded_rectangle([60, 160, 510, 174], radius=4, fill=(224, 231, 255))
            d.rounded_rectangle([60, 180, 420, 192], radius=4, fill=(224, 231, 255))

        # Real content fades in
        content_start = boot_frames + start_frames + skeleton_frames - 8
        if f >= content_start:
            t = ease_out((f - content_start) / 12)
            d.text((60, 146),
                   "Welcome to your Vite + React Todo app",
                   fill=(int(15 * (0.4 + 0.6 * t)), int(23 * (0.4 + 0.6 * t)), int(42 * (0.4 + 0.6 * t))),
                   font=SANS_TITLE)
            d.text((60, 174),
                   "12 todos · 3 done · 2 in progress · auto-saved to localStorage",
                   fill=(int(71 * (0.4 + 0.6 * t)), int(85 * (0.4 + 0.6 * t)), int(105 * (0.4 + 0.6 * t))),
                   font=SANS_SM)

            # Todo rows fade in sequentially
            for i, (label, status, color) in enumerate([
                ("Set up Vite project", "done", GREEN_DEEP),
                ("Wire Tailwind config", "in progress", VIOLET),
                ("Add localStorage persistence", "todo", MUTED),
            ]):
                row_start = content_start + i * 6
                if f >= row_start:
                    ry = 200 + i * 44
                    tt = ease_out((f - row_start) / 8)
                    d.rounded_rectangle([60, ry, 660, ry + 36], radius=6,
                                        fill=WHITE, outline=APP_LINE)
                    circle_fill = GREEN_DEEP if i == 0 else VIOLET if i == 1 else None
                    if circle_fill is not None:
                        d.ellipse([72, ry + 10, 88, ry + 26], fill=color)
                        if i == 0:
                            d.line([76, ry + 18, 79, ry + 21], fill=WHITE, width=2)
                            d.line([79, ry + 21, 84, ry + 14], fill=WHITE, width=2)
                    else:
                        d.ellipse([72, ry + 10, 88, ry + 26], outline=(203, 213, 225), width=2)
                    if i == 0:
                        d.text((96, ry + 11), label, fill=(int(148 * (0.4 + 0.6 * tt)),
                                                          int(163 * (0.4 + 0.6 * tt)),
                                                          int(184 * (0.4 + 0.6 * tt))),
                               font=SANS_XS)
                    else:
                        d.text((96, ry + 11), label, fill=(int(15 * (0.4 + 0.6 * tt)),
                                                           int(23 * (0.4 + 0.6 * tt)),
                                                           int(42 * (0.4 + 0.6 * tt))),
                               font=SANS_XS)
                    d.text((630, ry + 11), status, fill=color, font=SANS_XS, anchor="ra")

        # URL cursor blink during boot phase
        if (f // 4) % 2 == 0 and f < boot_frames + start_frames:
            d.rectangle([244, 32, 246, 48], fill=(15, 23, 42))

        # Watermark
        d.text((W - 8, H - 12), "BoltWizard · live preview · 4s loop",
               fill=FAINT, font=SANS_XS, anchor="ra")
        images.append(img)
    return images


# ====================================================================
# driver
# ====================================================================
def save_gif(name: str, frames: Iterable[Image.Image], duration_ms: int = 1000 // FPS, loop: int = 0):
    frames = list(frames)
    if not frames:
        raise RuntimeError(f"no frames for {name}")
    out = os.path.join(GIF_DIR, name)
    # PIL picks up palette mode automatically when source frames are paletted.
    # Our frames are RGB; convert each to a shared palette for max compression.
    quantized = [f.convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for f in frames]
    quantized[0].save(
        out,
        save_all=True,
        append_images=quantized[1:],
        duration=duration_ms,
        loop=loop,
        optimize=True,
        disposal=2,
    )
    size_kb = os.path.getsize(out) / 1024
    n = len(frames)
    print(f"  → {out}  ({n} frames @ {1000 // duration_ms} fps, {size_kb:.0f} KB)")
    return out


def main() -> None:
    # Windows console (cp1252) can't render '→' / '…' used in some log lines.
    # Reconfigure stdout to utf-8 so the script works the same everywhere.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    random.seed(42)  # deterministic counters
    print("Building GIFs ...")
    save_gif("chat-stream.gif", make_chat_stream(96))
    save_gif("agent-loop.gif", make_agent_loop(72))
    save_gif("preview-running.gif", make_preview_running(96))
    print("Done.")


if __name__ == "__main__":
    main()
