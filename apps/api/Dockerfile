FROM python:3.11-slim

# Copy uv from the official Astral image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

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

EXPOSE 8000

CMD ["uvicorn", "tracemark_api.main:app", "--host", "0.0.0.0", "--port", "8000"]