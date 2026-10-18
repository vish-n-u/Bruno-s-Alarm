"""Builds Bruno's Alarm promo videos from real clips + real app screenshots, with motion:
slow push-ins, captions that slide/fade in, a hand-written "awoooo" that writes itself, a
swinging bell, app phones gliding up, a sunrise end card, and transitions between shots.
The howl is kept quiet (a bed under the pictures, not the main event).

Outputs (in this folder):
  promo_vertical.mp4   1080x1920 (Shorts / Reels / TikTok)
  promo_landscape.mp4  1920x1080 (Play Store promo video, via YouTube)
"""
import math
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.dirname(HERE)
FONTS = r"C:\Users\vishn\Desktop\Brunos Alarm\mobile\node_modules\@expo-google-fonts"
ANTON = os.path.join(FONTS, "anton", "400Regular", "Anton_400Regular.ttf")
CAVEAT = os.path.join(FONTS, "caveat", "700Bold", "Caveat_700Bold.ttf")
BRICO = os.path.join(FONTS, "bricolage-grotesque", "600SemiBold", "BricolageGrotesque_600SemiBold.ttf")

CLIP = r"C:\Users\vishn\Downloads\default (1).mp4"
RECORDING = "https://media.brunos-alarm.com/alarm-recordings/fcb75474e43874a40da00284263c244a.mp4"
RINGING = os.environ.get("RINGING_SHOT", os.path.join(SCRATCH, "q2.png"))  # real ringing screen once captured
LIVE = os.path.join(SCRATCH, "q3.png")

W, H = 1080, 1920
FPS = 30
XF = 0.45  # transition length
SKY = (253, 229, 204)
GROUND = (243, 211, 168)
INK = (90, 58, 36)
ORANGE = (232, 116, 58)
CREAM = (255, 214, 170)


def run(args):
    r = subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-3000:])


# ---------- still layers (full-frame transparent PNGs so they can be animated as a whole) ----------

def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def text_layer(path, text, font, fill, y, shadow=True):
    img = layer()
    d = ImageDraw.Draw(img)
    b = d.textbbox((0, 0), text, font=font)
    x = (W - (b[2] - b[0])) // 2 - b[0]
    if shadow:
        d.text((x + 3, y + 4), text, font=font, fill=(0, 0, 0, 130))
    d.text((x, y), text, font=font, fill=fill)
    img.save(path)


def top_shade(path):
    img = layer()
    band = Image.new("L", (1, 560))
    for yy in range(560):
        band.putpixel((0, yy), int(165 * (1 - yy / 560) ** 1.4))
    shade = Image.new("RGBA", (W, 560), (0, 0, 0, 255))
    shade.putalpha(band.resize((W, 560)))
    img.alpha_composite(shade, (0, 0))
    img.save(path)


def awoo_layers(prefix, x0, y0, size=110, color=CREAM):
    """One PNG per letter of "awoooo", on a rising slant, so each can fade in on its own."""
    font = ImageFont.truetype(CAVEAT, size)
    paths = []
    x = x0
    for i, ch in enumerate("awoooo"):
        img = layer()
        d = ImageDraw.Draw(img)
        y = y0 - i * 22
        d.text((x + 3, y + 4), ch, font=font, fill=(0, 0, 0, 120))
        d.text((x, y), ch, font=font, fill=color)
        b = d.textbbox((0, 0), ch, font=font)
        x += (b[2] - b[0]) + 4
        p = "%s_%d.png" % (prefix, i)
        img.save(p)
        paths.append(p)
    return paths


