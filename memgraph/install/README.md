# Stand up the memgraph memory kit

This folder (`memgraph/`) is a self-contained, portable memory skill for
Claude, Codex, macOS/Linux, and Windows: the
canonical SQLite memory graph plus the CLI engine to create, read, and write it
with hybrid (semantic + keyword) recall. It ships next to
`project-memory-structure-instruction.md` — that file is the doctrine, this
folder is the tool. Nothing here is machine-specific until you run the steps
below; do them once per machine.

## Placement

Put this `memgraph/` folder at the root of the project that should have memory.
The wrapper finds the project's DB from the git root, `CLAUDE_PROJECT_DIR`,
`CODEX_PROJECT_DIR`, or the parent of `memgraph/`, and a repo-local hook or
`AGENTS.md` rule points at it with a relative path. `MEMGRAPH_DB` is not an
escape hatch to a shared/global DB: when supplied, it must still resolve to
`<target-repo>/.agent/memory.db` or every command fails.

## Two layers, different portability

- STORAGE — `<repo>/.agent/memory.db`. Plain SQLite; commit it to git, it moves
  between machines as-is. Binary — never write it from two machines at once.
- SEARCH — this skill's `venv/` + the native `sqlite-vec` extension in
  `vendor/` + `OPENAI_API_KEY`. Per-machine, rebuilt here on each machine, never
  committed. Add `venv/`, `vendor/*`, and `.env` to `.gitignore`.

## 0. Prerequisites

Python 3 and Git. Git is required by the document lifecycle (`ingest-docs` /
`verify-doc-index` index only committed bytes); infrastructure bootstrap and
typed-memory writes work before a Git repo exists. On Windows, built-in
Windows PowerShell 5.1 (`powershell.exe`) is enough; PowerShell 7 (`pwsh`) is
optional. Use the python.org Python build — it has loadable sqlite-extension
support that the Microsoft Store / some pyenv builds lack. Internet to PyPI +
OpenAI. Run the commands below from inside this `memgraph/` folder unless
noted.

## 1. venv + dependencies  (per machine, gitignored)

macOS / Linux:

    python3 -m venv venv
    ./venv/bin/python -m pip install --upgrade pip
    ./venv/bin/python -m pip install -r requirements.txt

Windows PowerShell:

    python -m venv venv
    venv\Scripts\python.exe -m pip install --upgrade pip
    venv\Scripts\python.exe -m pip install -r requirements.txt

## 2. Vendor the native sqlite-vec extension  (per machine, gitignored)

The wrapper auto-detects `vendor/vec0.<ext>`. `loadable_path()` may return the
path WITHOUT the extension — copy the real file.

macOS:

    mkdir -p vendor
    cp "$(./venv/bin/python -c 'import sqlite_vec; print(sqlite_vec.loadable_path())')" vendor/vec0.dylib

Linux: same, but name the copy `vendor/vec0.so`.

Windows PowerShell:

    New-Item -ItemType Directory -Force vendor | Out-Null
    $base = & venv\Scripts\python.exe -c "import sqlite_vec; print(sqlite_vec.loadable_path())"
    $src  = if (Test-Path "$base") { "$base" } elseif (Test-Path "$base.dll") { "$base.dll" } else { throw "vec0 not found near $base" }
    Copy-Item $src vendor\vec0.dll

## 3. OpenAI key -> the project's .env  (gitignored)

Put the key in the TARGET PROJECT's `.env` (the repo that holds
`.agent/memory.db`), not in this folder — the wrapper auto-loads `<repo>/.env`:

    OPENAI_API_KEY=sk-...

Without the key, `recall` and every embedding-write fail fast; only
`session-context` (pure SQL) works. There is no FTS fallback on a missing key.

## 4. Create the memory DB  (bootstrap — once per project)

    ./venv/bin/python scripts/bootstrap.py --target <repo>        # macOS / Linux
    venv\Scripts\python.exe scripts\bootstrap.py --target <repo>  # Windows

`<repo>` is the project root (use `.` if this folder sits at the root and you
run from there). It applies the canonical schema (24 tables + FTS5 +
sqlite-vec@512) into `<repo>/.agent/memory.db`. Refuses to clobber an existing
DB unless you pass `--force` (which backs up the old one first).

Bootstrap creates only the empty store. It does not create, look for, or index
any documents — a project with no `docs/` yet is a valid target, and the empty
memory is a healthy state.

## 5. Agent startup integration  (repo-local, so it travels)

Shared rule for every agent:

    If `.agent/memory.db` exists, run the wrapper's `session-context` command at
    session start and use the wrapper for all recall/write operations. Never
    call `scripts/*.py` directly.

For Claude, put the hook in the PROJECT's `.claude/settings.json` — NOT the
global machine config, or it will not move between machines. Use
`install/settings.snippet.json` for macOS/Linux or
`install/settings.snippet.windows.json` for Windows as the shape and point the
command at this wrapper:

- macOS / Linux: `memgraph/memgraph session-context`
- Windows built-in PowerShell: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 session-context`
- Windows PowerShell 7 if installed: `pwsh -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 session-context`
- Windows where Claude runs hooks under Git Bash can call the built-in shell:
  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 session-context`

For Codex, put the shared rule in project-local `AGENTS.md` under Startup
Discipline and run the same wrapper command at session start (or through any
available local hook). Keep `CLAUDE.md` as `@AGENTS.md` so Claude reads the same
runtime rule.

`session-context` is pure SQL, so startup works offline and before the key is set.

## 6. Verify  (through the wrapper — never scripts/*.py directly)

Infrastructure verification — works with an empty memory and no documents.
macOS / Linux (run from the project root):

    memgraph/memgraph session-context                        # pure SQL, no key
    memgraph/memgraph recall "<any phrase>"                  # needs key; must report "vector_leg": true

Zero recall hits on an empty memory is the healthy result, not a failure. Do
NOT write smoke/test records (such as a "kit live" claim) to prove the kit
works: typed memory is written only by real project events, and the empty
state is valid.

Document-index verification — as soon as the project has committed managed
documents (`docs/**/*.md`, `AGENTS.md`, `.agent/tasks/**/spec.md`). Note that
a freshly bootstrapped project that committed `AGENTS.md` already has a
one-document corpus, so run this right after the bootstrap commit:

    memgraph/memgraph ingest-docs
    memgraph/memgraph verify-doc-index

Both require Git and a clean managed corpus (uncommitted managed documents are
an error; `ingest-docs --dry-run` previews drafts and reports
`committable=false`). On a project with no documents `verify-doc-index`
reports `ok: true` with `corpus_empty: true` — the expected empty-corpus
result.

Windows: same commands via:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File memgraph/memgraph.ps1 <cmd>

`pwsh` is also fine if PowerShell 7 is installed. Then open a fresh Claude or
Codex session in the project and confirm session context is available. If not,
run the startup command by hand and read the error (PATH, shell,
`.claude/settings.json`, or `AGENTS.md`/hook wiring).

## Ships vs rebuilt

Ships in the archive: `SKILL.md`, wrappers (`memgraph`, `memgraph.ps1`),
`scripts/` (engine + `bootstrap.py`), `sql/schema.sql`, `queries/`,
`references/`, `requirements.txt`, `install/`. Rebuilt per machine and
gitignored: `venv/`, `vendor/*`, and the project's `.env`.

## Uninstall

Delete this `memgraph/` folder from the project. Each project's
`.agent/memory.db` is independent and untouched.
