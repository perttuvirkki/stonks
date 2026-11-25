"""Render achievement badges (1024x1024 PNG, flat RGB) for Game Center and Play Games.

Run with a Python that has Pillow:  python store/achievements.py
Outputs store/achievements/<key>.png, one per achievement in src/progress.ts.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "achievements"
FONT_DIR = Path("/System/Applications/Utilities/Terminal.app/Contents/Resources/Fonts")
HEAVY = str(FONT_DIR / "SF-Mono-Heavy.otf")
BOLD = str(FONT_DIR / "SF-Mono-Bold.otf")

BG = (0, 0, 0)
PANEL = (10, 10, 10)
AMBER = (255, 158, 27)
GREEN = (37, 208, 125)
RED = (255, 75, 75)
YELLOW = (255, 212, 0)
BLUE = (47, 123, 255)
TEXT = (242, 242, 242)

# key: (code on the badge, label under it, accent colour)
BADGES = {
    "firstTrade": ("1ST", "FIRST TRADE", GREEN),
    "leverage10x": ("10X", "DEGEN", AMBER),
    "rounds100": ("100", "CENTURION", TEXT),
    "liquidated": ("LIQ", "MARGIN CALLED", RED),
    "sprintDouble": ("2X", "DOUBLE UP", GREEN),
    "fiveTradesDone": ("5/5", "FIVE AND DONE", BLUE),
    "fiveTradesPerfect": ("5W", "PERFECT FIVE", GREEN),
    "fiveTradesDouble": ("+100", "FIVE TO DOUBLE", GREEN),
    "quizFirstCorrect": ("OK", "CALLED IT", BLUE),
    "quizStreak5": ("x5", "HOT STREAK", AMBER),
    "quizStreak10": ("x10", "CHART WHISPERER", AMBER),
    "trainingFirstGreen": ("+%", "GREEN WHEELS", YELLOW),
    "trainingPlus50": ("+50%", "PAPER HANDS UP", YELLOW),
    "netProfit1k": ("$1K", "FOUR FIGURES", GREEN),
    "netProfit10k": ("$10K", "FIVE FIGURES", GREEN),
}

SIZE = 1024


def fit_font(draw, text, path, max_width, start):
    size = start
    while size > 40:
        font = ImageFont.truetype(path, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 8
    return ImageFont.truetype(path, size)


def badge(code, label, accent):
    image = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)
    inset = 64
    draw.rectangle((inset, inset, SIZE - inset, SIZE - inset), fill=PANEL, outline=accent, width=24)
    # Amber terminal header strip.
    strip_top, strip_bottom = inset + 24, inset + 24 + 120
    draw.rectangle((inset + 24, strip_top, SIZE - inset - 24, strip_bottom), fill=AMBER)
    head = ImageFont.truetype(HEAVY, 64)
    draw.text((SIZE / 2, (strip_top + strip_bottom) / 2), "STONKS", font=head, fill=BG, anchor="mm")
    code_font = fit_font(draw, code, HEAVY, SIZE - 2 * inset - 120, 360)
    draw.text((SIZE / 2, SIZE / 2 + 40), code, font=code_font, fill=accent, anchor="mm")
    label_font = fit_font(draw, label, BOLD, SIZE - 2 * inset - 100, 76)
    draw.text((SIZE / 2, SIZE - inset - 110), label, font=label_font, fill=TEXT, anchor="mm")
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (code, label, accent) in BADGES.items():
        path = OUT / f"{key}.png"
        badge(code, label, accent).save(path, dpi=(72, 72))
        print(path.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()
