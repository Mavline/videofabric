---
name: memgraph
description: >-
  Portable repo-local memory graph for Claude, Codex, macOS/Linux, and Windows
  — create (bootstrap), read, and write .agent/memory.db (SQLite + sqlite-vec +
  FTS5) with hybrid semantic+keyword recall. Self-contained kit: engine +
  bootstrap + cross-platform wrappers (bash + PowerShell). Use whenever a repo has
  .agent/memory.db, or to stand memory up in a new project. On session start
  load active policies/open runs/next allowed WF; recall before non-trivial
  work; write on architectural decisions, non-trivial bugs (gotchas), WF
  open/complete, run open/close, and every orchestration event. All recall and
  write paths go through the wrapper; never hand-craft INSERTs into
  objects/index_docs/memory_vec/embedding_meta.
---

# memgraph

## Purpose

Repo-local long-term memory lives in `<repo>/.agent/memory.db`. It unifies the legacy memory-bank prose into a structured graph:

- `objects` — polymorphic primary key (every policy, decision, claim, run, workflow_task, orchestration_event, review_gate, event, task, chunk, view, entity, generated_view has one `object_id`).
- Structured tables: `policies`, `runs`, `tranches`, `workflow_tasks`, `workflow_dependencies`, `tasks`, `entities`, `claims`, `decisions`, `events`, `relations`, `review_gates`, `orchestration_events`, `generated_views`, `chunks`, `sources`.
- `index_docs` — canonical projection used for both FTS and embeddings (`title`, `summary`, `body`, `tags`, `aliases`, `embedding_text`, `embedding_text_hash`).
- `memory_fts` — FTS5 keyword index over `index_docs`.
- `memory_vec` — sqlite-vec `FLOAT[512]` index; `rowid = object_id`.
- `embedding_meta` — per-object hash + model + dims + `embedded_at`.

Embedding provider is OpenAI `text-embedding-3-small` reduced to 512 dims (fixed in `meta` table). sqlite-vec `0.1.6` is the pinned loadable extension.

## Four independent processes

The kit runs four processes that must not be conflated:

1. **Infrastructure bootstrap** — `bootstrap.py` creates only the empty
   `.agent/memory.db` (schema + FTS + vector runtime); startup integration is
   wired per `install/README.md`. Documents are not required, nothing is
   indexed, and Git is not needed yet. An empty memory is a healthy state.
   The bootstrap commit that adds `AGENTS.md` is already a document-lifecycle
   event: run process 3 immediately after it, or the corpus stays
   infrastructure-complete but not document-synced.
2. **Typed memory writes** — `write-*` commands record real policies,
   decisions, claims, tasks, and events as they happen. Never write smoke or
   test records (no "kit live" claims); an empty typed memory is valid.
3. **Document index lifecycle** — every create/update/move/delete of a managed
   document finishes in the same work unit: commit the document, run
   `ingest-docs`, run `verify-doc-index`, commit the updated
   `.agent/memory.db`, push both commits. Production runs require Git and a
   clean managed corpus.
4. **Existing-repository backfill** — a one-time adoption procedure for a repo
   that already has documents: inventory the committed corpus, run a full
   `ingest-docs`, prove N-of-N coverage with `verify-doc-index`, spot-check
   semantic recall, rerun `ingest-docs` to prove idempotency (a no-op).
   Afterwards the project lives by process 3.

## Entrypoint

The only supported entrypoint is the wrapper next to this file. Put this folder
at `<repo>/memgraph/` and invoke it from the target repo, a Claude hook, a Codex
session, or a regular shell:

    <skill>/memgraph <command> [args]           # macOS / Linux
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File <skill>/memgraph.ps1 <command> [args]  # Windows built-in
    pwsh -NoProfile -ExecutionPolicy Bypass -File <skill>/memgraph.ps1 <command> [args]             # Windows PowerShell 7+