def bell_png(path, size=150):
    """An orange outline bell with clapper, centred in a square so it can swing in place."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = ORANGE + (255,)
    d.line((s * 0.5, s * 0.08, s * 0.5, s * 0.2), fill=o, width=8)
    d.chord((s * 0.22, s * 0.18, s * 0.78, s * 0.85), 180, 360, fill=o)
    d.polygon([(s * 0.22, s * 0.52), (s * 0.78, s * 0.52), (s * 0.88, s * 0.74), (s * 0.12, s * 0.74)], fill=o)
    d.ellipse((s * 0.43, s * 0.72, s * 0.57, s * 0.86), fill=o)
    img.save(path)


def phone_png(path, shot):
    """The app screenshot in a rounded dark phone frame with a soft shadow (RGBA, cropped)."""
    s = Image.open(shot).convert("RGB")
    ph = 1380
    pw = int(s.width * ph / s.height)
    s = s.resize((pw, ph), Image.LANCZOS)
    r = 56
    fw, fh = pw + 28, ph + 28
    out = Image.new("RGBA", (fw + 120, fh + 120), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((60, 75, 60 + fw, 75 + fh), r + 14, fill=INK + (95,))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
    frame = Image.new("RGBA", (fw, fh), (30, 22, 18, 255))
    inner = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(inner).rounded_rectangle((0, 0, pw - 1, ph - 1), r, fill=255)
    frame.paste(s, (14, 14), inner)
    mask = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fw - 1, fh - 1), r + 14, fill=255)
    out.paste(frame, (60, 60), mask)
    out.save(path)
    return out.size


def solid(path, color):
    Image.new("RGB", (W, H), color).save(path)


def sun_png(path, r=150):
    s = int(r * 2 + 260)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse((c - r, c - r, c + r, c + r), fill=(252, 198, 144, 255), outline=(238, 138, 70, 255), width=7)
    for k in range(-2, 3):
        a = math.radians(k * 30 - 90)
        d.line((c + math.cos(a) * (r + 40), c + math.sin(a) * (r + 40), c + math.cos(a) * (r + 105), c + math.sin(a) * (r + 105)),
               fill=(238, 138, 70, 255), width=9)
    img.save(path)
    return s


def ground_png(path, hy):
    img = layer()
    d = ImageDraw.Draw(img)
    d.rectangle((0, hy, W, H), fill=GROUND + (255,))
    d.line((0, hy, W, hy), fill=INK + (255,), width=6)
    img.save(path)


# ---------- motion helpers (ffmpeg expressions on the main timeline `t`) ----------

def rise(start, dur=0.45, dist=70):
    """y offset that eases from `dist` to 0."""
    return "%d*pow(max(0\\,1-max(0\\,t-%.3f)/%.3f)\\,3)" % (dist, start, dur)


class Graph:
    """Builds an ffmpeg -filter_complex: a base video, then layers overlaid with fade + motion."""

    def __init__(self, base_label, dur):
        self.dur = dur
        self.inputs = []
        self.parts = []
        self.cur = base_label
        self.n = 0

    def add_input(self, args):
        self.inputs.append(args)
        return len(self.inputs)  # index (input 0 is the base)

    def overlay(self, png, start, x="0", y="0", fade=0.4, pre=""):
        # finite (not endlessly looping) layers, or ffmpeg buffers them without bound
        i = self.add_input(["-framerate", "30", "-loop", "1", "-t", "%.2f" % (self.dur + 0.3), "-i", png])
        self.n += 1
        lab = "l%d" % self.n
        out = "o%d" % self.n
        self.parts.append("[%d:v]format=rgba,%sfade=t=in:st=%.3f:d=%.3f:alpha=1[%s]" % (i, pre, start, fade, lab))
        self.parts.append("[%s][%s]overlay=x='%s':y='%s':shortest=1:format=auto[%s]" % (self.cur, lab, x, y, out))
        self.cur = out


def encode(graph, base_args, dur, audio_args, volume, out):
    args = ["ffmpeg", "-y"] + base_args
    for extra in graph.inputs:
        args += extra
    a_index = len(graph.inputs) + 1
    args += audio_args
    fc = ";".join(graph.parts + ["[%s]format=yuv420p,setsar=1[v]" % graph.cur,
                                 "[%d:a]aresample=44100,volume=%.2f,afade=t=in:d=0.3,afade=t=out:st=%.3f:d=0.4[a]"
                                 % (a_index, volume, dur - 0.4)])
    args += ["-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", str(dur), "-r", str(FPS),
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-ac", "2", out]
    run(args)


def push_in(precrop=""):
    # slow 1.00 → 1.07 zoom, centred
    return ("[0:v]%sscale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
            "scale=w='trunc(1080*(1+0.02*t)/2)*2':h='trunc(1920*(1+0.02*t)/2)*2':eval=frame,"
            "crop=1080:1920,setsar=1[b0]" % precrop)


def video_shot(out, src, start, dur, line1, line2=None, awoo=None, bell=False, precrop="", volume=0.4):
    g = Graph("b0", dur)
    g.parts.append(push_in(precrop))
    top_shade("shade.png")
    g.overlay("shade.png", 0.0, fade=0.3)
    text_layer("t1.png", line1, ImageFont.truetype(ANTON, 96), (255, 255, 255), 170)
    g.overlay("t1.png", 0.25, y=rise(0.25))
    if line2:
        text_layer("t2.png", line2, ImageFont.truetype(CAVEAT, 74), CREAM, 300)
        g.overlay("t2.png", 0.75, y=rise(0.75))
    if awoo:
        x0, y0 = awoo
        for k, p in enumerate(awoo_layers("aw", x0, y0)):
            g.overlay(p, 1.1 + k * 0.22, y=rise(1.1 + k * 0.22, 0.3, 24), fade=0.18)
    if bell:
        bell_png("bell.png")
        # swings from its top: rotate around centre, offset so it hangs; damped swing
        g.overlay("bell.png", 0.5, x="%d" % (W - 230), y="420+" + rise(0.5, 0.5, 40),
                  pre="rotate=a='0.45*sin(2*PI*1.6*t)*exp(-0.35*t)':c=none:ow=150:oh=150,")
    encode(g, ["-ss", str(start), "-t", str(dur + 0.2), "-i", src], dur,
           ["-ss", str(start), "-t", str(dur + 0.2), "-i", src], volume, out)


def phone_shot(out, shot, title, sub, dur, audio_start, volume=0.15):
    solid("bg.png", SKY)
    g = Graph("b0", dur)
    g.parts.append("[0:v]fps=30,setsar=1[b0]")
    text_layer("pt1.png", title, ImageFont.truetype(ANTON, 92), INK, 110, shadow=False)
    g.overlay("pt1.png", 0.1, y=rise(0.1))
    text_layer("pt2.png", sub, ImageFont.truetype(CAVEAT, 64), ORANGE, 245, shadow=False)
    g.overlay("pt2.png", 0.45, y=rise(0.45))
    pw, ph = phone_png("phone.png", shot)
    x = (W - pw) // 2
    y_end = H - ph + 20
    # glides up from below the frame with an ease-out, then floats gently
    y = "%d+%d*pow(max(0\\,1-max(0\\,t-0.2)/0.8)\\,3)+8*sin(2*PI*t/2.6)" % (y_end, H - y_end)
    g.overlay("phone.png", 0.2, x=str(x), y=y, fade=0.25)
    encode(g, ["-loop", "1", "-t", str(dur), "-i", "bg.png"], dur,
           ["-ss", str(audio_start), "-t", str(dur + 0.2), "-i", CLIP], volume, out)


def end_shot(out, dur, audio_start, volume=0.15):
    solid("ebg.png", SKY)
    hy = 1240
    s = sun_png("sun.png")
    ground_png("ground.png", hy)
    g = Graph("b0", dur)
    g.parts.append("[0:v]fps=30,setsar=1[b0]")
    # the sun rises behind the ground line
    g.overlay("sun.png", 0.0, x=str((W - s) // 2), y="%d+260*pow(max(0\\,1-t/1.6)\\,2)" % (hy - s // 2), fade=0.2)
    g.overlay("ground.png", 0.0, fade=0.01)
    text_layer("e1.png", "Bruno's Alarm", ImageFont.truetype(ANTON, 150), INK, 400, shadow=False)
    g.overlay("e1.png", 0.5, y=rise(0.5, 0.5, 90))
    text_layer("e2.png", "A real dog. Live twice a day.", ImageFont.truetype(BRICO, 56), INK, 620, shadow=False)
    g.overlay("e2.png", 1.0, y=rise(1.0))
    text_layer("e3.png", "free on Google Play", ImageFont.truetype(CAVEAT, 80), ORANGE, 1430, shadow=False)
    g.overlay("e3.png", 1.5, y=rise(1.5))
    encode(g, ["-loop", "1", "-t", str(dur), "-i", "ebg.png"], dur,
           ["-ss", str(audio_start), "-t", str(dur + 0.2), "-i", CLIP], volume, out)


def join(segments, out):
    """xfade/acrossfade the segments together with a different transition at each join."""
    transitions = ["smoothleft", "circleopen", "slideup", "smoothleft", "fade"]
    args = ["ffmpeg", "-y"]
    for p, _ in segments:
        args += ["-i", p]
    parts = []
    v, a = "0:v", "0:a"
    t = segments[0][1]
    for k in range(1, len(segments)):
        off = t - XF
        parts.append("[%s][%d:v]xfade=transition=%s:duration=%.2f:offset=%.3f[v%d]" % (v, k, transitions[k - 1], XF, off, k))
        parts.append("[%s][%d:a]acrossfade=d=%.2f[a%d]" % (a, k, XF, k))
        v, a = "v%d" % k, "a%d" % k
        t = off + segments[k][1]
    args += ["-filter_complex", ";".join(parts), "-map", "[%s]" % v, "-map", "[%s]" % a,
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
             "-movflags", "+faststart", out]
    run(args)


def keep(name):
    """REUSE=1 skips shots already rendered (they're slow)."""
    return os.environ.get("REUSE") == "1" and os.path.exists(name)


def main():
    os.chdir(HERE)
    segs = [
        ("s1.mp4", 3.6), ("s2.mp4", 3.4), ("s3.mp4", 3.6), ("s4.mp4", 3.6), ("s5.mp4", 3.4), ("s6.mp4", 3.4),
    ]
    if not keep("s1.mp4"):
        video_shot("s1.mp4", CLIP, 0.4, 3.6, "This is Bruno.", awoo=(140, 760), volume=0.45)
    if not keep("s2.mp4"):
        video_shot("s2.mp4", CLIP, 24.3, 3.4, "Twice a day,", "a church bell rings...", bell=True, volume=0.3)
    if not keep("s3.mp4"):
        video_shot("s3.mp4", RECORDING, 9.5, 3.6, "...and he howls along.", "every single time",
               awoo=(80, 700), precrop="crop=720:1280:120:40,", volume=0.4)
    if not keep("s4.mp4"):
        phone_shot("s4.mp4", RINGING, "Now he's your alarm.", "rings even on silent", 3.6, 28.0)
    if not keep("s5.mp4"):
        phone_shot("s5.mp4", LIVE, "Watch him live.", "and chat with everyone watching", 3.4, 31.0)
    if not keep("s6.mp4"):
        end_shot("s6.mp4", 3.4, 4.0)
    join(segs, "promo_vertical.mp4")
    run(["ffmpeg", "-y", "-i", "promo_vertical.mp4", "-filter_complex",
         "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=30,eq=brightness=-0.08[bg];"
         "[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[o]",
         "-map", "[o]", "-map", "0:a", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "copy",
         "-movflags", "+faststart", "promo_landscape.mp4"])
    print("done")


if __name__ == "__main__":
    main()
