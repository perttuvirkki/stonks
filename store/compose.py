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
SHOTS = [
    ("sprint-toast", "LEVERAGE UP TO 50X", "Catch the breakout. Print the gains."),
    ("sprint-open", "60 SECONDS. ONE STACK.", "Long or short, one tick from liquidation."),
    ("training-c", "LEARN THE PATTERNS", "Training Wheels draws every line. Scored in %, no money at risk."),
    ("quiz-reveal", "POP QUIZ", "The chart freezes. You call long or short."),
    ("results", "FLEX YOUR RUN", "Leaderboards and achievements for every mode."),
    ("menu", "FIVE WAYS TO TRADE", "Sprint, 5 Trades, Training Wheels, Pop Quiz, Daily Quote."),
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


def compose(raw_path, headline, subline, size):
    width, height = size
    unit = width / 1320  # scale everything off the 6.9" layout
    canvas = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(canvas)
    margin = round(72 * unit)

    # Amber terminal header strip, like the app's own.
    strip = round(96 * unit)
    draw.rectangle((0, 0, width, strip), fill=AMBER)
    tag_font = ImageFont.truetype(HEAVY, round(40 * unit))
    draw.text((margin, strip / 2), "STONKS", font=tag_font, fill=BG, anchor="lm")
    draw.text((width - margin, strip / 2), "<GO>", font=tag_font, fill=BG, anchor="rm")

    # Headline and subline.
    y = strip + round(84 * unit)
    head_font = ImageFont.truetype(HEAVY, round(104 * unit))
    for line in wrap(draw, headline, head_font, width - 2 * margin):
        draw.text((width / 2, y), line, font=head_font, fill=AMBER, anchor="mt")
        y += round(120 * unit)
    sub_font = ImageFont.truetype(MEDIUM, round(46 * unit))
    y += round(14 * unit)
    for line in wrap(draw, subline, sub_font, width - 2 * margin):
        draw.text((width / 2, y), line, font=sub_font, fill=DIM, anchor="mt")
        y += round(60 * unit)

    # The screenshot, framed like a terminal panel, filling the rest.
    top = y + round(56 * unit)
    bottom_pad = round(64 * unit)
    shot = Image.open(raw_path).convert("RGB")
    avail_h = height - top - bottom_pad
    avail_w = width - 2 * margin
    scale = min(avail_h / shot.height, avail_w / shot.width)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    radius = round(56 * unit)
    x = (width - shot.width) // 2
    border = max(2, round(4 * unit))
    draw.rounded_rectangle(
        (x - border, top - border, x + shot.width + border, top + shot.height + border),
        radius=radius + border,
        fill=BORDER,
    )
    canvas.paste(rounded(shot, radius), (x, top), rounded(shot, radius))
    return canvas


def main():
    for folder, (size, raw_dir, renames) in TARGETS.items():
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.png"):
            old.unlink()
        for index, (name, headline, subline) in enumerate(SHOTS, start=1):
            out = folder / f"{index:02d}-{name}.png"
            compose(raw_dir / f"{renames.get(name, name)}.png", headline, subline, size).save(out, optimize=True)
            print(out.relative_to(ROOT.parent), size)


if __name__ == "__main__":
    main()
