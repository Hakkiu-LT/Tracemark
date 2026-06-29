FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

RUN adduser -D -g "" appuser
USER appuser

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5173/ || exit 1

CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]
