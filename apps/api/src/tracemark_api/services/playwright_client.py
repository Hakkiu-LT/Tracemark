from __future__ import annotations
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from tracemark_api.services.ssrf import validate_ssrf_url, SSRFError

# Thread pool dedicated to Playwright (sync API must run outside the asyncio loop)
_playwright_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="playwright")


def _run_playwright_screenshot(url: str) -> bytes | None:
    """
    Runs a Playwright Chromium screenshot synchronously.
    Must be called from a dedicated thread (never from the asyncio event loop).
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[Playwright] Playwright package is not installed. Skipping local screenshot.")
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            page.goto(url, timeout=30000, wait_until="networkidle")
            page.wait_for_timeout(2000)
            screenshot_bytes = page.screenshot(full_page=False, type="png")
            browser.close()
            return screenshot_bytes
    except Exception as e:
        print(f"[Playwright] Failed to take screenshot of {url}: {e}")
        return None


def take_local_screenshot(url: str) -> bytes | None:
    """
    Take a screenshot of a URL using Playwright (Chromium).
    Safe to call from both sync and async contexts:
    - Outside an event loop: runs directly in the calling thread.
    - Inside an event loop (FastAPI/asyncio): offloads to a dedicated thread
      pool via run_in_executor so the event loop is never blocked and
      sync_playwright never conflicts with asyncio.
    Returns raw PNG bytes or None on failure.
    """
    try:
        validate_ssrf_url(url)
    except SSRFError as e:
        print(f"[Playwright] Rejected unsafe URL {url}: {e}")
        return None

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No event loop running — safe to call sync directly
        return _run_playwright_screenshot(url)

    # We're inside an asyncio loop (FastAPI route via run_in_threadpool).
    # Submit the blocking work to the dedicated executor and wait for it
    # from this worker thread without touching the event loop.
    future = _playwright_executor.submit(_run_playwright_screenshot, url)
    try:
        return future.result(timeout=60)
    except Exception as e:
        print(f"[Playwright] Executor error for {url}: {e}")
        return None