where `<skill>` is this folder (normally `memgraph/` at your project root). Both
wrappers handle venv activation, target-repo detection, the canonical
repo-local DB path,
the sqlite-vec extension path, `.env` loading, and PowerShell UTF-8. Direct
invocation of `scripts/memgraph.py` bypasses this setup and can fail with
`AttributeError: enable_load_extension` on systems where the default `python3`
is pyenv-managed (built without `--enable-loadable-sqlite-extensions`).

Never call `scripts/memgraph.py` or `scripts/embed.py` directly — they are
internal helpers invoked by the wrapper.

## Bootstrap a new project

For a project that has no `.agent/memory.db` yet, create one from the canonical
schema (24 tables + FTS5 + sqlite-vec@512) before any read/write:

    <skill>/venv/bin/python <skill>/scripts/bootstrap.py --target <repo>

Run once per project (`--force` overwrites, backing up the old DB first).
`bootstrap.py` only creates the store — it does NOT set up the venv, the `.env`
key, or agent startup integration; see `install/README.md` for the full stand-up.
It also does NOT create, look for, or index any documents: a project with no
`docs/` yet is a valid target, and `verify-doc-index` on that empty corpus
reports `ok: true` with `corpus_empty: true`. Do not write test records to
prove the store works.

## Hard constraints (exceptions only)

- Never insert into `objects`, `index_docs`, `memory_vec`, `embedding_meta` outside of the provided scripts. The four tables must stay in sync; the scripts do it transactionally.
- Never call a different embedding model or different dimensionality. `meta.embedding_model` and `meta.embedding_dimensions` are the only allowed values.
- Never write a row whose `embedding_text_hash` does not match `sha256(embedding_text)`. The verify phase checks this and will fail the next migration.
- Never touch `migration_log`, `chunks`, `sources` with hand-written SQL — those raw-layer tables are owned by the migration pipeline and the `ingest-docs` command.
- Never use timestamps from the model's own "today". Get UTC epoch from shell (`date -u +%s`) or from the helper, which uses `time.time()`.
- Never start a new WF when the current tranche has unresolved findings (policy `No Forward Progress With Open Tails`), and do not skip in the `workflow_tasks.sequence_no` space.
- Commit `.agent/memory.db` only when the target project's `AGENTS.md`/`.gitignore` explicitly tracks it as portable project memory. Never commit generated `.agent/` clutter, `.env`, `memgraph/venv/`, or `memgraph/vendor/`.

## Environment

The wrapper resolves defaults automatically and invokes from Claude, Codex, or a shell:
- `MEMGRAPH_DB` is derived from the git root, `CLAUDE_PROJECT_DIR`, `CODEX_PROJECT_DIR`, or the parent of `<repo>/memgraph/`. A supplied value must resolve to `<target-repo>/.agent/memory.db`; shared/global or cross-repo DB paths are rejected by every command.
- `SQLITE_VEC_PATH` defaults to the vendored `memgraph/vendor/vec0.<dylib|so|dll>`.
- `OPENAI_API_KEY` is auto-loaded from `<repo>/.env` if not already exported.

Only `OPENAI_API_KEY` is strictly required, and only for `recall` and embedding-bearing writes. Pure-SQL commands (`session-context`, `next-wf`, `next-run`, `policy`, `entity`, `timeline`) run without it. Any of the defaults above can be overridden by exporting the corresponding env var before invoking the wrapper.

## When to READ (triggers)

### Memory access

