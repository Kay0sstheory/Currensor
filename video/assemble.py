"""Stitch the showcase video in landscape (YouTube, reviewers) and portrait (Instagram, X).

Run: python3 assemble.py [landscape|portrait|all]   -> out/currensor-showcase[-portrait].mp4
Edit SEGMENTS to swap in retakes or retime a clip. Chat clips keep only the listed
moments ("parts"), so the waiting while ChatGPT or Claude thinks never reaches the video.
"""
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

VIDEO_DIR = Path(__file__).parent
OUT_DIR = VIDEO_DIR / "out"
BUILD_DIR = OUT_DIR / "build"
FPS = 30
FADE_SECONDS = 0.35

FORMATS = {
    "landscape": {"width": 1920, "height": 1080, "webapp": "webapp.webm", "suffix": ""},
    "portrait": {"width": 1080, "height": 1920, "webapp": "webapp_portrait.webm", "suffix": "-portrait"},
}

# Screen recordings are 2880x1864 (Retina). Landscape keeps a 16:9 window below Chrome's
# tab strip, bookmarks bar and debugging banner. Portrait keeps only the chat column,
# which is then shown under a caption.
SCREEN_CROPS = {
    "landscape": "crop=2504:1408:188:440",
    "portrait": "crop=1600:1408:690:440",
}

# Moments worth showing, in seconds of the raw recording; found with ffmpeg freezedetect.
CHATGPT_PARTS = [(0.0, 1.2), (6.9, 8.2), (12.3, 19.0)]
CLAUDE_PARTS = [(0.0, 1.0), (4.0, 5.0), (11.4, 18.0)]

LOGO = "Curren<span class=accent>$</span>or"
SEGMENTS = [
    {"card": (LOGO, "Live exchange rates, side by side"), "seconds": 3},
    {"card": ("On the web", "kay0sstheory.github.io/Currensor"), "seconds": 2},
    {"webapp": True, "parts": [(1.5, 17.0)]},
    {"card": ("Inside ChatGPT", "@Currensor  Convert 250 CAD to INR, EUR and JPY"), "seconds": 2.5},
    {"clip": "chatgpt.mp4", "parts": CHATGPT_PARTS, "caption": "Inside ChatGPT"},
    {"card": ("Inside Claude", "Same plugin, same live card"), "seconds": 2.5},
    {"clip": "claude.mp4", "parts": CLAUDE_PARTS, "caption": "Inside Claude"},
    {"card": (LOGO, "Free &middot; no sign-up &middot; works in Claude and ChatGPT"), "seconds": 3.5},
]

