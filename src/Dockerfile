FROM oven/bun:1.2-alpine

WORKDIR /app

RUN adduser -D -g "" appuser && chown -R appuser:appuser /app
USER appuser

COPY --chown=appuser:appuser package.json bun.lock bunfig.toml ./
RUN bun install

COPY --chown=appuser:appuser . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/landing || exit 1

CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]
