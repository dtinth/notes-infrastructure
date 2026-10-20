# notes: spec (v1)

A fresh rewrite of the server side of [dt.in.th](https://dt.in.th). The old code lives on the `legacy` branch (checked out at `./legacy` for reference). Decisions below came out of a grilling session on dev-null.sh; the question numbers (Q1–Q27) refer to that thread.

## Goals

- Write from anywhere through a web backoffice, not only from a laptop with VS Code.
- No more running `./sync` in a terminal.
- The vault is its own repo, not nested inside the infra repo.
- GitHub access via a GitHub App, not SSH keys.
- Agents (Claude Code) can keep working on the vault directly as plain files.

Keep: the current Supabase setup and frontend ([notes-frontend](https://github.com/dtinth/notes-frontend)), Markdown files indexed by a server, static HTML output.

## Three layers

| Layer | What it is | Role |
| --- | --- | --- |
| Vault | Flat directory of `<slug>.md` files, its own git repo | Source of truth for everything, private included. `public: true` in front matter is the **desired** published state. |
| Supabase | `notes_contents` rows, `notes_search_keys` rows, `notes-public` bucket | The **actual** published state: one row per published note, holding a snapshot of its source and compiled output. |
| Static site | [dtinth/dt.in.th](https://github.com/dtinth/dt.in.th) on GitHub Pages | Rendered from Supabase rows only. |

Note version = sha256 hex of the full source file (unchanged from legacy).

**Listed vs unlisted** (unchanged semantics): a published note reachable from `HomePage` via links through published notes is listed and gets static HTML, a tree/sitegraph/search-index entry and a sitemap line. A published note not reachable is unlisted: it has a row and search keys, but no static HTML; visiting it hits `404.html` and the client loads it through the `notes_get_contents` RPC.

## Shape

- Infra is this repo, shipped as a `notes` CLI (Q2).
- Distribution: a single bundled JS file (`bun build --target=bun`, `#!/usr/bin/env bun`) attached to GitHub Releases of this repo, with backoffice assets inlined. If something (e.g. shiki’s wasm) can’t be inlined, ship a tarball instead (Q25).
- The vault pins `notes` and `bun` in its `mise.toml`; its `pitchfork.toml` runs `notes serve` (Q25).
- Runs bare on the always-on VPS, not in a container, so Claude Code can work in the vault checkout directly. Dokploy’s Traefik is only the HTTPS proxy in front (Q1, Q21).
- Stack: Bun + Elysia, reusing the good parts of legacy `service/` (`NotesSource`, `MarkdownContent`, `indexNote`, `generatePublicTree`, `generateSitegraph`, the static-site tasks) (Q16).
- Vault index is in memory, rebuilt from files on start and on change; no local database (Q15).

## Publishing: plan / apply

Publishing is selective, per note (Q7). The server diffs desired state (vault) against actual state (Supabase rows) and produces a **plan**, Terraform-style (Q12):

- `+` **new**: `public: true` in the vault, no row.
- `~` **changed**: `public: true`, row exists, `row.source_version !== vault version`.
- `-` **unpublish**: row exists, and the vault note has `public: false`/no `public`, or the file is gone (deleted or renamed) (Q9, Q13). A rename shows up as `-` old and `+` new; the old slug is kept as an alias in the new note’s front matter.

**Apply** acts on one item or all of them:

- `+`/`~`: upsert the row with the vault source and `source_version`, compile with `@notes/compiler`, and store `compiled`, `compiled_source_version` and `compiled_compiler_version` (Q14).
- `-`: delete the row.
- Then recompute derived data from the **published rows**, not from the vault, so a published note never exposes an unpublished note’s title or links (Q8): search keys, `notes.tree.json`, `notes.sitegraph.json`, `notes.index.json`.
- Then schedule a static site rebuild (debounced: applying several items in a row gives one commit to dt.in.th) (Q10).

When the compiler version changes, every row is recompiled from its stored `source`. That is not a new snapshot from the vault (Q14).

Interfaces:

- CLI: `notes plan`, `notes apply [id…]`.
- Backoffice: the plan view, with “changed since publish” badges and an “apply all” action, which keeps the old all-at-once flow one click away (Q11).

## Static site

Same output as legacy `generate_static_site.ts`: `<slug>.html` and `<slug>.md` for listed notes, alias `.html` copies, `index.html` (HomePage), `404.html`, `api/{tree.json,sitemap.txt,sitegraph.json,index.json,recent.xml}`, client/runtime/compiler assets, `CNAME`, `.nojekyll` and `.well-known/matrix/client`. RSS is driven by `Recent.md` as today (Q27).

The dt.in.th clone lives in a state dir the server owns (`~/.local/state/notes/site`), not in the vault (Q20). The server commits with a stat-line message and pushes using the GitHub App.

## Vault sync

The server auto-commits vault changes after about 5 minutes idle, with a stat-line message like today, then `pull --rebase` and push using the GitHub App token. On conflict it stops auto-syncing and shows a banner in the backoffice; a human or agent fixes it by hand (Q5, Q19).

## Backoffice (v1)

Served by the same server. A Vue 3 + Vite SPA (Q6, Q17):

- list and search notes
- edit Markdown in CodeMirror; saves write the file
- live preview via `@notes/compiler` in the browser
- the plan view: publish status, apply one or all
- the vault sync status / conflict banner

Auth: the existing Supabase login (Google), checked against `SUPABASE_ADMIN_UID`, which then mints a short-lived JWT, same as legacy `/auth/supabase`.

## Private API (frontend contract, unchanged)

The new server keeps the exact endpoints the frontend’s private mode calls (Q3):

- `POST /auth/supabase` `{ supabaseAccessToken }` → `{ accessToken }` (HS256 JWT, issuer `https://notes.dt.in.th`, 1h)
- `GET /web/notes/:id` (Bearer) → `{ note, source }`

The backoffice and private API share one hostname (e.g. `notes-admin.dt.in.th`). At cutover, `notes_settings.privateUrl` is pointed at it (Q21).

## Supabase

No schema changes in v1 (Q22). Tables `notes_contents` (`id, source, source_version, compiled, compiled_source_version, compiled_compiler_version`) and `notes_search_keys` (`search_key, note_id`), bucket `notes-public`, RPC `notes_get_contents`, table `notes_settings`.

## Secrets

One GitHub App, installed on the vault repo and dtinth/dt.in.th, with contents read/write only. Its private key, the Supabase service key and `NOTES_API_KEY` live in a mise env file **outside** the vault, so agents working in the vault never see them (Q18).

## Testing

Plan/apply, tree, sitegraph and search keys are pure functions over (vault notes, published rows), unit-tested with `bun test`. Supabase, git and the filesystem sit behind small interfaces with in-memory fakes (Q24).

## Cutover

1. Run `notes plan` against live Supabase. It must show **zero changes**, which proves the new indexer and version hashing match legacy.
2. Point `notes_settings.privateUrl` at the new server; retire the old one.
3. `git merge -s ours main` into `next`, then fast-forward `main` to `next`, which keeps all history (Q26).

## Out of v1

The VS Code extension (dropped), image uploads, and agent features inside the backoffice; agents keep working on the vault directly (Q23).
