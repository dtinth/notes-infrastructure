FROM oven/bun:1.4.3-debian

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --production
COPY src ./src

# Deployed by Dokploy. There, set:
# - the run user to the uid:gid that owns the vault on the host
# - mounts: the vault (bind) at /vault, a volume at /data
# - env: NOTES_API_KEY, SUPABASE_API_KEY, SUPABASE_ADMIN_UID,
#   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, NOTES_SITE_REMOTE
#
# That uid may have no home directory or passwd entry, so git is
# configured through the environment rather than ~/.gitconfig:
# trust the mounted repos, and commit as the notes bot.
ENV HOME=/data/home \
  XDG_CACHE_HOME=/data/cache \
  NOTES_VAULT=/vault \
  NOTES_SITE_DIR=/data/site \
  GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0=safe.directory \
  GIT_CONFIG_VALUE_0=* \
  GIT_AUTHOR_NAME=notes \
  GIT_AUTHOR_EMAIL=notes@dt.in.th \
  GIT_COMMITTER_NAME=notes \
  GIT_COMMITTER_EMAIL=notes@dt.in.th \
  NOTES_SITE_REMOTE=https://github.com/dtinth/dt.in.th \
  PORT=21024

EXPOSE 21024
CMD ["bun", "src/cli.ts", "serve"]
