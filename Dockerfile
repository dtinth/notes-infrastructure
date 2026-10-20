FROM oven/bun:1.4.3-debian

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --production
COPY src ./src

# The server runs as whatever uid owns the bind-mounted vault (set `user:`
# in compose), which may have no home directory or passwd entry. So git is
# configured through the environment rather than ~/.gitconfig:
# trust the mounted repos, and commit as the notes bot.
ENV HOME=/data/home \
  XDG_CACHE_HOME=/data/cache \
  NOTES_VAULT=/vault \
  NOTES_SITE_DIR=/data/site \
  GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0=safe.directory \
  GIT_CONFIG_VALUE_0=* \
  PORT=21024

EXPOSE 21024
CMD ["bun", "src/cli.ts", "serve"]
