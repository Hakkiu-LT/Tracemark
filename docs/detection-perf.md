# Phase 2 Detection Concurrency & Performance Logs

This document logs the performance benchmarks for the concurrent brand protection scraping pipeline, comparing the sequential execution strategy against the async concurrent execution strategy.

## Performance Benchmark

- **Date:** 2026-06-24
- **Environment:** Local Python 3.11.9
- **Latency Simulation:** 500ms network round-trip time (RTT) per platform
- **Platforms Monitored:** 13 platforms (Amazon, eBay, Alibaba, Etsy, Google Shopping, AliExpress, Shopify, Facebook Marketplace, TikTok, Instagram, Google Ads, Meta Ads, Domain surveillance)

### Results Table

| Strategy | Total Duration | Speedup Factor | Concurrency Target Met (<30s) |
|---|---|---|---|
| **Sequential (Old)** | `6.5059s` | 1.00x (Baseline) | ❌ No (scaled linearly with platform count) |
| **Concurrent (New)** | `0.5087s` | **12.79x faster** | **✅ YES** |

---

## Architectural Details

The scraper was refactored to support concurrent execution of platform scans:
1. **Async Wrapper (`batch_detect`):** Added `batch_detect()` using `asyncio.gather` inside `MarketplaceScraper`.
2. **Thread Pool Offloading (`asyncio.to_thread`):** Since individual scraper search methods (like `AmazonScraper.search()`) are synchronous blocking HTTP calls, they are run concurrently in separate background threads using `asyncio.to_thread`.
3. **Endpoint Promotion:** Promoted all FastApi scraper routes (`/check-brand`, `/gather-evidence`, `/check-ads`) to `async def` to utilize the async pipeline without blocking the main event loop.

## Performance Verification

By using thread pool-offloaded async execution, we successfully decouple network latency from execution time:
- The total scraping time is now bounded by the **slowest single platform query** (typically `~0.5s` for a request) rather than the sum of all platform queries (`~6.5s`).
- This easily scales to 50+ listings while keeping the total response time under 30 seconds.
