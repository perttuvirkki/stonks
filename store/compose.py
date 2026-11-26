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
TEXT = (242, 242, 242)
DIM = (154, 154, 154)
BORDER = (77, 77, 77)

# Order is the store order: the first one is what people see in search results.
# Two short lines per shot (max 8 characters each) so the headline stays huge and
# readable at store thumbnail size.
SHOTS = [
    ("sprint-toast", ("50X", "LEVERAGE")),
    ("sprint-open", ("60 SEC", "SPRINTS")),
    ("training-c", ("LEARN", "PATTERNS")),
    ("quiz-reveal", ("POP", "QUIZ")),
    ("results", ("FLEX", "YOUR WIN")),
    ("menu", ("5 GAME", "MODES")),
]

# folder -> (canvas size, raw capture folder, raw names that differ from SHOTS)
TARGETS = {
    ROOT / "appstore" / "iphone-6.9": ((1320, 2868), RAW, {}),
    ROOT / "play" / "phone": ((1080, 2160), RAW, {}),
    ROOT / "appstore" / "ipad-13": ((2064, 2752), ROOT / "raw-ipad", {"training-c": "training"}),
}


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


def headline_size(draw, width, margin, unit):
    """One type size for the whole set: the largest that fits every line across the canvas."""
    longest = max((line for _, lines in SHOTS for line in lines), key=len)
    size = round(300 * unit)
    while size > 20 and draw.textlength(longest, font=ImageFont.truetype(HEAVY, size)) > width - 2 * margin:
        size -= 4
    return size


def compose(raw_path, lines, size):
    width, height = size
    unit = width / 1320  # scale everything off the 6.9" layout
    canvas = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(canvas)
    margin = round(64 * unit)

    # Thin amber terminal band.
    draw.rectangle((0, 0, width, round(28 * unit)), fill=AMBER)

    # Huge two-line headline: first line amber, second white.
    font = ImageFont.truetype(HEAVY, headline_size(draw, width, margin, unit))
    ascent, descent = font.getmetrics()
    line_height = ascent + descent
    y = round(96 * unit)
    for index, line in enumerate(lines):
        draw.text((width / 2, y), line, font=font, fill=AMBER if index == 0 else TEXT, anchor="mt")
        y += round(line_height * 0.92)

    # The screenshot, framed like a terminal panel, filling the rest.
    top = y + round(48 * unit)
    bottom_pad = round(56 * unit)
    shot = Image.open(raw_path).convert("RGB")
    scale = min((height - top - bottom_pad) / shot.height, (width - 2 * margin) / shot.width)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    radius = round(48 * unit)
    x = (width - shot.width) // 2
    border = max(2, round(4 * unit))
    draw.rounded_rectangle(
        (x - border, top - border, x + shot.width + border, top + shot.height + border),
        radius=radius + border,
        fill=BORDER,
    )
    masked = rounded(shot, radius)
    canvas.paste(masked, (x, top), masked)
    return canvas


def main():
    for folder, (size, raw_dir, renames) in TARGETS.items():
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.png"):
            old.unlink()
        for index, (name, lines) in enumerate(SHOTS, start=1):
            out = folder / f"{index:02d}-{name}.png"
            compose(raw_dir / f"{renames.get(name, name)}.png", lines, size).save(out, optimize=True)
            print(out.relative_to(ROOT.parent), size)


if __name__ == "__main__":
    main()
