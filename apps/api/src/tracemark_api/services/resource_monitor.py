"""In-process system resource sampler (CPU/RAM + Playwright child processes).

Previously lived in routes/admin_resources.py and was started/stopped by the customer
app. After the admin portal split, the customer app no longer controls it, so the
sampler AUTO-STARTS on API startup and runs continuously. The admin portal reads the
ring buffer over the internal service-to-service channel.
"""
from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone

import psutil

MAX_SAMPLES = 600      # ~10-minute rolling window at 1 sample/s
SAMPLE_INTERVAL = 1    # seconds

_metrics_log: list[dict] = []
_lock = threading.Lock()
_started = False


def _sampling_loop() -> None:
    process = psutil.Process(os.getpid())
    try:
        psutil.cpu_percent(interval=None)  # prime the CPU counter
    except Exception:
        pass

    while True:
        try:
            mem = psutil.virtual_memory()
            rss = process.memory_info().rss
            cpu = psutil.cpu_percent(interval=None)

            browser_count = 0
            scraper_rss = 0
            for child in process.children(recursive=True):
                try:
                    name = child.name().lower()
                    try:
                        cmdline = " ".join(child.cmdline()).lower()
                    except Exception:
                        cmdline = ""
                    if any(p in name for p in ["chrome", "chromium", "playwright", "node"]) or any(
                        p in cmdline for p in ["chrome", "chromium", "playwright", "node"]
                    ):
                        browser_count += 1
                        try:
                            scraper_rss += child.memory_info().rss
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            sample = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "ram_total": mem.total,
                "ram_used": mem.used,
                "ram_percent": mem.percent,
                "process_rss": rss,
                "scraper_rss": scraper_rss,
                "cpu_percent": cpu,
                "child_browsers": browser_count,
            }
            with _lock:
                _metrics_log.append(sample)
                if len(_metrics_log) > MAX_SAMPLES:
                    _metrics_log.pop(0)
        except Exception as e:  # noqa: BLE001
            print(f"[Resource Monitor] Sampling error: {e}")
        time.sleep(SAMPLE_INTERVAL)


def start_monitoring() -> None:
    """Start the sampler once (idempotent). Called on API startup."""
    global _started
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_sampling_loop, daemon=True).start()
    print("[Resource Monitor] Sampler started.")


def get_metrics() -> list[dict]:
    with _lock:
        return [dict(m) for m in _metrics_log]


def get_status() -> dict:
    with _lock:
        return {"collecting": _started, "samples": len(_metrics_log)}
