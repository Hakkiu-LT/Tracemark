FROM python:3.11-slim

# Copy uv from the official Astral image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml .

# Dummy package structure so setuptools resolves during dependency install.
RUN mkdir -p src/tracemark_admin_api && touch src/tracemark_admin_api/__init__.py

RUN uv pip install --system --no-cache --compile-bytecode .

# Copy the actual source and remap.
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN uv pip install --system --no-cache --compile-bytecode .

# Non-root for a smaller blast radius (no Playwright/browsers needed here).
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["uvicorn", "tracemark_admin_api.main:app", "--host", "0.0.0.0", "--port", "8001"]
