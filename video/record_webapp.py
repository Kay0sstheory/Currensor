"""Record the web-app clip for the showcase video against the live site.

Regenerable: run again any time the site changes. Output lands in video/out/.
"""
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

LIVE_URL = "https://kay0sstheory.github.io/Currensor/"
OUT_DIR = Path(__file__).parent / "out"
# Each layout: browser size in pixels, and how far to enlarge the page to fill it.
LAYOUTS = {
    "landscape": {"viewport": {"width": 1920, "height": 1080}, "zoom": "1.5"},
    "portrait": {"viewport": {"width": 1080, "height": 1920}, "zoom": "2.2"},
}
TYPING_DELAY_MS = 160


def pick_currency(page, opener_selector, search_text):
    page.click(opener_selector)
    page.wait_for_timeout(600)
    page.fill("#pickerSearch", "")
    page.type("#pickerSearch", search_text, delay=TYPING_DELAY_MS)
    page.wait_for_timeout(700)
    page.locator(".picker-item:not(.disabled)").first.click()
    page.wait_for_timeout(1200)


def perform_demo(page, zoom):
    page.goto(LIVE_URL, wait_until="networkidle")
    page.wait_for_selector("#liveText:has-text('Live')", timeout=15000)
    page.evaluate(f"document.documentElement.style.zoom = '{zoom}'")
    page.wait_for_timeout(2000)

    pick_currency(page, "#fromBtn", "canad")

    page.click("#amount", click_count=3)
    page.type("#amount", "250", delay=TYPING_DELAY_MS * 2)
    page.wait_for_timeout(2500)

    page.click("#themeToggle")
    page.wait_for_timeout(1800)
    page.click("#themeToggle")
    page.wait_for_timeout(1200)

    page.click("#shareBtn")
    page.wait_for_timeout(3500)
    page.click("#shareClose")
    page.wait_for_timeout(1000)


def record(layout_name="landscape"):
    layout = LAYOUTS[layout_name]
    viewport = layout["viewport"]
    output_name = "webapp.webm" if layout_name == "landscape" else f"webapp_{layout_name}.webm"
    OUT_DIR.mkdir(exist_ok=True)
    raw_dir = OUT_DIR / "raw"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(
            viewport=viewport,
            record_video_dir=str(raw_dir),
            record_video_size=viewport,
            color_scheme="dark",
        )
        page = context.new_page()
        perform_demo(page, layout["zoom"])
        video_path = Path(page.video.path())
        context.close()
        browser.close()
    final_path = OUT_DIR / output_name
    shutil.move(str(video_path), final_path)
    shutil.rmtree(raw_dir, ignore_errors=True)
    return final_path


if __name__ == "__main__":
    print(record(*sys.argv[1:]))
