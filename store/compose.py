"""Compose captioned store screenshots from raw simulator captures in store/raw/.

Run with a Python that has Pillow:  python store/compose.py
Outputs:
  store/appstore/iphone-6.9/NN-name.png   1320x2868 (App Store 6.9" iPhone)
  store/play/phone/NN-name.png            1080x2160 (Google Play phone, 2:1)
  store/appstore/ipad-13/NN-name.png      2064x2752 (App Store 13" iPad, from store/raw-ipad)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"

FONT_DIR = Path("/System/Applications/Utilities/Terminal.app/Contents/Resources/Fonts")
HEAVY = str(FONT_DIR / "SF-Mono-Heavy.otf")
BOLD = str(FONT_DIR / "SF-Mono-Bold.otf")
MEDIUM = str(FONT_DIR / "SF-Mono-Medium.otf")

# Dark terminal palette (src/theme/terminal.ts).
BG = (0, 0, 0)
AMBER = (255, 158, 27)
GREEN = (37, 208, 125)  # terminal green, the app's profit colour
TEXT = (242, 242, 242)
DIM = (154, 154, 154)
BORDER = (77, 77, 77)

# Order is the store order: the first one is what people see in search results.
# Captions in the live listing's voice: a white setup line, a green punchline. A caption
# given as one (white, green) pair sits on a single row, centred in the two-row block.
SHOTS = [
    ("sprint-toast", ("60 Seconds.", "One Chart.")),
    ("training-c", ("Patterns", "Always Repeat")),
    ("quiz-reveal", [("Skill > ", "Luck")]),
    ("sprint-open", ("Don't Be", "Exit Liquidity")),
    ("results", ("Show Off", "Your Wins")),
    ("pnl-calendar", ("Paint Your", "Month Green")),
    ("menu", ("5 Ways", "To Get Rekt")),
]


def headline_size(draw, width, margin, unit):
    """One type size for the whole set: the largest (up to a cap) that fits every line."""
    lines = ["".join(line) if isinstance(line, tuple) else line for _, caption in SHOTS for line in caption]
    size = round(150 * unit)
    while size > 20 and any(draw.textlength(line, font=ImageFont.truetype(HEAVY, size)) > width - 2 * margin for line in lines):
        size -= 2
    return size


# folder -> (canvas size, raw capture folder, raw names that differ from SHOTS)
TARGETS = {
    ROOT / "appstore" / "iphone-6.9": ((1320, 2868), RAW, {}),
    ROOT / "play" / "phone": ((1080, 2160), RAW, {}),
    ROOT / "appstore" / "ipad-13": ((2064, 2752), ROOT / "raw-ipad", {"training-c": "training"}),
}

# Per target, shots cropped from the bottom up instead of the top down.
ANCHOR_BOTTOM = {ROOT / "appstore" / "ipad-13": {"quiz-reveal"}}


def wrap(draw, text, font, max_width):
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *image.size), radius=radius, fill=255)
    out = Image.new("RGBA", image.size)
    out.paste(image, (0, 0), mask)
    return out


def compose(raw_path, caption, size, anchor_bottom=False):
    width, height = size
    unit = width / 1320  # scale everything off the 6.9" layout
    canvas = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(canvas)
    margin = round(72 * unit)

    # Thin green terminal band.
    draw.rectangle((0, 0, width, round(24 * unit)), fill=GREEN)

    # Headline: white setup line over a green punchline, with room to breathe above and below.
    font = ImageFont.truetype(HEAVY, headline_size(draw, width, margin, unit))
    ascent, descent = font.getmetrics()
    line_height = round((ascent + descent) * 1.08)
    y = round(150 * unit)
    block_bottom = y + 2 * line_height  # every caption reserves two rows, so the devices line up
    y += (2 - len(caption)) * line_height // 2
    for index, line in enumerate(caption):
        if isinstance(line, tuple):
            white, green = line
            left = (width - draw.textlength(white + green, font=font)) / 2
            draw.text((left, y), white, font=font, fill=TEXT, anchor="lt")
            draw.text((left + draw.textlength(white, font=font), y), green, font=font, fill=GREEN, anchor="lt")
        else:
            draw.text((width / 2, y), line, font=font, fill=TEXT if index == 0 else GREEN, anchor="mt")
        y += line_height
    y = block_bottom

    # The screenshot sits low and large, running off the bottom edge; only its top
    # corners are rounded.
    top = y + round(96 * unit)
    shot = Image.open(raw_path).convert("RGB")
    device_width = round(width * (0.86 if width / height < 0.6 else 0.78))
    scale = device_width / shot.width
    shot = shot.resize((device_width, round(shot.height * scale)), Image.LANCZOS)
    visible = min(shot.height, height - top)
    # Shots whose point is at the bottom of the screen (the quiz card) show their lower part.
    crop_top = shot.height - visible if anchor_bottom else 0
    shot = shot.crop((0, crop_top, shot.width, crop_top + visible))
    radius = round(56 * unit)
    border = max(3, round(5 * unit))
    x = (width - shot.width) // 2
    draw.rounded_rectangle(
        (x - border, top - border, x + shot.width + border, height + radius),
        radius=radius + border,
        fill=BORDER,
    )
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height + radius), radius=radius, fill=255)
    canvas.paste(shot, (x, top), mask)
    return canvas


def main():
    for folder, (size, raw_dir, renames) in TARGETS.items():
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.png"):
            old.unlink()
        for index, (name, caption) in enumerate(SHOTS, start=1):
            out = folder / f"{index:02d}-{name}.png"
            anchor = name in ANCHOR_BOTTOM.get(folder, set())
            compose(raw_dir / f"{renames.get(name, name)}.png", caption, size, anchor).save(out, optimize=True)
            print(out.relative_to(ROOT.parent), size)


if __name__ == "__main__":
    main()
