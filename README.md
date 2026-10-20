# notes-infrastructure

Server side of [dt.in.th](https://dt.in.th): it turns a vault of Markdown notes into the published site. See [docs/SPEC.md](docs/SPEC.md) for the design. The previous implementation is on the `legacy` branch.

- **Vault**: a directory of `<slug>.md` files in its own git repo. `public: true` marks a note to be published.
- **Supabase**: what is actually published, read by [notes-frontend](https://github.com/dtinth/notes-frontend).
- **Static site**: [dtinth/dt.in.th](https://github.com/dtinth/dt.in.th), built from what is published.

`notes serve` watches the vault, syncs it with its remote, serves the backoffice at `/admin/`, and publishes through plan/apply.

## Development

```sh
mise install
bun install
bun test
```

Integration tests run against a local Supabase (Docker), with the schema in `supabase/migrations`:

```sh
bun run supabase start -x imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta
bun run test:integration
```

Check the static site output against the live site (byte-identical apart from pages legacy compiled with an older compiler):

```sh
bun run parity
```

Run the server and the backoffice against an example vault:

```sh
bun run build:backoffice
NOTES_VAULT=example-vault NOTES_SYNC=0 NOTES_API_KEY=dev \
  SUPABASE_URL=http://127.0.0.1:58321 SUPABASE_API_KEY=<service role key> \
  SUPABASE_ADMIN_UID=none bun src/cli.ts serve
# then open http://127.0.0.1:21024/admin/ and sign in with the API key "dev"
```

## CLI

`bun run build` bundles `dist/notes.js`, a single file with a `#!/usr/bin/env bun` shebang. Run it without arguments for usage. With `NOTES_URL` and `NOTES_API_KEY` set, `notes plan` and `notes apply` go through the server.

## Deployment

Dokploy builds the `Dockerfile`. The settings it needs (the `NOTES_UID`/`NOTES_GID` build args, mounts, env) are listed at the top of the Dockerfile.

| Variable | |
| --- | --- |
| `NOTES_API_KEY` | Signs backoffice sessions; also accepted as a bearer token by the API |
| `SUPABASE_API_KEY` | Supabase service role key |
| `SUPABASE_ADMIN_UID` | The Supabase user allowed into the backoffice and private notes |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` | GitHub App installed on the vault repo and dtinth/dt.in.th, with contents read/write. The key can be one line: `base64 -w0 key.pem`, or the PEM with `\n` escapes |
| `NOTES_VAULT_REMOTE` | The vault repo, e.g. `https://github.com/dtinth/notes`. If the vault folder is empty, it is cloned there on first run |
| `NOTES_SITE_REMOTE` | Defaults to `https://github.com/dtinth/dt.in.th` |
| `NOTES_SYNC_IDLE_MS` | How long the vault must be quiet before it is committed (default 5 minutes) |
| `NOTES_SYNC` | `0` turns vault sync off |
