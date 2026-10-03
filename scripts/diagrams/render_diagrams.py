#!/usr/bin/env python3
"""Render the 4 Sathi architecture diagrams (HTML -> PNG) via Playwright.

Runs from anywhere: paths are resolved relative to the repository root
(the parent of scripts/diagrams/).
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

SRC = Path(__file__).resolve().parent
OUT = SRC.parent.parent / "docs" / "diagrams"

DIAGRAMS = [
    ("architecture.html", "architecture.png", 1760),
    ("ai-layers.html", "ai-layers.png", 1840),
    ("database.html", "database.png", 2120),
    ("api-surface.html", "api-surface.png", 1880),
]


async def render(page, html_file, png_file, width):
    await page.set_viewport_size({"width": width, "height": 1000})
    await page.goto(f"file://{SRC}/{html_file}", wait_until="networkidle")
    await page.wait_for_timeout(600)
    el = page.locator("#root")
    bbox = await el.bounding_box()
    if bbox:
        fit_w = max(width, int(bbox["width"] + 80))
        fit_h = int(bbox["height"] + 80)
        await page.set_viewport_size({"width": fit_w, "height": fit_h})
        await page.wait_for_timeout(300)
    out_path = os.path.join(OUT, png_file)
    await el.screenshot(path=out_path)
    print(f"OK {png_file} ({os.path.getsize(out_path)/1024:.0f} KB, bbox {bbox['width']:.0f}x{bbox['height']:.0f})")


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": 1800, "height": 1000},
            device_scale_factor=2,
        )
        for html_file, png_file, width in DIAGRAMS:
            await render(page, html_file, png_file, width)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
