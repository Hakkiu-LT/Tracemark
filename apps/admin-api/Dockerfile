FROM python:3.11-slim

# Pin uv to a specific version for reproducible builds (avoids supply-chain risk from :latest).
# TODO: also pin python:3.11-slim with a SHA256 digest for full supply-chain hardening.
COPY --from=ghcr.io/astral-sh/uv:0.10.10 /uv /uvx /bin/

WORKDIR /app

# Copy lockfile first so Docker layer cache invalidates only when deps change.
COPY pyproject.toml uv.lock .

# Export locked deps (excluding the project itself) and install pinned versions.
RUN mkdir -p src/tracemark_admin_api && touch src/tracemark_admin_api/__init__.py
RUN uv export --frozen --no-hashes --no-emit-project -o /tmp/requirements.txt && \
    uv pip install --system --no-cache --compile-bytecode -r /tmp/requirements.txt

# Copy the actual source and install the project itself (deps already pinned above).
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN uv pip install --system --no-cache --compile-bytecode --no-deps .

# Non-root for a smaller blast radius (no Playwright/browsers needed here).
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

# --proxy-headers + trust the internal docker network so request.client.host is
# the real client IP (behind Caddy) — needed for correct rate-limit keys and
# audit-log IPs. The container is only reachable via Caddy on the internal net.
CMD ["uvicorn", "tracemark_admin_api.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
