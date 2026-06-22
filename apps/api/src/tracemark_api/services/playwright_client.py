from __future__ import annotations
import os

def take_local_screenshot(url: str) -> bytes | None:
    """
    Take a screenshot of a URL locally using Playwright (Chromium).
    Returns raw PNG bytes or None if anything fails.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[Playwright] Playwright package is not installed. Skipping local screenshot.")
        return None

    try:
        with sync_playwright() as p:
            # Launch in headless mode
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            # Set a timeout for loading
            page.goto(url, timeout=30000, wait_until="networkidle")
            # Wait a small delay for any animations/rendering to finish
            page.wait_for_timeout(2000)
            
            # Take the screenshot as bytes
            screenshot_bytes = page.screenshot(full_page=False, type="png")
            browser.close()
            return screenshot_bytes
    except Exception as e:
        print(f"[Playwright] Failed to take screenshot of {url}: {e}")
        return None
