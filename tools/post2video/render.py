#!/usr/bin/env python3
"""Post -> video. Moving typography over a voiceover, background clips and a music bed.
Pillow + ffmpeg + a voice (Gemini text-to-speech or macOS `say`), nothing else.

usage:
  render.py films/<film>/scenario.json films/<film>/exports/<name>.mp4 [--voice gemini:Laomedeia | --voice "Reed (English (US))"]
  render.py films/<film>/scenario.json --stills DIR        # one PNG per scene, no video
  render.py --selftest

Paths: 'bg' and 'music' are relative to <film>/assets (override with --assets); caches live in
<film>/.tmp (prepared clips and synthesized speech, safe to delete).

scenario.json: {"music": "music/bed.mp3", "style": "<how to read>", "scenes": [ {...}, ... ]}, one object per scene:
  "big":    "75%"              -> one number counting up
            ["39%", "91%"]     -> two numbers side by side with bars
            "any short phrase" -> words land one by one; wrap in quotes for italic
  "labels": ["Americans", "Staff"]   (only with a pair)
  "sub":    small line under the big element
  "vo":     what the voice says; also shown as caption, sentence by sentence
  "bg":     background clip, or a list of clips cut at equal intervals within the scene.
            Played forward once, never reversed, never looped; a clip shorter than its share is
            slowed (motion-interpolated) up to 2.2x, beyond that the last frame holds and a
            warning is printed. A missing file falls back to the plain dark background.
  "shot":   free text for the editor (wide / medium / close, camera move); ignored by the code
  "dur":    seconds, only for scenes without "vo"
Scene length comes from the speech itself. All clips get one colour grade (cool shadows, warm
highlights, muted saturation) so the amber type sits on one palette.

Voice: "grok:<voice_id>" uses xAI text-to-speech (POST api.x.ai/v1/tts; voices from GET /v1/tts/voices,
e.g. carina, eve, ara, luna; key XAI_API_KEY). "gemini:<Voice>" uses Google's speech models (key
GEMINI_API_KEY; free tier allows 10 requests a day per model). Keys come from the environment, else
from the repository's .env, else from ~/Projects/VoiceAgent/.env (--env-file adds one more path).
Speech is cached per text and voice. Any other value is a macOS `say` voice name. '' renders a mute video.
"""
import argparse, base64, hashlib, json, math, os, re, subprocess, sys, tempfile, urllib.request, wave
from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Avenir Next.ttc"
HEAVY, DEMI, DEMI_IT, MED = 8, 2, 3, 5          # face indices inside the .ttc
BG, FG, DIM, ACC, TRACK = (12, 14, 22), (242, 242, 240), (170, 174, 180), (245, 165, 36), (60, 63, 70)
SHADE = (6, 10, 22)                              # navy, not black: the darkening is part of the palette
FPS = 30
SR = 24000                                       # set by the voice backend on first use
LEAD, TAIL = 0.35, 0.7                           # silence before and after speech in a scene
XFADE = 10                                       # frames of blend when the background clip changes
MAX_SLOW = 2.2
GRADE = "eq=saturation=0.7:contrast=1.06:brightness=-0.02,colorbalance=rs=-0.12:gs=-0.03:bs=0.14:rh=0.10:gh=0.03:bh=-0.12"
GEMINI_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]
# On the free tier each speech model allows 10 requests a day (HTTP 429 "generate_content_free_tier_requests, limit: 10",
# seen 2026-10-20), so the chain falls through to the next model with the same voice name.
DEFAULT_STYLE = ""   # a style prefix is read aloud by gemini-3.8-flash-tts (measured 2026-10-20), so none by default
NUM = re.compile(r"^([+\-]?)(\d[\d,]*)(\.\d+)?(%?)$")
SENT = re.compile(r"(?<=[.!?])\s+")

