"""Play Store screenshot #1: the real ringing screen in a phone frame under a headline.

Play accepts 16:9 or 9:16 up to 2:1, so a raw 1080x2373 phone screenshot can't be uploaded
as-is; this makes a 1080x1920 card. Usage:
  python build_store_screenshot.py <ringing_screenshot.png> [out.png]
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = r"C:\Users\vishn\Desktop\Brunos Alarm\mobile\node_modules\@expo-google-fonts"
ANTON = os.path.join(FONTS, "anton", "400Regular", "Anton_400Regular.ttf")
CAVEAT = os.path.join(FONTS, "caveat", "700Bold", "Caveat_700Bold.ttf")

W, H = 1080, 1920
SKY = (253, 229, 204)
INK = (90, 58, 36)
ORANGE = (232, 116, 58)


def main(src, out):
    shot = Image.open(src).convert("RGB")
    # Drop the phone's status bar (its clock wouldn't match the alarm's time label) and the
    # gesture/nav bar at the bottom.
    shot = shot.crop((0, 120, shot.width, shot.height - 140))

    img = Image.new("RGB", (W, H), SKY)
    d = ImageDraw.Draw(img)
    for text, font, fill, y in (
        ("Wake up to a real dog.", ImageFont.truetype(ANTON, 104), INK, 90),
        ("his real howl, even on silent", ImageFont.truetype(CAVEAT, 66), ORANGE, 245),
    ):
        b = d.textbbox((0, 0), text, font=font)
        d.text(((W - (b[2] - b[0])) // 2 - b[0], y), text, font=font, fill=fill)

    ph = 1460
    pw = int(shot.width * ph / shot.height)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    r = 60
    fw, fh = pw + 30, ph + 30
    frame = Image.new("RGB", (fw, fh), (30, 22, 18))
    inner = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(inner).rounded_rectangle((0, 0, pw - 1, ph - 1), r, fill=255)
    frame.paste(shot, (15, 15), inner)
    mask = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fw - 1, fh - 1), r + 15, fill=255)

    x = (W - fw) // 2
    y = H - fh - 60
    base = img.convert("RGBA")
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x + 10, y + 24, x + fw + 10, y + fh + 24), r + 15, fill=INK + (90,))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    base.paste(frame, (x, y), mask)
    base.convert("RGB").save(out, quality=95)
    print("saved", out, base.size)


if __name__ == "__main__":
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "play_screenshot_1_ringing.png")
    main(src, out)
