# Recommended Monorepo Structure

This repo is currently the web app plus a new Python backend scaffold.

```text
/
  apps/
    api/        # Python backend for scraping, AI, and API endpoints
  packages/
    shared/     # Shared schemas and types, added later if needed
  src/          # Existing web app, kept in place for now
```

## Why this shape

- Keeps the current web app running without a risky file move.
- Gives Python a dedicated service boundary.
- Leaves room for a future mobile app to talk to the same backend.
- Makes it easy to add shared contracts later without mixing runtimes.
