import os
import time
import threading
import psutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from tracemark_api.routes.admin import verify_admin

router = APIRouter(prefix="/admin/resources", tags=["admin_resources"])

MAX_SAMPLES = 600          # 10-minute rolling window at 1 sample/s
SAMPLE_INTERVAL = 1        # seconds between samples


class SystemMetrics(BaseModel):
    timestamp: str
    ram_total: int
    ram_used: int
    ram_percent: float
    process_rss: int      # FastAPI process only
    scraper_rss: int      # sum of all child Playwright/Chromium processes
    cpu_percent: float
    child_browsers: int


class StatusPayload(BaseModel):
    active: bool


# ---------------------------------------------------------------------------
# In-memory ring buffer + thread state
# ---------------------------------------------------------------------------
_metrics_log: List[dict] = []
_collecting = False
_lock = threading.Lock()


def _sampling_loop():
    global _collecting
    process = psutil.Process(os.getpid())

    # Prime the CPU counter (first call always returns 0.0)
    try:
        psutil.cpu_percent(interval=None)
    except Exception:
        pass

    while True:
        with _lock:
            if not _collecting:
                break

        try:
            mem = psutil.virtual_memory()
            rss = process.memory_info().rss
            cpu = psutil.cpu_percent(interval=None)

            children = process.children(recursive=True)
            browser_count = 0
            scraper_rss = 0
            for child in children:
                try:
                    name = child.name().lower()
                    try:
                        cmdline = " ".join(child.cmdline()).lower()
                    except Exception:
                        cmdline = ""
                    
                    is_scraper = (
                        any(p in name for p in ["chrome", "chromium", "playwright", "node"]) or
                        any(p in cmdline for p in ["chrome", "chromium", "playwright", "node"])
                    )
                    
                    if is_scraper:
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

        except Exception as e:
            print(f"[Resource Monitor] Sampling error: {e}")

        time.sleep(SAMPLE_INTERVAL)

    print("[Resource Monitor] Sampler stopped.")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/status")
def set_monitoring_status(payload: StatusPayload, admin_user=Depends(verify_admin)):
    """Called by the frontend when the first mark goes active (start)
    or the last mark goes on_hold (stop)."""
    global _collecting
    with _lock:
        should_start = payload.active and not _collecting
        should_stop = not payload.active and _collecting
        _collecting = payload.active

    if should_start:
        print("[Resource Monitor] Starting sampler...")
        t = threading.Thread(target=_sampling_loop, daemon=True)
        t.start()
    elif should_stop:
        print("[Resource Monitor] Stop signal received — sampler will exit.")

    return {"collecting": _collecting, "samples": len(_metrics_log)}


@router.get("/metrics", response_model=List[SystemMetrics])
def get_recorded_metrics(admin_user=Depends(verify_admin)) -> List[SystemMetrics]:
    """Returns the in-memory ring buffer. Empty when nothing is being monitored."""
    with _lock:
        return [SystemMetrics(**m) for m in _metrics_log]


@router.get("/status")
def get_collector_status(admin_user=Depends(verify_admin)):
    """Returns whether the sampler is currently running."""
    with _lock:
        return {"collecting": _collecting, "samples": len(_metrics_log)}