memgraph is the primary interface to project memory. Commands return full data 
by default — session context, recall hits, object bodies, timelines, evidence 
chunks are not truncated. Use the repo-local wrapper for every operation:
`memgraph/memgraph show <id>` for a specific object's full text,
`memgraph/memgraph recall "<query>"` for hybrid FTS+vector search, and
`memgraph/memgraph session-context` for current project state. On Windows, use
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 <command>`;
`pwsh` is an optional PowerShell 7 replacement, not a requirement.

Startup integration should run the same wrapper's `session-context`: Claude can
do this with a repo-local `.claude/settings.json` SessionStart hook; Codex
should carry the same rule in project-local `AGENTS.md` and run the wrapper at
session start or through any available local hook. When hook output exceeds an
inline limit, read the persisted output file rather than re-invoking the command.

Markdown files in `memory-bank/` are a historical archive from the
pre-migration era. They are preserved on disk for audit only and are
NOT updated during the normal working loop. `.agent/memory.db` is the
primary source for all live project memory (tranche state, runs, WF
tasks, policies, decisions, claims, events).

### Source conflicts

If wrapper `session-context` and any `memory-bank/*.md` file disagree
on a fact (e.g. tranche status is `open` in DB but `closed` in markdown
prose), the DB wins. Markdown represents pre-migration state only.

Report the conflict explicitly ("DB says X, markdown-archive says Y")
and update the DB through the appropriate `memgraph` write helper
(`close-tranche`, `close-run`, `wf-status`, `write-decision`,
`write-claim`, etc.). Do not silently merge and do not fall back on
markdown as authoritative.

1. **Session start.** Startup integration runs `memgraph/memgraph session-context` automatically on macOS/Linux or `powershell.exe -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 session-context` on Windows. No embedding call. Pure SQL projection of: active policies, open runs, top open WF, latest orchestration events, `project_overview` and `current_state` generated views. If startup integration is not installed, run it manually once per new session.
2. **Before any non-trivial task.** Run `memgraph/memgraph recall "<query>"` to hybrid-search (FTS5 + vector RRF). Triggers: "implement X", "fix Y", "refactor Z", "investigate bug", "why does … behave …", "is there a policy about …". One OpenAI embedding call (~$0.000003). Skip only for pure typo fixes, formatting-only diffs, or questions that can be answered from the current packet alone.
3. **On unclear code behavior.** Run `memgraph/memgraph recall "<symptom phrase>" --type claim,event,decision`. Surfaces prior `claim(gotcha|risk|observation)` and `event(bug|fix|incident)` entries.
4. **Before opening a new WF.** Run `memgraph/memgraph next-wf` to get the next valid `sequence_no` and the expected `wf_id` string. Pure SQL.
5. **Before opening a new run.** Run `memgraph/memgraph next-run` for the next `sequence_no` + `run_id` skeleton. Pure SQL.
6. **Policy lookup.** `memgraph/memgraph policy <name-fragment>` or `memgraph/memgraph recall "<topic>" --type policy`.
7. **Entity lookup.** `memgraph/memgraph entity <canonical-or-alias>` returns the entity record plus its active claims and recent events.
8. **Timeline / orchestration audit.** `memgraph/memgraph timeline --run <run_id>` or `--wf <wf_id>`.

The `recall` command returns up to 20 RRF-fused hits by default. Pass `--k <n>`
to choose a different final cap (bounded by sqlite-vec). A single call always
writes an access log line to stderr for budget visibility.

## When to WRITE (triggers)

Every write goes through `memgraph` which handles the transactional insert into `objects + <structured table> + index_docs + memory_vec + embedding_meta`.

1. **Architectural decision.** After deciding a non-trivial design point (library choice, schema shape, auth/DB policy amendment, review gate policy change, provider switch, API contract).
   - `memgraph write-decision --title "…" --summary "…" --decision "…" --rationale "…" --consequences "…" [--valid-from EPOCH] [--evidence-chunk OBJ_ID] [--relates-to OBJ_ID …]`
   - One embedding call for the composed `embedding_text`.
2. **Non-trivial bug / gotcha / invariant.** After catching a runtime trap that future sessions must know about (race, silent fallback, TCP keepalive quirk, pre-commit hook, env-var precedence).
   - `memgraph write-claim --type gotcha --statement "…" [--entity <canonical>] [--confidence 0.0..1.0] [--evidence-chunk OBJ_ID]`
   - Supported `--type`: `fact`, `requirement`, `constraint`, `assumption`, `rule`, `observation`, `gotcha`, `risk`, `status`.
3. **Entity discovery / alias.** New service, module, external system, or a newly learned alias for an existing one.
   - `memgraph write-entity --type module --name backend.api.operations --display "Operations API" --aliases '["ops-api","operations"]' --summary "…"`
   - `memgraph alias-entity --canonical <name> --add '["alt-name"]'` for a pure alias update (no new embedding if `embedding_text` unchanged; helper decides).
4. **New WF.** Before a task actually starts work.
   - `memgraph open-wf --title "…" --agent <role> --run <run_id_or_seq> --packet <path> --owned-files '["a","b"]' --forbidden '["c"]' --acceptance "…" --validation "…"`
   - Also emits a `task_assignment` orchestration_event.
5. **WF status transition.** On kickoff, in_progress, awaiting_review, findings, remediation, done, accepted, closed.
   - `memgraph wf-status --wf WF-1343 --status done --sha <commit_sha> [--note "…"]`
   - Also emits a corresponding `task_*` orchestration_event.
6. **Run lifecycle.** Run opened, closeout, accepted, stopped.
   - `memgraph open-run --title "…" --tranche <name>`
   - `memgraph close-run --run <run_id> --status closed_accepted --sha <commit_sha>`
7. **Review gate.** When a Claude-reviewer or Codex review pass finishes.
   - `memgraph write-review --wf WF-1343 --type claude_reviewer --verdict pass --findings 0 --summary "…"`
8. **Policy write.** Only when the repo is actually adopting a new/amended rule. Requires explicit user direction or an accepted tranche decision.
   - `memgraph write-policy --name "…" --scope orchestration --status active --effective-from EPOCH --source-file AGENTS.md --text "…"`
9. **Relation.** After any write above, optionally attach `--relates-to <source_object_id>` one or more times to record typed edges (`supersedes`, `implements`, `contradicts`, `depends_on`, `evidence_for`, `solves`, `caused_by`, `blocks`, `parent_of`, `about`, `mentions`, `relates_to`, `documents`, `changes`, `invalidates`).

All write helpers accept `--dry-run` which prints the computed `embedding_text`, its hash, the proposed row(s), and the exact SQL without touching the DB.

## Document ingestion (`ingest-docs`)

`memgraph ingest-docs [--paths ...] [--external-root <git-root>] [--dry-run]
[--no-prune]` chunks documents into the raw layer (`sources` + `chunks`) and
materializes each chunk into `index_docs` + `memory_fts` + `memory_vec`, making
document CONTENT retrievable by hybrid recall alongside typed records.

- Default scope: `docs/**/*.md`, `AGENTS.md`, `.agent/tasks/**/spec.md`;
  `CLAUDE.md` and `memgraph/**` are always excluded.
- Source classification: `AGENTS.md` gets `source_role='runtime_prompt'`,
  `docs/evidence/**` gets `evidence`, `docs/knowledge/**` gets `thematic_doc`
  (agent-curated topical knowledge; full `1.0` recall authority),
  the rest of `docs/**` gets `strategic_doc`, `.agent/tasks/**/spec.md` gets
  `task_spec`. Classification is derived state: ingest refreshes role/category
  even for unchanged files without re-embedding (a category change rewrites
  only the chunks' `index_docs.tags`; the FTS trigger syncs).
- Commit boundary: production `ingest-docs`/`verify-doc-index` require Git and
  a clean managed corpus relative to HEAD — modified, deleted, renamed, and
  untracked non-ignored managed files all block the run. `--dry-run` previews
  drafts (and works without Git) but reports `committable=false`. Untracked
  managed files matched by `.gitignore` are never indexed and are listed as
  `ignored_managed_paths`; a tracked file stays in the corpus even if an
  ignore rule later matches it.
- Symlinks are outside the reproducible corpus: Git commits the link, not the
  target bytes, so a managed path that is or crosses a symlink (even a clean
  tracked one) is never indexed — source identity is the lexical repo path,
  never a resolved target. Ingest and verify list such paths as
  `symlinked_managed_paths` (a symlinked directory is listed once, as the
  directory path); a symlink given explicitly to `--paths` is an error. The
  same rule filters tracked symlinks out of external-archive imports. Stored
  source keys keep their namespace lexically too: they are never resolved
  against the live disk, so a file later replaced by an outward symlink is
  still pruned and still fails verification instead of escaping both.
- Lifecycle: run the chain on every create/update/move/delete of a managed
  document, in the same work unit — commit the document, `ingest-docs`,
  `verify-doc-index`, commit the updated `.agent/memory.db`, push both
  commits.
- Chunking is structural: ATX-heading sections with a size cap (long sections
  split on paragraph boundaries); the heading breadcrumb lands in
  `chunks.heading_path`; `extraction_status='parsed_structural'`.
- Incremental: unchanged files are skipped by content hash; unchanged sections
  are reused without re-embedding; stale chunks are deleted — unless referenced
  as evidence, then kept but fully de-indexed
  (`extraction_status='ignored'`, no `index_docs`/FTS/vector/embedding-meta
  rows: an auditable tombstone).
- Chunks are sources, not knowledge: ingest never auto-creates claims or
  decisions. Typed records are still written manually after verification. A
  `thematic_doc` chunk is a search pointer into the document, never an
  approved decision; promotion is explicit (verify, then
  `write-claim`/`write-decision`).
- One memory per repo: every command dies when `MEMGRAPH_DB` points outside
  `<repo>/.agent/memory.db`. Normal `--paths` narrows the managed selection
  and never widens it: an explicit file outside the managed corpus (or outside
  the repo) is an error, and a directory expands only to its managed
  `**/*.md`. The Git commit boundary and the verifier cover exactly the
  managed corpus, so nothing ingestable can bypass them.
- Explicit owner-approved archive exception: `--external-root <git-root>`
  imports exactly that archive's git-tracked `*.md` files into the target
  repository's same DB. Source keys are absolute paths, `source_role` is
  `external_memory_archive`, and chunks remain low-authority evidence pointers;
  they never auto-create claims, decisions, policies, or workflow state. It is
  an import into one DB, not federation or a second memory. Tracked Markdown
  must be clean; the importer records the archive HEAD so the indexed bytes are
  reproducible.
- `memgraph verify-doc-index --external-root <git-root>` proves exact source
  coverage with no stale in-scope sources; current file, chunk, and actual
  embedding-text hashes; recorded archive revision; active chunk, FTS, vector,
  embedding-metadata, and model/dimension consistency. Recall chunk hits include
  explicit `source_path`, `source_role`, and `source_category` provenance. RRF
  scores from `external_memory_archive` chunks receive a visible `0.75`
  authority weight;
  their unmodified semantic score remains available as `raw_score`.
- Without `--external-root`, the verifier applies the same freshness/projection
  checks to the default repo document scope. Contract: an empty corpus is
  healthy (`ok: true`, `corpus_empty: true`); any leftover active, partially
  indexed, or unjustified managed source fails with its path in
  `unexpected_sources`; valid evidence tombstones (every chunk genuinely
  referenced, `ignored`, and fully de-indexed) are listed separately in
  `retained_evidence_sources`/`retained_evidence_chunks` and do not fail;
  an uncommitted managed corpus fails with its own `dirty_managed_paths` key,
  never disguised as a stale source. The audit covers every repo-relative
  source in the DB, not only managed paths: a repo source outside the managed
  corpus fails as unexpected regardless of its chunk state — no tombstone
  leniency.
- Run it per the document lifecycle above (after committing a created,
  updated, moved, or deleted document), or when recall misses content that is
  known to be committed. A no-change rerun is a no-op. Embedding is batched
  (`embed.py --batch`); a 40-file corpus costs on the order of $0.005.
- Recall results now include `chunk` hits — document sections whose
  `title`/`aliases` carry the source file path. Treat a chunk hit as a pointer
  into the committed document, not as a typed fact.

## Hybrid recall semantics

`memgraph recall "<query>"` executes Reciprocal Rank Fusion:

- Vector leg: sqlite-vec `MATCH vec_f32(<512-dim JSON>)` with `ORDER BY
  distance`; the candidate pool is `5 × --k` (100 candidates at the default
  `--k 20`), clamped by sqlite-vec.
- Lexical leg: FTS5 `memory_fts MATCH '<tokenized query>'` with `ORDER BY rank`
  and the same `5 × --k` candidate limit.
- Fusion: `raw_score = Σ 1/(60 + rank_i)` across both legs, grouped by
  `object_id`; external-memory archive chunks then use
  `score = raw_score × 0.75`, while project and typed records — including
  `thematic_doc` chunks — keep weight `1.0` (search score reflects relevance;
  normative status is carried by `source_role` and explicit promotion to typed
  records, not by ranking penalties).
- Final projection: `object_type`, `title`, full `summary`, `score`,
  `raw_score`, `authority_weight`, and provenance/structured-row pointers.
- Objects targeted by an active `invalidates` or `supersedes` edge are hidden
  from current recall and session-context views by default. Their rows and edges
  remain auditable through `show`; use `--include-invalidated` for historical
  recall, which adds `invalidated_by` object IDs.

Filters:

- `--type policy,decision,claim,event,workflow_task,run,review_gate,orchestration_event,entity,view,chunk`
- `--k <n>` (final result cap; default 20)
- `--include-invalidated` (historical/audit mode)

## Cost model

Each embedding API call is roughly `tokens × $0.02/1M` with `text-embedding-3-small`. A 30-token query costs ~$0.0000006; a 300-token decision-body write costs ~$0.000006. A typical working day (30 recalls + 5 writes) is on the order of 10^-5 USD.

Consequences: call `recall` freely before non-trivial work, do not batch it at end-of-task to "save calls". Session context is cheaper still — it is pure SQL, no API.

But: do not spam `recall` on every trivial message. A reasonable ceiling is one recall per distinct sub-problem in a session; more is wasteful, not expensive.

## Failure modes and recovery

- **`OPENAI_API_KEY` missing.** `memgraph recall` and every `write-*` with a new embedding fail fast. Pure-SQL commands (`session-context`, `next-wf`, `next-run`, `policy`, `timeline`, `open-runs`) still work.
- **`sqlite-vec` extension not loadable.** Vector leg is disabled; `recall` falls back to FTS-only with a stderr warning. Write paths still embed and insert into `memory_vec`; if the extension is missing at write time, the command aborts before any row is written.
- **DB locked.** SQLite is single-writer. Retry is handled inside `memgraph` with exponential backoff up to 3s. If it still fails, stop and report the blocker.
- **Hash mismatch on write.** Script recomputes `embedding_text_hash` and refuses to insert if the caller-provided hash disagrees. Do not override.
- **Duplicate insert.** `policies (source_file, effective_from, policy_name)`, `entities (entity_type, canonical_name)`, `runs (run_id)`, `workflow_tasks (wf_id)`, `generated_views (view_name)` are `UNIQUE`. Helpers detect and return the existing `object_id` instead of failing — useful when retrying.

## Output contract

Every `memgraph` subcommand:

- Prints a single JSON object to stdout on success: `{ "ok": true, "object_id": <int>, "type": "<object_type>", "wrote": { ... }, "cost_usd": <float|null> }` for writes; `{ "ok": true, "count": N, "hits": [...] }` for reads.
- Prints human-readable single-line progress to stderr.
- Exit code `0` on success, non-zero on error with `{ "ok": false, "error": "…", "where": "…" }` on stdout.

This is deliberately machine-readable so orchestrator agents can pipe results.

## See also

- `queries/*.md` — one file per SQL template, with the exact text, the parameters, and the expected shape. Read the one you need before composing anything custom.
- `references/schema.md` — compact schema cheat-sheet aligned with the current DB.
- `references/triggers.md` — decision tree for "should I recall?" and "should I write?".
- `references/object_types.md` — what each `object_type` means and which structured table it lives in.
- `references/cost.md` — per-call cost table and daily budget examples.
- `install/README.md` — how to install the skill and agent startup integration.
