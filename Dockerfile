FROM oven/bun:1.4.3-debian AS backoffice
WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile
COPY backoffice ./backoffice
RUN bun run build:backoffice

FROM oven/bun:1.4.3-debian

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY --from=backoffice /app/backoffice/dist ./backoffice/dist

# Deployed by Dokploy. There, set:
# - build args NOTES_UID and NOTES_GID: who owns the vault on the host
#   (`id -u`, `id -g`; the gid defaults to the uid)
# - mounts: the vault folder (bind) at /vault, a named volume at /data
# - env: NOTES_API_KEY, SUPABASE_API_KEY, SUPABASE_ADMIN_UID,
#   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, NOTES_VAULT_REMOTE
#
# The server runs as that user, so files it writes in the vault belong to
# them on the host. /data is created owned by them, which a new named
# volume inherits.
ARG NOTES_UID=1000
ARG NOTES_GID=${NOTES_UID}
RUN mkdir -p /data /vault && chown ${NOTES_UID}:${NOTES_GID} /data /vault
USER ${NOTES_UID}:${NOTES_GID}
#
# That uid may have no home directory or passwd entry, so git is
# configured through the environment rather than ~/.gitconfig:
# trust the mounted repos, and commit as dtinth (as legacy sync did).
ENV HOME=/data/home \
  XDG_CACHE_HOME=/data/cache \
  NOTES_VAULT=/vault \
  NOTES_SITE_DIR=/data/site \
  GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0=safe.directory \
  GIT_CONFIG_VALUE_0=* \
  GIT_AUTHOR_NAME="Thai Pangsakulyanont" \
  GIT_AUTHOR_EMAIL=dtinth@spacet.me \
  GIT_COMMITTER_NAME="Thai Pangsakulyanont" \
  GIT_COMMITTER_EMAIL=dtinth@spacet.me \
  NOTES_SITE_REMOTE=https://github.com/dtinth/dt.in.th \
  PORT=21024

EXPOSE 21024
CMD ["bun", "src/cli.ts", "serve"]
