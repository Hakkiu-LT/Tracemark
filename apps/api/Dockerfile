FROM python:3.11-slim

# Pin uv to a specific version for reproducible builds (avoids supply-chain risk from :latest).
# TODO: also pin python:3.11-slim with a SHA256 digest for full supply-chain hardening.
COPY --from=ghcr.io/astral-sh/uv:0.10.10 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml .

# Create a dummy structure so setuptools doesn't fail during dependency installation
RUN mkdir -p src/tracemark_api && touch src/tracemark_api/__init__.py

# Install dependencies using uv (significantly faster than pip)
RUN uv pip install --system --no-cache .

# Copy the actual source code
COPY src/ ./src/

# Run a quick final install to map the actual source code
RUN uv pip install --system --no-cache .

# Install system dependencies for Playwright (must run as root)
RUN python -m playwright install-deps chromium

# Run as non-root user to reduce blast radius if the container is compromised
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Install Playwright browser binaries under appuser's home directory
RUN python -m playwright install chromium

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "tracemark_api.main:app", "--host", "0.0.0.0", "--port", "8000"]