_fonts = {}
def font(idx, size):
    k = (idx, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(FONT, size, index=idx)
    return _fonts[k]

def fit(d, text, idx, size, maxw):
    """Largest font at or below `size` whose rendering of `text` fits in `maxw`."""
    while size > 20 and d.textlength(text, font=font(idx, size)) > maxw:
        size -= 4
    return font(idx, size)

def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

def parse_num(s):
    m = NUM.match(s.strip())
    if not m:
        return None
    sign, whole, frac, pct = m.groups()
    return sign, float(whole.replace(",", "") + (frac or "")), len(frac) - 1 if frac else 0, pct, "," in whole

def fmt_num(p, k):
    sign, val, dec, pct, comma = p
    s = f"{val * k:,.{dec}f}" if comma else f"{val * k:.{dec}f}"
    return f"{sign}{s}{pct}"

def wrap(d, text, f, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if not cur or d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    return lines + ([cur] if cur else [])

def rgba(c, a):
    return c + (int(255 * max(0.0, min(1.0, a))),)

def draw_lines(d, lines, f, cx, top, lh, color, a, align="center", x0=None):
    for i, line in enumerate(lines):
        x = cx - d.textlength(line, font=f) / 2 if align == "center" else x0
        d.text((x, top + i * lh), line, font=f, fill=rgba(color, a))

def draw_words(d, lines, f, cx, top, lh, color, a, t):
    """Each word lands 60 ms after the previous one and rises 18 px while fading in."""
    i = 0
    for li, line in enumerate(lines):
        x = cx - d.textlength(line, font=f) / 2
        for w in line.split(" "):
            k = ease((t - 0.06 * i) / 0.3)
            d.text((x, top + li * lh + 18 * (1 - k)), w, font=f, fill=rgba(color, a * k))
            x += d.textlength(w + " ", font=f)
            i += 1

def shade(W, H):
    """Static darkening: 45% overall, deeper toward the caption zone at the bottom."""
    img = Image.new("RGBA", (W, H), SHADE + (int(255 * 0.45),))
    d = ImageDraw.Draw(img)
    y0 = int(H * 0.60)
    for y in range(y0, H):
        d.line([(0, y), (W, y)], fill=SHADE + (int(255 * (0.45 + 0.40 * (y - y0) / (H - y0))),))
    return img

def overlay(sc, t, dur, prog, W, H):
    """The typography layer for one frame: RGBA, transparent where the background shows."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rectangle([0, 0, int(W * prog), 6], fill=rgba(ACC, 1))
    a = ease(t / 0.45) * (1 - ease((t - (dur - 0.3)) / 0.3))
    drift = 1 + 0.03 * t / dur                       # slow growth of the type itself
    m, cx, cy = int(W * 0.085), W / 2, H * 0.42
    big, sub = sc.get("big", ""), sc.get("sub", "")
    if isinstance(big, list):                       # pair with bars
        ps = [parse_num(x) for x in big]
        vals = [p[1] for p in ps if p]
        mx = max(vals) if vals else 1
        colw, fl = W * 0.40, font(MED, 38)
        bottom = cy
        for i, x in enumerate(big):
            ccx = W * (0.27 if i == 0 else 0.73)
            k = ease((t - 0.1) / 1.0)
            s = fmt_num(ps[i], k) if ps[i] else x
            fn = fit(d, fmt_num(ps[i], 1) if ps[i] else x, HEAVY, int(170 * drift), colw)
            d.text((ccx - d.textlength(s, font=fn) / 2, cy - 220), s, font=fn, fill=rgba(ACC if i else FG, a))
            if ps[i]:
                bw = colw * ps[i][1] / mx * k
                d.rectangle([ccx - colw / 2, cy - 10, ccx + colw / 2, cy + 4], fill=rgba(TRACK, a))
                d.rectangle([ccx - colw / 2, cy - 10, ccx - colw / 2 + bw, cy + 4], fill=rgba(ACC if i else FG, a))
            lines = wrap(d, sc.get("labels", ["", ""])[i], fl, colw)
            draw_lines(d, lines, fl, ccx, cy + 30, 48, DIM, a)
            bottom = max(bottom, cy + 30 + 48 * len(lines))
        sub_top = bottom + 50
    elif parse_num(big):                            # one counting number
        fn = fit(d, big, HEAVY, int(300 * drift), W - 2 * m)
        s = fmt_num(parse_num(big), ease((t - 0.1) / 1.0))
        d.text((cx - d.textlength(s, font=fn) / 2, cy - 230), s, font=fn, fill=rgba(ACC, a))
        sub_top = cy + 130
    else:                                           # phrase, word by word
        n = len(big)
        size = 112 if n <= 30 else 90 if n <= 70 else 72 if n <= 120 else 58
        quote = big[:1] in "“\""
        fn = fit(d, max(big.split(), key=len), DEMI_IT if quote else DEMI, int(size * drift), W - 2 * m)
        lh = int(fn.size * 1.18)
        lines = wrap(d, big, fn, W - 2 * m)
        top = cy - lh * len(lines) / 2
        draw_words(d, lines, fn, cx, top, lh, FG, a, t)
        sub_top = top + lh * len(lines) + 40
    if sub:
        fs = font(MED, 44)
        draw_lines(d, wrap(d, sub, fs, W - 2 * m), fs, cx, sub_top, 58, DIM, a * ease((t - 0.4) / 0.4))
    vo = sc.get("vo", "")
    if vo:                                          # caption: the sentence being spoken right now
        sents = SENT.split(vo)
        speech = max(dur - LEAD - TAIL, 0.1)
        total = sum(len(s) for s in sents)
        at, cur, t0 = LEAD, sents[-1], LEAD
        for s in sents:
            seg = speech * len(s) / total
            if t < at + seg:
                cur, t0 = s, at
                break
            at += seg
        fc = font(MED, 42)
        lines = wrap(d, cur, fc, W - 2 * m)[:4]
        top = H * 0.84 - 54 * len(lines)
        d.rectangle([m - 2, top + 10, m + 4, top + 54 * len(lines) - 6], fill=rgba(ACC, a))
        draw_lines(d, lines, fc, cx, top, 54, FG, a * ease((t - t0 + 0.15) / 0.25), align="left", x0=m + 28)
    return layer

def clip_len(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)

class Backgrounds:
    """Streams background frames. Each (clip, slow factor) is prepared once: forward only,
    graded, motion-interpolated when slowed, cropped to the frame, 30 fps; then read frame by
    frame through ffmpeg. No reverse, no loop."""
    def __init__(self, assets, cache, W, H):
        self.assets, self.cache, self.W, self.H = assets, cache, W, H
        self.readers, self.last, self.cur, self.cur_img = {}, None, None, None
        self.flat = Image.new("RGB", (W, H), BG)
        self.shade = shade(W, H)
        self.warned = set()
        os.makedirs(cache, exist_ok=True)

    def prep(self, name, need):
        src = os.path.join(self.assets, name)
        if not os.path.exists(src):
            return None
        factor = (need + 0.35) / max(clip_len(src), 0.1)  # margin: interpolation trims a few frames at the end
        factor = min(MAX_SLOW, max(1.0, math.ceil(factor * 20) / 20))   # coarse steps so the cache gets reused
        dst = os.path.join(self.cache, re.sub(r"[^\w.-]", "_", name) + f".x{factor:.2f}.{self.W}x{self.H}.mp4")
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            slow = f"setpts={factor}*PTS,minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1," if factor > 1.02 else f"fps={FPS},"
            vf = (f"[0:v]{slow}{GRADE},scale={self.W}:{self.H}:force_original_aspect_ratio=increase,"
                  f"crop={self.W}:{self.H}[v]")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-filter_complex", vf, "-map", "[v]", "-an",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", dst], check=True)
        return dst

    def reader(self, name, need):
        if name not in self.readers:
            p = self.prep(name, need)
            self.readers[name] = p and subprocess.Popen(
                ["ffmpeg", "-v", "error", "-i", p, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        return self.readers[name]

    def frame(self, name, f, need):
        """Background for frame f of a scene using clip `name` (None = flat colour)."""
        r = name and self.reader(name, need)
        raw = r.stdout.read(self.W * self.H * 3) if r else b""
        if r and len(raw) < self.W * self.H * 3:        # clip ran out: hold the last frame, say so once
            if name not in self.warned:
                print(f"warning: {name} is shorter than its scene even slowed; last frame held", file=sys.stderr)
                self.warned.add(name)
            img = self.cur_img if self.cur == name and self.cur_img is not None else self.flat
        else:
            img = Image.frombytes("RGB", (self.W, self.H), raw) if r else self.flat
        if name != self.cur:
            self.last, self.cur = self.cur_img, name
        if self.last is not None and f < XFADE:
            img = Image.blend(self.last, img, (f + 1) / XFADE)
        self.cur_img = img
        return Image.alpha_composite(img.convert("RGBA"), self.shade)

    def close(self):
        for r in self.readers.values():
            if r:
                r.stdout.close(); r.kill()

def frame(sc, t, dur, prog, W, H, bgs, f):
    bg = sc.get("bg")
    if isinstance(bg, list):                        # several clips in one scene: a cut at equal intervals
        n = len(bg)
        i = min(n - 1, int(n * f / max(1, round(dur * FPS))))
        bg, dur, f = bg[i], dur / n, f - round(dur * FPS * i / n)
    base = bgs.frame(bg, f, dur)
    return Image.alpha_composite(base, overlay(sc, t, dur, prog, W, H)).convert("RGB")

# ---- voices -------------------------------------------------------------------------------

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_FILES = [os.path.join(REPO, ".env"), os.path.expanduser("~/Projects/VoiceAgent/.env")]

def env_key(name, env_file=None):
    """A secret from the environment, else from the first .env file that has the line; never printed."""
    key = os.environ.get(name)
    for path in ([env_file] if env_file else []) + ENV_FILES:
        if key or not path or not os.path.exists(path):
            continue
        for line in open(path):
            m = re.match(rf"\s*{name}=(.*)", line)
            if m:
                key = m.group(1).strip().strip("\"'")
    if not key:
        sys.exit(f"{name} not set and not found in {', '.join(ENV_FILES)}")
    return key

def grok_tts(text, voice, key):
    """xAI text-to-speech: POST /v1/tts, answers with a WAV (pcm16 mono) at the requested rate."""
    body = {"text": text, "voice_id": voice, "language": "en", "output_format": {"codec": "wav", "sample_rate": 24000}}
    req = urllib.request.Request("https://api.x.ai/v1/tts", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    import io
    with wave.open(io.BytesIO(urllib.request.urlopen(req, timeout=180).read())) as w:
        assert (w.getnchannels(), w.getsampwidth()) == (1, 2), w.getparams()
        return w.readframes(w.getnframes()), w.getframerate()

_model = [0]                                     # index into GEMINI_MODELS; advances when a model's quota is spent

def gemini_tts(text, voice, style, key):
    """One request to Google's text-to-speech models; returns (pcm16 mono bytes, sample rate)."""
    body = {"contents": [{"parts": [{"text": f"{style}\n\n{text}" if style else text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    for attempt in range(3 * len(GEMINI_MODELS)):
        model = GEMINI_MODELS[_model[0] % len(GEMINI_MODELS)]
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                     data=json.dumps(body).encode(), headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=180))
            break
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
            print(f"speech: {model} HTTP {e.code}, switching model", file=sys.stderr)
            _model[0] += 1
            if _model[0] % len(GEMINI_MODELS) == 0:   # every model refused: wait a bit before the next round
                import time; time.sleep(30)
    else:
        sys.exit("speech: every Gemini speech model refused (quota); try tomorrow or enable billing for the key")
    part = resp["candidates"][0]["content"]["parts"][0]["inlineData"]
    data = base64.b64decode(part["data"])
    if part["mimeType"].startswith("audio/wav"):   # the model answers with a WAV container
        import io
        with wave.open(io.BytesIO(data)) as w:
            assert (w.getnchannels(), w.getsampwidth()) == (1, 2), w.getparams()
            return w.readframes(w.getnframes()), w.getframerate()
    return data, int(re.search(r"rate=(\d+)", part["mimeType"]).group(1))   # raw PCM: audio/L16;codec=pcm;rate=24000

def say_tts(text, voice, rate_wpm):
    spoken = re.sub(r"\bAI\b", "A.I.", text)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        path = f.name
    subprocess.run(["say", "-v", voice, "-r", str(rate_wpm), "-o", path, "--data-format=LEI16@22050", spoken], check=True)
    with wave.open(path) as w:
        assert (w.getnchannels(), w.getsampwidth()) == (1, 2), w.getparams()
        pcm, sr = w.readframes(w.getnframes()), w.getframerate()
    os.unlink(path)
    return pcm, sr

def make_speaker(voice, style, env_file, rate_wpm, cache):
    """Returns speak(text) -> (pcm, rate), cached on disk per voice and text."""
    os.makedirs(cache, exist_ok=True)
    backend, _, name = voice.partition(":")
    key = env_key("GEMINI_API_KEY", env_file) if backend == "gemini" else env_key("XAI_API_KEY", env_file) if backend == "grok" else None
    def speak(text):
        tag = hashlib.sha1(f"{voice}|{style if key else rate_wpm}|{text}".encode()).hexdigest()[:16]
        path = os.path.join(cache, tag + ".wav")
        if os.path.exists(path):
            with wave.open(path) as w:
                return w.readframes(w.getnframes()), w.getframerate()
        if backend == "gemini":
            pcm, sr = gemini_tts(text, name, style, key)
        elif backend == "grok":
            pcm, sr = grok_tts(text, name, key)
        else:
            pcm, sr = say_tts(text, voice, rate_wpm)
        with wave.open(path, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm)
        return pcm, sr
    return speak

def plan(scenes, speak):
    """Attach duration and speech bytes to each scene. Clips used twice are a planning error."""
    global SR
    seen = [n for sc in scenes for n in (sc["bg"] if isinstance(sc.get("bg"), list) else [sc.get("bg")]) if n]
    for name in sorted(set(n for n in seen if seen.count(n) > 1)):
        print(f"warning: {name} is used in {seen.count(name)} scenes; one clip per scene is the rule", file=sys.stderr)
    for sc in scenes:
        vo = sc.get("vo", "")
        if vo and speak:
            sc["_pcm"], SR = speak(vo)
            sc["_dur"] = LEAD + len(sc["_pcm"]) / 2 / SR + TAIL
        elif vo:
            sc["_pcm"] = b""
            sc["_dur"] = LEAD + 0.36 * len(vo.split()) + TAIL
        else:
            sc["_pcm"] = b""
            sc["_dur"] = float(sc.get("dur", 2.5))
        sc["_dur"] = round(sc["_dur"] * FPS) / FPS
    return scenes

def write_audio(scenes, path):
    with wave.open(path, "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(SR)
        for sc in scenes:
            n = int(sc["_dur"] * SR)
            body = b"\0\0" * int(LEAD * SR) + sc["_pcm"]
            out.writeframes(body + b"\0\0" * max(0, n - len(body) // 2))

def render(scenes, out, W, H, with_voice, music, tmp, bgs):
    total = sum(sc["_dur"] for sc in scenes)
    audio = os.path.join(tmp, "audio.wav")
    write_audio(scenes, audio)
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", audio]
    if music:                                       # bed under the voice: ducked by the voice, faded at both ends
        cmd += ["-stream_loop", "-1", "-i", music, "-filter_complex",
                f"[2:a]atrim=0:{total},volume=0.18,afade=t=in:d=2,afade=t=out:st={total - 3}:d=3[m];"
                f"[m][1:a]sidechaincompress=threshold=0.015:ratio=10:attack=40:release=700[md];"
                f"[md][1:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]", "-map", "0:v", "-map", "[a]"]
    elif not with_voice:
        cmd += ["-an"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
            "-movflags", "+faststart", "-shortest", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    done = 0.0
    for sc in scenes:
        n = round(sc["_dur"] * FPS)
        for f in range(n):
            t = f / FPS
            p.stdin.write(frame(sc, t, sc["_dur"], (done + t) / total, W, H, bgs, f).tobytes())
        done += sc["_dur"]
    p.stdin.close()
    if p.wait():
        sys.exit("ffmpeg failed")
    return total

def selftest():
    assert fmt_num(parse_num("10,980"), 1) == "10,980"
    assert fmt_num(parse_num("+66%"), 0.5) == "+33%"
    assert fmt_num(parse_num("12.2%"), 1) == "12.2%"
    assert parse_num("6 to 1") is None and parse_num("Hiring anyway") is None
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    assert wrap(d, "one two three four", font(MED, 40), 200) == ["one two", "three four"]
    assert fit(d, "12.2%", HEAVY, 300, 400).size < 300
    with tempfile.TemporaryDirectory() as tmp:
        bgs = Backgrounds(tmp, tmp, 540, 960)
        img = frame({"big": ["39%", "91%"], "labels": ["a", "b"], "sub": "s", "vo": "Hi. There.", "bg": ["missing.mp4", "also.mp4"]}, 0.8, 3, 0.5, 540, 960, bgs, 24)
        assert img.size == (540, 960)
        speak = make_speaker("Samantha", "", None, 220, tmp)        # macOS path, exercises the cache
        pcm, sr = speak("one")
        assert sr == 22050 and len(pcm) > 1000 and speak("one") == (pcm, sr)
    print("selftest ok")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--assets", help="directory that 'bg' and 'music' paths are relative to (default: <film>/assets)")
    ap.add_argument("--voice", default="grok:carina", help="'grok:<voice_id>' (xAI), 'gemini:<Voice>' (Google) or a macOS `say` voice; '' for a mute video")
    ap.add_argument("--env-file", help="an extra .env to read keys from, before the repository's .env and ~/Projects/VoiceAgent/.env")
    ap.add_argument("--rate", type=int, default=220, help="words per minute for macOS voices")
    ap.add_argument("--size", default="1080x1920")
    ap.add_argument("--stills")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    W, H = map(int, a.size.split("x"))
    doc = json.load(open(a.scenario))
    scenes = doc["scenes"]
    film = os.path.dirname(os.path.abspath(a.scenario))
    assets = a.assets or os.path.join(film, "assets")
    tmpdir = os.path.join(film, ".tmp")
    music = doc.get("music") and os.path.join(assets, doc["music"])
    if music and not os.path.exists(music):
        print(f"warning: music {music} not found; rendering without a bed", file=sys.stderr)
        music = None
    bgs = Backgrounds(assets, os.path.join(tmpdir, "prep"), W, H)
    try:
        if a.stills:
            os.makedirs(a.stills, exist_ok=True)
            for i, sc in enumerate(plan(scenes, None)):
                for f in range(45):                      # 1.5 s in, so count-ups and word reveals are visible
                    img = frame(sc, f / FPS, sc["_dur"], (i + 0.5) / len(scenes), W, H, bgs, f)
                img.save(os.path.join(a.stills, f"{i:02d}.png"))
            return print(f"{len(scenes)} stills in {a.stills}")
        speak = a.voice and make_speaker(a.voice, doc.get("style", DEFAULT_STYLE), a.env_file, a.rate, os.path.join(tmpdir, "tts"))
        with tempfile.TemporaryDirectory() as tmp:
            plan(scenes, speak)
            total = render(scenes, a.out, W, H, bool(a.voice), music, tmp, bgs)
        print(f"{a.out}: {total:.1f}s, {len(scenes)} scenes")
    finally:
        bgs.close()

if __name__ == "__main__":
    main()
