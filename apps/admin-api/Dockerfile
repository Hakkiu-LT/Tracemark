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

# --proxy-headers + trust X-Forwarded-* ONLY from the pinned docker bridge subnet
# (Caddy), not "*". uvicorn 0.49 parses the CIDR as a trusted network. Prevents
# any other peer from spoofing the client IP recorded in the admin audit log.
CMD ["uvicorn", "tracemark_admin_api.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "172.28.0.0/16"]