CARD_HTML = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
<style>
  html, body {{ margin: 0; width: {width}px; height: {height}px; background: #0D0D0F; }}
  body {{ display: flex; flex-direction: column; align-items: center; justify-content: {justify};
          box-sizing: border-box; padding: {padding}px 60px; text-align: center;
          background: radial-gradient(circle at 50% 45%, rgba(232,255,89,0.07), transparent 55%), #0D0D0F; }}
  h1 {{ font-family: 'Space Mono', monospace; font-weight: 700; font-size: {title_size}px; color: #E8E8EC;
        margin: 0 0 28px; letter-spacing: -2px; }}
  .accent {{ color: #E8FF59; }}
  p {{ font-family: 'DM Sans', sans-serif; font-size: {subtitle_size}px; color: #7A7A85; margin: 0; line-height: 1.35; }}
</style></head><body><h1>{title}</h1><p>{subtitle}</p></body></html>"""


def run_ffmpeg(arguments):
    command = ["ffmpeg", "-v", "error", "-y", *arguments]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")


def card_markup(title, subtitle, width, height, as_caption=False):
    portrait = height > width
    return CARD_HTML.format(
        width=width, height=height, title=title, subtitle=subtitle,
        justify="flex-start" if as_caption else "center",
        padding=230 if as_caption else 0,
        title_size=96 if portrait else 104,
        subtitle_size=44 if portrait else 40,
    )


def render_card_images(format_name, width, height):
    card_paths = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})
        for index, segment in enumerate(SEGMENTS):
            needs_backdrop = format_name == "portrait" and "caption" in segment
            if "card" not in segment and not needs_backdrop:
                continue
            if "card" in segment:
                html = card_markup(*segment["card"], width, height)
            else:
                html = card_markup(segment["caption"], "", width, height, as_caption=True)
            page.set_content(html)
            page.wait_for_load_state("networkidle")
            image_path = BUILD_DIR / f"{format_name}_card_{index}.png"
            page.screenshot(path=str(image_path))
            card_paths[index] = image_path
        browser.close()
    return card_paths


def fade_filter(seconds):
    fade_out_start = max(seconds - FADE_SECONDS, 0)
    return f"fade=t=in:st=0:d={FADE_SECONDS},fade=t=out:st={fade_out_start}:d={FADE_SECONDS}"


def parts_filter(parts, prepare):
    """Trim each kept moment out of the source and join them back to back."""
    chains, labels = [], []
    for number, (start, end) in enumerate(parts):
        label = f"part{number}"
        chains.append(f"[s{number}]trim={start}:{end},setpts=PTS-STARTPTS,{prepare}[{label}]")
        labels.append(f"[{label}]")
    chains.append(f"{''.join(labels)}concat=n={len(parts)}:v=1:a=0[joined]")
    return chains


def render_clip(index, segment, format_name, spec, card_paths, output_path):
    width, height = spec["width"], spec["height"]
    is_webapp = segment.get("webapp", False)
    source = OUT_DIR / (spec["webapp"] if is_webapp else segment["clip"])
    if not source.exists():
        raise FileNotFoundError(f"missing clip {source.name} (segment {index})")
    seconds = sum(end - start for start, end in segment["parts"])
    split = f"[0:v]split={len(segment['parts'])}" + "".join(f"[s{n}]" for n in range(len(segment["parts"])))
    chains = [split]
    if is_webapp or format_name == "landscape":
        crop = "" if is_webapp else SCREEN_CROPS[format_name] + ","
        prepare = f"{crop}scale={width}:{height},fps={FPS}"
        chains.extend(parts_filter(segment["parts"], prepare))
        chains.append(f"[joined]format=yuv420p,{fade_filter(seconds)}[out]")
        inputs = ["-i", str(source)]
    else:
        # Portrait chat clip: the chat column sits under its caption on a branded backdrop.
        prepare = f"{SCREEN_CROPS[format_name]},scale={width}:-2,fps={FPS}"
        chains.extend(parts_filter(segment["parts"], prepare))
        chains.append(f"[1:v]scale={width}:{height},fps={FPS}[backdrop]")
        chains.append("[backdrop][joined]overlay=x=0:y=(H-h)/2+120:shortest=1,"
                      f"format=yuv420p,{fade_filter(seconds)}[out]")
        inputs = ["-i", str(source), "-loop", "1", "-t", str(seconds), "-i", str(card_paths[index])]
    run_ffmpeg([*inputs, "-filter_complex", ";".join(chains), "-map", "[out]", "-an",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS), str(output_path)])


def render_segment(index, segment, format_name, spec, card_paths):
    output_path = BUILD_DIR / f"{format_name}_segment_{index:02d}.mp4"
    if "card" in segment:
        seconds = segment["seconds"]
        run_ffmpeg(["-loop", "1", "-t", str(seconds), "-i", str(card_paths[index]), "-an",
                    "-vf", f"scale={spec['width']}:{spec['height']},fps={FPS},format=yuv420p,{fade_filter(seconds)}",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS), str(output_path)])
    else:
        render_clip(index, segment, format_name, spec, card_paths, output_path)
    return output_path


def join_segments(segment_paths, final_path):
    list_path = BUILD_DIR / f"{final_path.stem}_segments.txt"
    list_path.write_text("".join(f"file '{path.name}'\n" for path in segment_paths))
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(list_path), "-c", "copy",
                "-movflags", "+faststart", str(final_path)])


def assemble(format_name):
    spec = FORMATS[format_name]
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    card_paths = render_card_images(format_name, spec["width"], spec["height"])
    segment_paths = [render_segment(index, segment, format_name, spec, card_paths)
                     for index, segment in enumerate(SEGMENTS)]
    final_path = OUT_DIR / f"currensor-showcase{spec['suffix']}.mp4"
    join_segments(segment_paths, final_path)
    return final_path


if __name__ == "__main__":
    requested = sys.argv[1] if len(sys.argv) > 1 else "all"
    format_names = list(FORMATS) if requested == "all" else [requested]
    try:
        for name in format_names:
            print(assemble(name))
    except (RuntimeError, FileNotFoundError, KeyError) as error:
        sys.exit(f"could not build: {error}")
