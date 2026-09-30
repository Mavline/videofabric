#!/usr/bin/env python3
"""memgraph skill entrypoint.

Subcommands:
    session-context       Pure-SQL context for a fresh session (no API call).
    recall "<query>"      Hybrid FTS + vector recall (1 embedding call).
    show <object_id>      Full text of one object: typed row, body, evidence
                           chunk, every incoming + outgoing relation.
    next-wf               Next workflow_task.sequence_no + WF-<N>.
    next-run              Next run.sequence_no + run-<N>.
    policy <fragment>     List policies matching name fragment.
    entity <canonical>    Lookup entity by canonical_name or alias.
    timeline --run <id> | --wf <id>
    ingest-docs            Chunk + incrementally sync committed markdown docs
                           into sources/chunks/index_docs/memory_vec.
    verify-doc-index       Prove source/chunk/FTS/vector/embedding coverage.

    write-decision        Insert a decision object.
    write-claim           Insert a claim (gotcha/fact/...).
    write-entity          Insert a new entity (or return existing id).
    alias-entity          Add aliases to an existing entity.
    open-wf               Insert workflow_task + task_assignment event.
    wf-status             Update workflow_task.status and emit event.
    open-run              Insert a new run.
    close-run             Close a run with a verdict + SHA.
    write-review          Insert review_gate.
    write-policy          Insert a policy (retires older one if given).
    write-relation        Insert a typed edge into relations.

All writes are transactional across objects + structured-table + index_docs
+ memory_vec + embedding_meta, and emit JSON on stdout.

Env:
    OPENAI_API_KEY     required for recall and any write that creates a new embedding
    MEMGRAPH_DB        optional compatibility value; must resolve to
                       <target-repo>/.agent/memory.db
    SQLITE_VEC_PATH    optional; autodetected from skill's vendor/ dir if unset
"""
from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

MODEL = "text-embedding-3-small"
DIMENSIONS = 512
RRF_K = 60
DEFAULT_TOP_K = 20
MAX_SQLITE_VEC_K = 4095

PROJECT_OVERVIEW_VIEW_NAME = "project_overview"
CURRENT_STATE_VIEW_NAME = "current_state"
MAX_GENERATED_VIEW_EMBEDDING_CHARS = 4000

# ingest-docs: markdown chunking + batch embedding limits.
MAX_CHUNK_CHARS = 6000
MAX_EMBED_CHARS = 7000
MAX_EMBED_BATCH = 100
INGEST_ATX_RE = re.compile(r'^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$')
INGEST_FENCE_RE = re.compile(r'^ {0,3}(`{3,}|~{3,})')
INGEST_DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')

# ---------------------------------------------------------------------------
# Infrastructure


def die(msg: str, where: str = "", code: int = 1) -> None:
    json.dump({"ok": False, "error": msg, "where": where}, sys.stdout)
    sys.stdout.write("\n")
    sys.exit(code)


def log(msg: str) -> None:
    print(f"memgraph: {msg}", file=sys.stderr)


def git_root() -> Path:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
        )
        return Path(out.decode().strip())
    except Exception:
        return Path.cwd()


def target_repo_root() -> Path:
    """Return the target repository selected by the wrapper or current git root."""
    wrapped = os.environ.get("MEMGRAPH_REPO_ROOT")
    if wrapped:
        return Path(wrapped).expanduser().resolve()
    return git_root().resolve()


def resolve_db_path() -> Path:
    expected = (target_repo_root() / ".agent" / "memory.db").resolve()
    env = os.environ.get("MEMGRAPH_DB")
    if env:
        actual = Path(env).expanduser().resolve()
        if actual != expected:
            die(
                f"MEMGRAPH_DB must be the target repository memory {expected}; "
                f"resolved to {actual}",
                where="db-path",
                code=2,
            )
    return expected


def resolve_vec_path() -> Optional[Path]:
    env = os.environ.get("SQLITE_VEC_PATH")
    if env:
        p = Path(env).expanduser()
        return p if p.exists() else None
    here = Path(__file__).resolve().parent.parent
    for name in ("vec0.dylib", "vec0.so", "vec0.dll"):
        candidate = here / "vendor" / name
        if candidate.exists():
            return candidate
    return None


def connect(db_path: Path, need_vec: bool = False) -> sqlite3.Connection:
    if not db_path.exists():
        die(f"memory.db not found at {db_path}", where="connect", code=2)
    conn = sqlite3.connect(str(db_path), isolation_level=None, timeout=5.0)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 3000")
    if need_vec:
        vec_path = resolve_vec_path()
        if vec_path is None:
            log("warning: SQLITE_VEC_PATH not set and vendor/vec0 not found; vector ops disabled")
        else:
            try:
                conn.enable_load_extension(True)
                conn.load_extension(str(vec_path))
            except sqlite3.OperationalError as e:
                log(f"warning: failed to load sqlite-vec: {e}")
    return conn


def now_utc() -> int:
    return int(time.time())


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compose_embedding_text(parts: Sequence[Tuple[str, str]]) -> str:
    """Join (label, value) pairs into the canonical embedding_text.

    Same shape the migration pipeline uses: '<label>: <value>' per line,
    skipping empty values.
    """
    lines: List[str] = []
    for label, value in parts:
        v = (value or "").strip()
        if not v:
            continue
        lines.append(f"{label}: {v}")
    return "\n".join(lines)


def call_embed(text: str) -> List[float]:
    """Call the sibling embed.py script via subprocess so we keep concerns separate."""
    here = Path(__file__).resolve().parent
    embed_script = here / "embed.py"
    if not embed_script.exists():
        die("embed.py not found next to memgraph.py", where="call_embed", code=2)
    proc = subprocess.run(
        [sys.executable, str(embed_script)],
        input=text,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        die(
            f"embed.py failed: {proc.stderr.strip() or proc.stdout.strip()}",
            where="call_embed",
            code=1,
        )
    try:
        vec = json.loads(proc.stdout.strip())
    except json.JSONDecodeError as e:
        die(f"embed.py did not return JSON: {e}", where="call_embed", code=1)
    if not isinstance(vec, list) or len(vec) != DIMENSIONS:
        die(
            f"embed.py returned wrong shape (expected {DIMENSIONS} floats)",
            where="call_embed",
            code=1,
        )
    return vec


def call_embed_batch(texts: List[str]) -> List[List[float]]:
    """Call embed.py --batch in slices of <= MAX_EMBED_BATCH texts; concatenate in order.

    Keeps any single OpenAI call bounded (embed.py itself caps at 2048 items)
    while letting callers pass an arbitrarily long list for one file's worth
    of new chunks.
    """
    if not texts:
        return []
    here = Path(__file__).resolve().parent
    embed_script = here / "embed.py"
    if not embed_script.exists():
        die("embed.py not found next to memgraph.py", where="call_embed_batch", code=2)

    results: List[List[float]] = []
    for i in range(0, len(texts), MAX_EMBED_BATCH):
        slice_texts = texts[i : i + MAX_EMBED_BATCH]
        proc = subprocess.run(
            [sys.executable, str(embed_script), "--batch"],
            input=json.dumps(slice_texts, ensure_ascii=False),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            die(
                f"embed.py --batch failed: {proc.stderr.strip() or proc.stdout.strip()}",
                where="call_embed_batch",
                code=1,
            )
        try:
            vecs = json.loads(proc.stdout.strip())
        except json.JSONDecodeError as e:
            die(f"embed.py --batch did not return JSON: {e}", where="call_embed_batch", code=1)
        if not isinstance(vecs, list) or len(vecs) != len(slice_texts):
            got = len(vecs) if isinstance(vecs, list) else type(vecs).__name__
            die(
                f"embed.py --batch returned wrong shape (expected {len(slice_texts)} vectors, got {got})",
                where="call_embed_batch",
                code=1,
            )
        for v in vecs:
            if not isinstance(v, list) or len(v) != DIMENSIONS:
                die(
                    f"embed.py --batch returned wrong vector shape (expected {DIMENSIONS} floats)",
                    where="call_embed_batch",
                    code=1,
                )
        results.extend(vecs)
    return results


# ---------------------------------------------------------------------------
# Core insert: objects + index_docs + memory_vec + embedding_meta


def insert_object(conn: sqlite3.Connection, object_type: str, ts: int) -> int:
    cur = conn.execute(
        "INSERT INTO objects(object_type, created_at, updated_at) VALUES (?,?,?)",
        (object_type, ts, ts),
    )
    return int(cur.lastrowid)


def upsert_index_doc(
    conn: sqlite3.Connection,
    object_id: int,
    object_type: str,
    title: str,
    summary: str,
    body: str,
    tags: str,
    aliases: str,
    embedding_text: str,
    ts: int,
) -> str:
    etext_hash = sha256_text(embedding_text)
    conn.execute(
        """
        INSERT INTO index_docs (
            object_id, object_type, title, summary, body, tags, aliases,
            embedding_text, embedding_text_hash, indexed_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(object_id) DO UPDATE SET
            object_type = excluded.object_type,
            title = excluded.title,
            summary = excluded.summary,
            body = excluded.body,
            tags = excluded.tags,
            aliases = excluded.aliases,
            embedding_text = excluded.embedding_text,
            embedding_text_hash = excluded.embedding_text_hash,
            indexed_at = excluded.indexed_at
        """,
        (
            object_id,
            object_type,
            title,
            summary,
            body,
            tags,
            aliases,
            embedding_text,
            etext_hash,
            ts,
        ),
    )
    return etext_hash


def write_vector_and_meta(
    conn: sqlite3.Connection,
    object_id: int,
    vec: List[float],
    etext_hash: str,
    ts: int,
) -> None:
    # memory_vec is a vec0 virtual table; rowid must equal object_id.
    # vec0 does not honor INSERT OR REPLACE for existing rowids — explicit
    # DELETE-then-INSERT keeps re-materialization on object updates working.
    conn.execute("DELETE FROM memory_vec WHERE rowid = ?", (object_id,))
    conn.execute(
        "INSERT INTO memory_vec(rowid, embedding) VALUES (?, vec_f32(?))",
        (object_id, json.dumps(vec, separators=(",", ":"))),
    )
    conn.execute(
        """
        INSERT INTO embedding_meta(object_id, embedding_text_hash, model, dimensions, embedded_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(object_id) DO UPDATE SET
            embedding_text_hash = excluded.embedding_text_hash,
            model = excluded.model,
            dimensions = excluded.dimensions,
            embedded_at = excluded.embedded_at
        """,
        (object_id, etext_hash, MODEL, DIMENSIONS, ts),
    )


def materialize(
    conn: sqlite3.Connection,
    object_id: int,
    object_type: str,
    title: str,
    summary: str,
    body: str,
    tags: str,
    aliases: str,
    embedding_text: str,
    ts: int,
    *,
    skip_embedding: bool = False,
    precomputed_vec: Optional[List[float]] = None,
) -> str:
    """Insert/update index_docs + memory_vec + embedding_meta for an object."""
    etext_hash = upsert_index_doc(
        conn,
        object_id,
        object_type,
        title,
        summary,
        body,
        tags,
        aliases,
        embedding_text,
        ts,
    )
    if skip_embedding:
        return etext_hash
    vec = precomputed_vec if precomputed_vec is not None else call_embed(embedding_text)
    try:
        write_vector_and_meta(conn, object_id, vec, etext_hash, ts)
    except sqlite3.OperationalError as e:
        die(f"failed to write vector (sqlite-vec loaded?): {e}", where="materialize", code=1)
    return etext_hash


# ---------------------------------------------------------------------------
# Relations helper


def add_relation(
    conn: sqlite3.Connection,
    source_id: int,
    relation: str,
    target_id: int,
    *,
    evidence_chunk_id: Optional[int] = None,
    confidence: float = 1.0,
) -> None:
    ts = now_utc()
    conn.execute(
        """
        INSERT OR IGNORE INTO relations
            (source_object_id, relation, target_object_id, confidence,
             evidence_chunk_id, status, created_at)
        VALUES (?,?,?,?,?,'active',?)
        """,
        (source_id, relation, target_id, confidence, evidence_chunk_id, ts),
    )


# ---------------------------------------------------------------------------
# Generated views — re-render + re-materialize from source_query.
#
# `generated_views` rows are materialized snapshots ("current_state",
# "project_overview", ...). After the original migration nobody keeps them in
# sync with the typed tables, so the bottom of session-context can disagree
# with the top. These helpers re-execute each row's source_query, render the
# body deterministically (same shape as the migration produced, so idempotent
# re-runs report 0 refreshed), and re-materialize index_docs/FTS/vector when
# the body changes.


def _stringify_generated_view_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _escape_generated_view_cell(value: Any) -> str:
    return _stringify_generated_view_value(value).replace("|", "\\|").replace("\n", "<br>")


def _pretty_generated_view_column(name: str) -> str:
    mapping = {
        "k": "kind",
        "run_id": "id",
        "run_title": "title/run_title",
    }
    if name in mapping:
        return mapping[name]
    return name.replace("_", " ")


def _render_generic_generated_view(
    title: str,
    columns: Sequence[str],
    rows: Sequence[Dict[str, Any]],
) -> str:
    lines = [f"# {title}", ""]
    if not rows:
        lines.append("_No rows._")
        return "\n".join(lines)
    headers = [_pretty_generated_view_column(col) for col in columns]
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("|" + "|".join(["---"] * len(headers)) + "|")
    for row in rows:
        lines.append(
            "| "
            + " | ".join(_escape_generated_view_cell(row.get(col, "")) for col in columns)
            + " |"
        )
    return "\n".join(lines)


def _render_project_overview_generated_view(
    title: str,
    row: Dict[str, Any],
) -> str:
    lines = [
        f"# {title}",
        "",
        f"- Entities: **{_stringify_generated_view_value(row.get('entities_total', 0))}**",
        f"- Active claims: **{_stringify_generated_view_value(row.get('active_claims', 0))}**",
        f"- Active decisions: **{_stringify_generated_view_value(row.get('active_decisions', 0))}**",
        f"- Active policies: **{_stringify_generated_view_value(row.get('active_policies', 0))}**",
        (
            "- Workflow tasks: "
            f"**{_stringify_generated_view_value(row.get('wf_total', 0))}** across "
            f"**{_stringify_generated_view_value(row.get('runs_total', 0))}** runs in "
            f"**{_stringify_generated_view_value(row.get('tranches_total', 0))}** tranches"
        ),
        f"- Orchestration events: **{_stringify_generated_view_value(row.get('events_total', 0))}**",
    ]
    return "\n".join(lines)


def _render_current_state_generated_view(
    title: str,
    rows: Sequence[Dict[str, Any]],
) -> str:
    lines = [f"# {title}", ""]
    if not rows:
        lines.append("_No rows._")
        return "\n".join(lines)
    lines.append("| kind | id | title/run_title | status |")
    lines.append("|---|---|---|---|")
    for row in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    _escape_generated_view_cell(row.get("k", "")),
                    _escape_generated_view_cell(row.get("run_id", "")),
                    _escape_generated_view_cell(row.get("run_title", "")),
                    _escape_generated_view_cell(row.get("status", "")),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def render_generated_view_body(
    view_name: str,
    title: str,
    columns: Sequence[str],
    rows: Sequence[Dict[str, Any]],
) -> str:
    if view_name == PROJECT_OVERVIEW_VIEW_NAME and len(rows) == 1:
        return _render_project_overview_generated_view(title, rows[0])
    if view_name == CURRENT_STATE_VIEW_NAME:
        return _render_current_state_generated_view(title, rows)
    return _render_generic_generated_view(title, columns, rows)


def _generated_view_embedding_text(title: str, view_name: str, body: str) -> str:
    text = f"{title}\n{view_name}\n{body}"
    if len(text) <= MAX_GENERATED_VIEW_EMBEDDING_CHARS:
        return text
    return text[: MAX_GENERATED_VIEW_EMBEDDING_CHARS - 3] + "..."


def collect_generated_view_refresh_plan(
    conn: sqlite3.Connection,
    *,
    view_names: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT gv.object_id, gv.view_name, gv.title, gv.body, gv.generated_at, gv.source_query,
               COALESCE(id.summary, gv.view_name), COALESCE(id.tags, 'view ' || gv.view_name),
               COALESCE(id.aliases, '')
        FROM generated_views gv
        LEFT JOIN index_docs id ON id.object_id = gv.object_id
        ORDER BY gv.view_name
        """
    ).fetchall()
    requested = {name.strip() for name in (view_names or []) if (name or "").strip()}
    available = {str(row[1]) for row in rows}
    missing = sorted(requested - available)
    if missing:
        die(
            f"generated_view(s) not found: {', '.join(missing)}",
            where="refresh-views",
            code=2,
        )

    plan: List[Dict[str, Any]] = []
    for row in rows:
        object_id, view_name, title, current_body, generated_at, source_query, summary, tags, aliases = row
        if requested and view_name not in requested:
            continue
        if not (source_query or "").strip():
            raise ValueError(f"generated_view '{view_name}' has empty source_query")
        try:
            cursor = conn.execute(source_query)
        except sqlite3.Error as exc:
            raise ValueError(
                f"failed to execute source_query for generated_view '{view_name}': {exc}"
            ) from exc
        columns = [desc[0] for desc in (cursor.description or [])]
        result_rows = [dict(zip(columns, result_row)) for result_row in cursor.fetchall()]
        new_body = render_generated_view_body(view_name, title, columns, result_rows)
        plan.append(
            {
                "object_id": int(object_id),
                "view_name": str(view_name),
                "title": str(title),
                "summary": str(summary or view_name),
                "tags": str(tags or f"view {view_name}"),
                "aliases": str(aliases or ""),
                "generated_at": int(generated_at),
                "row_count": len(result_rows),
                "body_length": len(current_body or ""),
                "new_body_length": len(new_body),
                "changed": new_body != (current_body or ""),
                "new_body": new_body,
            }
        )
    return plan


def apply_generated_view_refresh_plan(
    conn: sqlite3.Connection,
    plan: Sequence[Dict[str, Any]],
    ts: int,
) -> List[Dict[str, Any]]:
    refreshed: List[Dict[str, Any]] = []
    for item in plan:
        if not item["changed"]:
            continue
        object_id = int(item["object_id"])
        view_name = str(item["view_name"])
        title = str(item["title"])
        new_body = str(item["new_body"])
        conn.execute(
            "UPDATE generated_views SET body=?, generated_at=? WHERE object_id=?",
            (new_body, ts, object_id),
        )
        conn.execute("UPDATE objects SET updated_at=? WHERE id=?", (ts, object_id))
        materialize(
            conn,
            object_id,
            "generated_view",
            title=title,
            summary=str(item["summary"]),
            body=new_body,
            tags=str(item["tags"]),
            aliases=str(item["aliases"]),
            embedding_text=_generated_view_embedding_text(title, view_name, new_body),
            ts=ts,
        )
        refreshed.append(
            {
                "view_name": view_name,
                "object_id": object_id,
                "row_count": int(item["row_count"]),
                "generated_at_before": int(item["generated_at"]),
                "generated_at_after": ts,
                "body_length_before": int(item["body_length"]),
                "body_length_after": int(item["new_body_length"]),
            }
        )
    return refreshed


def refresh_generated_views(
    db_path: Path,
    *,
    view_names: Optional[Sequence[str]] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    read_conn = connect(db_path, need_vec=False)
    try:
        plan = collect_generated_view_refresh_plan(read_conn, view_names=view_names)
    finally:
        read_conn.close()

    changed = [item for item in plan if item["changed"]]
    result = {
        "ok": True,
        "dry_run": dry_run,
        "count": len(plan),
        "refreshed": len(changed),
        "views": [
            {
                "view_name": item["view_name"],
                "object_id": item["object_id"],
                "changed": item["changed"],
                "row_count": item["row_count"],
                "generated_at_before": item["generated_at"],
                "body_length_before": item["body_length"],
                "body_length_after": item["new_body_length"],
            }
            for item in plan
        ],
    }
    if dry_run or not changed:
        return result

    ts = now_utc()
    write_conn = connect(db_path, need_vec=True)
    try:
        write_conn.execute("BEGIN IMMEDIATE")
        refreshed = apply_generated_view_refresh_plan(write_conn, changed, ts)
        write_conn.execute("COMMIT")
    except BaseException:
        try:
            write_conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        write_conn.close()
    refreshed_by_name = {item["view_name"]: item for item in refreshed}
    for view in result["views"]:
        applied = refreshed_by_name.get(view["view_name"])
        if applied:
            view.update(
                {
                    "generated_at_after": applied["generated_at_after"],
                    "body_length_after": applied["body_length_after"],
                }
            )
    return result


def cmd_refresh_views(args: argparse.Namespace) -> None:
    if not args.all and not args.view:
        die(
            "refresh-views requires --all or at least one --view NAME",
            where="refresh-views",
            code=2,
        )
    result = refresh_generated_views(
        resolve_db_path(),
        view_names=None if args.all else args.view,
        dry_run=args.dry_run,
    )
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


# ---------------------------------------------------------------------------
# Read commands


def cmd_session_context(args: argparse.Namespace) -> None:
    db_path = resolve_db_path()
    try:
        refresh_generated_views(db_path, dry_run=False)
    except (Exception, SystemExit) as exc:
        log(f"warning: refresh-views --all failed; continuing with stale generated_views: {exc}")
    conn = connect(db_path, need_vec=False)
    data: Dict[str, Any] = {}

    data["meta"] = dict(conn.execute("SELECT key, value FROM meta").fetchall())

    data["active_policies"] = [
        dict(zip(["policy_name", "scope", "status", "effective_from", "source_file"], row))
        for row in conn.execute(
            """
            SELECT policy_name, scope, status, effective_from, source_file
            FROM policies
            WHERE status IN ('active','locked')
            ORDER BY effective_from DESC, id DESC
            """
        )
    ]

    data["open_runs"] = [
        dict(
            zip(
                ["run_id", "sequence_no", "status", "run_title", "tranche", "opened_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT r.run_id, r.sequence_no, r.status, r.run_title,
                   COALESCE(t.tranche_name,''), r.opened_at
            FROM runs r LEFT JOIN tranches t ON t.id = r.tranche_id
            WHERE r.status IN ('planned','open','in_progress','awaiting_review','paused')
            ORDER BY r.sequence_no DESC
            """
        )
    ]

    next_wf_row = conn.execute(
        "SELECT COALESCE(MAX(sequence_no),0)+1 FROM workflow_tasks"
    ).fetchone()
    next_wf = next_wf_row[0] if next_wf_row else 1
    data["next_wf"] = {"sequence_no": next_wf, "wf_id": f"WF-{next_wf}"}

    data["active_tranches"] = [
        dict(zip(["tranche_name", "milestone", "phase", "status"], row))
        for row in conn.execute(
            """
            SELECT tranche_name, milestone, phase, status
            FROM tranches
            WHERE status IN ('planned','open')
            ORDER BY opened_at DESC
            """
        )
    ]

    data["recent_orchestration"] = [
        dict(zip(["event_type", "happened_at", "wf_id", "run_id", "agent_role", "details"], row))
        for row in conn.execute(
            """
            SELECT oe.event_type, oe.happened_at, wt.wf_id, r.run_id,
                   oe.agent_role, oe.details
            FROM orchestration_events oe
            LEFT JOIN workflow_tasks wt ON wt.id = oe.task_id
            LEFT JOIN runs r ON r.id = oe.run_id
            ORDER BY oe.happened_at DESC
            """
        )
    ]

    data["top_open_wf"] = [
        dict(zip(["wf_id", "sequence_no", "status", "agent_role", "title"], row))
        for row in conn.execute(
            """
            SELECT wf_id, sequence_no, status, agent_role, title
            FROM workflow_tasks
            WHERE status IN ('planned','pending','queued','assigned','kickoff',
                             'in_progress','awaiting_review','verification',
                             'reviewed_with_findings','findings','blocked',
                             'blocked_for_remediation','remediation','paused',
                             'stalled_no_artifact')
            ORDER BY sequence_no ASC
            """
        )
    ]

    # -------------------------------------------------------------------
    # OPERATIONAL LAYER — tranche / run narrative.
    # This layer is where closeout narrative ("M5.R2 accepted",
    # "integrated send deferred", "canonical runtime = …") actually lives
    # after migration. Must be surfaced BEFORE knowledge-layer blocks so
    # "what's active now" can be answered without opening markdown.
    # -------------------------------------------------------------------

    # Block: recent tranche-level events in the last 14 days — full
    # details + next_action verbatim. run_id FK on these rows is often
    # NULL in the migrated snapshot, so we don't force a runs join and
    # instead expose tranche_name when tranche_id is wired.
    data["recent_tranche_events"] = [
        dict(
            zip(
                ["event_type", "happened_at", "tranche_name", "agent_role",
                 "details", "next_action"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT oe.event_type,
                   oe.happened_at,
                   COALESCE(t.tranche_name,''),
                   COALESCE(oe.agent_role,''),
                   oe.details,
                   oe.next_action
            FROM orchestration_events oe
            LEFT JOIN tranches t ON t.id = oe.tranche_id
            WHERE oe.event_type IN (
                    'tranche_closed','tranche_boundary_set',
                    'run_accept','run_acceptance','run_closeout','closeout'
                  )
              AND oe.happened_at >= unixepoch('now','-14 days')
            ORDER BY oe.happened_at DESC
            """
        )
    ]

    # Block: current tranche narrative — scope + deferred_to_next whole.
    data["current_tranches"] = [
        dict(
            zip(
                ["tranche_name", "milestone", "phase", "status",
                 "scope", "deferred_to_next", "opened_at", "closed_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT tranche_name, milestone, phase, status,
                   scope, deferred_to_next, opened_at, closed_at
            FROM tranches
            WHERE status IN ('open','accepted')
            ORDER BY opened_at DESC
            """
        )
    ]

    # Block: recent run closeouts — last 5 runs in a closed state,
    # using runs.boundary_decision (which already contains the per-run
    # goal/scope/exit narrative) plus the matching run_accept/closeout
    # event text if present.
    data["recent_run_closeouts"] = []
    for row in conn.execute(
        """
        SELECT r.run_id, r.sequence_no, r.run_title, r.status,
               r.closed_at, r.boundary_decision,
               COALESCE(t.tranche_name,'')
        FROM runs r
        LEFT JOIN tranches t ON t.id = r.tranche_id
        WHERE r.status IN ('closed_accepted','closed_rejected','stopped')
        ORDER BY COALESCE(r.closed_at, r.opened_at) DESC
        LIMIT 5
        """
    ):
        run_id, seq, title, status, closed_at, boundary_decision, tranche = row
        evt = conn.execute(
            """
            SELECT event_type, happened_at, details, next_action
            FROM orchestration_events
            WHERE run_id = (SELECT id FROM runs WHERE run_id = ?)
              AND event_type IN (
                'run_accept','run_acceptance','run_closeout','closeout'
              )
            ORDER BY happened_at DESC
            LIMIT 1
            """,
            (run_id,),
        ).fetchone()
        data["recent_run_closeouts"].append({
            "run_id": run_id,
            "sequence_no": seq,
            "run_title": title,
            "status": status,
            "closed_at": closed_at,
            "tranche_name": tranche,
            "boundary_decision": boundary_decision,
            "latest_event": (
                dict(zip(
                    ["event_type", "happened_at", "details", "next_action"],
                    evt,
                )) if evt else None
            ),
        })

    # Block: deferred items — every tranche_boundary_set event plus any
    # event whose details or next_action mentions deferred/next-tranche
    # language. Full text, no truncation.
    data["deferred_items"] = [
        dict(
            zip(
                ["event_type", "happened_at", "tranche_name",
                 "details", "next_action"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT oe.event_type,
                   oe.happened_at,
                   COALESCE(t.tranche_name,''),
                   oe.details,
                   oe.next_action
            FROM orchestration_events oe
            LEFT JOIN tranches t ON t.id = oe.tranche_id
            WHERE oe.event_type = 'tranche_boundary_set'
               OR LOWER(oe.details) LIKE '%deferred%'
               OR LOWER(oe.details) LIKE '%next tranche%'
               OR LOWER(oe.details) LIKE '%integrated send%'
               OR LOWER(oe.next_action) LIKE '%deferred%'
               OR LOWER(oe.next_action) LIKE '%next tranche%'
               OR LOWER(oe.next_action) LIKE '%integrated send%'
            ORDER BY oe.happened_at DESC
            LIMIT 20
            """
        )
    ]

    # -------------------------------------------------------------------
    # KNOWLEDGE LAYER — decisions, baseline claims, risks. These augment
    # the operational layer; they are not a substitute for it.
    # -------------------------------------------------------------------

    # Block: recent adopted decisions (narrative of what was decided).
    # Schema CHECK allows status IN proposed/active/superseded/invalidated/rejected/archived.
    # 'accepted' is kept in the IN-list for forward-compat even though no row carries it today.
    data["recent_decisions"] = [
        dict(
            zip(
                ["decision_id", "title", "summary", "rationale", "consequences",
                 "status", "decided_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT d.id,
                   d.title,
                   d.summary,
                   d.rationale,
                   d.consequences,
                   d.status,
                   COALESCE(d.decided_at, d.updated_at)
            FROM decisions d
            WHERE d.status IN ('active','accepted')
              AND NOT EXISTS (
                SELECT 1 FROM relations inv
                WHERE inv.target_object_id = d.object_id
                  AND inv.relation IN ('invalidates','supersedes')
                  AND inv.status = 'active'
              )
            ORDER BY COALESCE(d.decided_at, d.updated_at) DESC, d.id DESC
            LIMIT 7
            """
        )
    ]

    # Block: current baseline — active claims (fact|status|rule) about
    # system|project entities via 'about' relation. This is the "what is true
    # about the project right now" layer.
    data["current_baseline"] = [
        dict(
            zip(
                ["claim_type", "statement", "entity", "entity_type",
                 "confidence", "recorded_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT c.claim_type,
                   c.statement,
                   e.display_name,
                   e.entity_type,
                   c.confidence,
                   c.recorded_at
            FROM claims c
            JOIN relations r
              ON r.source_object_id = c.object_id
             AND r.relation = 'about'
             AND r.status = 'active'
            JOIN entities e
              ON e.object_id = r.target_object_id
            WHERE c.status = 'active'
              AND c.claim_type IN ('fact','status','rule')
              AND e.entity_type IN ('system','project')
              AND NOT EXISTS (
                SELECT 1 FROM relations inv
                WHERE inv.target_object_id = c.object_id
                  AND inv.relation IN ('invalidates','supersedes')
                  AND inv.status = 'active'
              )
            ORDER BY c.recorded_at DESC, c.id DESC
            """
        )
    ]

    # Block: deferred / next candidates — status-claims that signal what is
    # explicitly parked or queued, plus proposed (not-yet-adopted) decisions.
    data["deferred_next"] = {
        "claims": [
            dict(zip(["statement", "confidence", "recorded_at"], row))
            for row in conn.execute(
                """
                SELECT statement, confidence, recorded_at
                FROM claims
                WHERE status = 'active'
                  AND claim_type = 'status'
                  AND NOT EXISTS (
                    SELECT 1 FROM relations inv
                    WHERE inv.target_object_id = claims.object_id
                      AND inv.relation IN ('invalidates','supersedes')
                      AND inv.status = 'active'
                  )
                  AND (statement LIKE '%deferred%'
                       OR statement LIKE '%next tranche%'
                       OR statement LIKE '%next phase%'
                       OR statement LIKE '%next candidate%')
                ORDER BY recorded_at DESC
                """
            )
        ],
        "proposed_decisions": [
            dict(zip(["decision_id", "title", "summary", "rationale",
                      "consequences", "decided_at"], row))
            for row in conn.execute(
                """
                SELECT id, title, summary, rationale, consequences,
                       COALESCE(decided_at, updated_at)
                FROM decisions
                WHERE status = 'proposed'
                  AND NOT EXISTS (
                    SELECT 1 FROM relations inv
                    WHERE inv.target_object_id = decisions.object_id
                      AND inv.relation IN ('invalidates','supersedes')
                      AND inv.status = 'active'
                  )
                ORDER BY COALESCE(decided_at, updated_at) DESC, id DESC
                """
            )
        ],
    }

    # Block: recent blockers — active risk-claims recorded in the last 14 days.
    data["recent_blockers"] = [
        dict(
            zip(
                ["statement", "confidence", "recorded_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT statement, confidence, recorded_at
            FROM claims
            WHERE status = 'active'
              AND claim_type = 'risk'
              AND NOT EXISTS (
                SELECT 1 FROM relations inv
                WHERE inv.target_object_id = claims.object_id
                  AND inv.relation IN ('invalidates','supersedes')
                  AND inv.status = 'active'
              )
              AND recorded_at >= unixepoch('now','-14 days')
            ORDER BY recorded_at DESC
            """
        )
    ]

    data["views"] = {}
    for name in ("project_overview", "current_state"):
        row = conn.execute(
            "SELECT title, body FROM generated_views WHERE view_name=?",
            (name,),
        ).fetchone()
        if row:
            data["views"][name] = {"title": row[0], "body": row[1]}

    if args.format == "json":
        json.dump({"ok": True, "context": data}, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return

    # Compact text format (default) — suitable for agent startup integration.
    out: List[str] = []
    out.append("=== memgraph session context ===")
    out.append(
        f"db: {resolve_db_path()} | "
        f"embed: {data['meta'].get('embedding_model')}({data['meta'].get('embedding_dimensions')})"
    )
    out.append("")
    out.append(f"Active policies ({len(data['active_policies'])}):")
    for p in data["active_policies"]:
        out.append(f"  - [{p['status']}] {p['policy_name']} ({p['scope']})")
    out.append("")
    out.append(f"Open runs ({len(data['open_runs'])}):")
    for r in data["open_runs"]:
        out.append(f"  - {r['run_id']} seq={r['sequence_no']} {r['status']} tranche={r['tranche']}")
    out.append("")
    out.append(f"Next WF: {data['next_wf']['wf_id']} (sequence_no={data['next_wf']['sequence_no']})")
    out.append("")
    out.append("Active tranches:")
    for t in data["active_tranches"]:
        out.append(f"  - {t['tranche_name']} | {t['milestone']} | {t['phase']} | {t['status']}")
    out.append("")
    out.append("Top open WF:")
    for w in data["top_open_wf"]:
        out.append(f"  - {w['wf_id']} [{w['status']}] {w['agent_role']} :: {w['title']}")
    out.append("")
    out.append("Recent orchestration:")
    for e in data["recent_orchestration"]:
        out.append(
            f"  - {e['event_type']} ts={e['happened_at']} "
            f"wf={e['wf_id']} run={e['run_id']} {e['agent_role'] or ''}"
        )

    def _ts(epoch: Optional[int]) -> str:
        if not epoch:
            return "—"
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(epoch)))

    def _block(body: Optional[str], label: str) -> None:
        if not body:
            return
        out.append(f"    {label}:")
        for line in body.splitlines():
            out.append(f"      {line}")

    # --- operational layer -------------------------------------------------
    out.append("")
    out.append(f"Recent tranche events (14d, {len(data['recent_tranche_events'])}):")
    for e in data["recent_tranche_events"]:
        tranche = f" tranche={e['tranche_name']}" if e["tranche_name"] else ""
        agent = f" agent={e['agent_role']}" if e["agent_role"] else ""
        out.append(f"  - [{e['event_type']}] {_ts(e['happened_at'])}{tranche}{agent}")
        _block(e["details"], "details")
        _block(e["next_action"], "next_action")

    out.append("")
    out.append(f"Current tranches ({len(data['current_tranches'])}):")
    for t in data["current_tranches"]:
        out.append(
            f"  - {t['tranche_name']} [{t['status']}] "
            f"{t['milestone']}/{t['phase']} "
            f"(opened {_ts(t['opened_at'])}"
            + (f", closed {_ts(t['closed_at'])}" if t['closed_at'] else "")
            + ")"
        )
        _block(t["scope"], "scope")
        _block(t["deferred_to_next"], "deferred_to_next")

    out.append("")
    out.append(f"Recent run closeouts ({len(data['recent_run_closeouts'])}):")
    for r in data["recent_run_closeouts"]:
        tranche = f" tranche={r['tranche_name']}" if r["tranche_name"] else ""
        out.append(
            f"  - {r['run_id']} seq={r['sequence_no']} [{r['status']}] "
            f"closed {_ts(r['closed_at'])}{tranche}"
        )
        if r["run_title"]:
            out.append(f"      title: {r['run_title']}")
        _block(r["boundary_decision"], "boundary_decision")
        if r["latest_event"]:
            ev = r["latest_event"]
            out.append(
                f"      latest event: [{ev['event_type']}] "
                f"{_ts(ev['happened_at'])}"
            )
            _block(ev["details"], "  details")
            _block(ev["next_action"], "  next_action")

    out.append("")
    out.append(f"Deferred items ({len(data['deferred_items'])}):")
    for e in data["deferred_items"]:
        tranche = f" tranche={e['tranche_name']}" if e["tranche_name"] else ""
        out.append(f"  - [{e['event_type']}] {_ts(e['happened_at'])}{tranche}")
        _block(e["details"], "details")
        _block(e["next_action"], "next_action")

    # --- knowledge layer ---------------------------------------------------
    out.append("")
    out.append(f"Recent adopted decisions ({len(data['recent_decisions'])}):")
    for d in data["recent_decisions"]:
        out.append(
            f"  - #{d['decision_id']} [{d['status']}] {d['title']} "
            f"(decided {_ts(d['decided_at'])})"
        )
        if d["summary"]:
            out.append(f"      summary: {d['summary']}")
        if d["rationale"]:
            out.append(f"      rationale: {d['rationale']}")
        if d["consequences"]:
            out.append(f"      consequences: {d['consequences']}")

    out.append("")
    out.append(f"Current baseline ({len(data['current_baseline'])} claims):")
    for c in data["current_baseline"]:
        out.append(
            f"  - [{c['claim_type']}] {c['statement']} "
            f"({c['entity']} | {c['entity_type']})"
        )

    deferred_claims = data["deferred_next"]["claims"]
    proposed = data["deferred_next"]["proposed_decisions"]
    out.append("")
    out.append(
        f"Deferred / next candidates "
        f"(status-claims={len(deferred_claims)}, proposed-decisions={len(proposed)}):"
    )
    for c in deferred_claims:
        out.append(f"  - claim: {c['statement']}  [recorded {_ts(c['recorded_at'])}]")
    for d in proposed:
        out.append(
            f"  - proposed #{d['decision_id']}: {d['title']} "
            f"(since {_ts(d['decided_at'])})"
        )
        if d["summary"]:
            out.append(f"      summary: {d['summary']}")
        if d["rationale"]:
            out.append(f"      rationale: {d['rationale']}")
        if d["consequences"]:
            out.append(f"      consequences: {d['consequences']}")

    out.append("")
    out.append(f"Recent blockers (last 14d, {len(data['recent_blockers'])}):")
    for c in data["recent_blockers"]:
        out.append(
            f"  - risk: {c['statement']}  "
            f"(confidence={c['confidence']}, recorded {_ts(c['recorded_at'])})"
        )

    if "project_overview" in data["views"]:
        out.append("")
        out.append("--- project_overview ---")
        out.append(data["views"]["project_overview"]["body"])
    if "current_state" in data["views"]:
        out.append("")
        out.append("--- current_state ---")
        out.append(data["views"]["current_state"]["body"])
    out.append("=== end memgraph session context ===")
    print("\n".join(out))


def _recall_source_metadata(
    conn: sqlite3.Connection, object_ids: Sequence[int]
) -> Dict[int, Dict[str, str]]:
    """Resolve chunk object IDs to explicit provenance metadata for recall output."""
    if not object_ids:
        return {}
    placeholders = ",".join("?" * len(object_ids))
    rows = conn.execute(
        f"""
        SELECT c.object_id, s.path, s.source_role, s.source_category
        FROM chunks c
        JOIN sources s ON s.id = c.source_id
        WHERE c.object_id IN ({placeholders})
        """,
        list(object_ids),
    ).fetchall()
    return {
        int(object_id): {
            "source_path": str(path),
            "source_role": str(source_role),
            "source_category": str(source_category),
        }
        for object_id, path, source_role, source_category in rows
    }


def _recall_invalidation_sources(
    conn: sqlite3.Connection, object_ids: Sequence[int]
) -> Dict[int, List[int]]:
    """Resolve active invalidates/supersedes edges targeting recall candidates."""
    if not object_ids:
        return {}
    placeholders = ",".join("?" * len(object_ids))
    rows = conn.execute(
        f"""
        SELECT DISTINCT target_object_id, source_object_id
        FROM relations
        WHERE target_object_id IN ({placeholders})
          AND relation IN ('invalidates', 'supersedes')
          AND status='active'
        ORDER BY target_object_id, source_object_id
        """,
        list(object_ids),
    ).fetchall()
    result: Dict[int, List[int]] = {}
    for target_object_id, source_object_id in rows:
        result.setdefault(int(target_object_id), []).append(int(source_object_id))
    return result


def _rank_recall_scores(
    ordered_scores: Sequence[Tuple[int, float]],
    source_metadata: Dict[int, Dict[str, str]],
) -> List[Tuple[int, float, float, float]]:
    """Apply the project-source authority boundary after semantic fusion.

    External Codex-memory Markdown is a searchable provenance archive, not a
    project decision source. Its content remains discoverable, but it receives
    a visible, deterministic penalty so current repo evidence wins close ties.
    """
    ranked: List[Tuple[int, float, float, float]] = []
    for object_id, raw_score in ordered_scores:
        role = source_metadata.get(object_id, {}).get("source_role")
        authority_weight = 0.75 if role == "external_memory_archive" else 1.0
        ranked.append(
            (
                int(object_id),
                float(raw_score) * authority_weight,
                float(raw_score),
                authority_weight,
            )
        )
    return sorted(
        ranked,
        key=lambda row: (row[1], row[3], row[2]),
        reverse=True,
    )


def cmd_recall(args: argparse.Namespace) -> None:
    query = args.query
    if not query or not query.strip():
        die("empty query", where="recall", code=2)
    requested_top_k = max(1, int(args.k))
    top_k = min(requested_top_k, MAX_SQLITE_VEC_K)
    vector_k_requested = max(top_k * 5, top_k)
    vector_k = min(vector_k_requested, MAX_SQLITE_VEC_K)
    if top_k != requested_top_k:
        log(
            "recall: --k clamped "
            f"from {requested_top_k} to {top_k} "
            f"(sqlite-vec limit is {MAX_SQLITE_VEC_K + 1})"
        )
    elif vector_k != vector_k_requested:
        log(
            "recall: vector k clamped "
            f"from {vector_k_requested} to {vector_k} "
            f"(requested --k {top_k}; sqlite-vec limit is {MAX_SQLITE_VEC_K + 1})"
        )

    conn = connect(resolve_db_path(), need_vec=True)

    # Vector leg
    vec_rows: List[Tuple[int, float]] = []
    vec_enabled = True
    try:
        vec = call_embed(query)
        vec_json = json.dumps(vec, separators=(",", ":"))
        try:
            vec_rows = [
                (int(r[0]), float(r[1]))
                for r in conn.execute(
                    """
                    SELECT rowid, distance
                    FROM memory_vec
                    WHERE embedding MATCH vec_f32(?) AND k = ?
                    ORDER BY distance
                    """,
                    (vec_json, vector_k),
                )
            ]
        except sqlite3.OperationalError as e:
            log(f"vector leg disabled after k={vector_k}: {e}")
            vec_enabled = False
    except SystemExit:
        raise

    # Lexical leg
    def escape_fts(q: str) -> str:
        toks = [t for t in q.replace('"', " ").split() if t]
        if not toks:
            return '""'
        return " OR ".join(f'"{t}"' for t in toks)

    fts_query = escape_fts(query)
    fts_rows: List[Tuple[int, float]] = []
    try:
        fts_rows = [
            (int(r[0]), float(r[1]))
            for r in conn.execute(
                """
                SELECT rowid, rank
                FROM memory_fts
                WHERE memory_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, top_k * 5),
            )
        ]
    except sqlite3.OperationalError as e:
        log(f"fts leg failed: {e}")

    # RRF fusion
    score: Dict[int, float] = {}
    for rank, (oid, _) in enumerate(vec_rows, start=1):
        score[oid] = score.get(oid, 0.0) + 1.0 / (RRF_K + rank)
    for rank, (oid, _) in enumerate(fts_rows, start=1):
        score[oid] = score.get(oid, 0.0) + 1.0 / (RRF_K + rank)

    if not score:
        json.dump(
            {
                "ok": True,
                "query": query,
                "vector_leg": vec_enabled,
                "count": 0,
                "hits": [],
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    ordered = sorted(score.items(), key=lambda kv: kv[1], reverse=True)
    ids = [oid for oid, _ in ordered]

    type_filter: Optional[List[str]] = None
    if args.type:
        type_filter = [t.strip() for t in args.type.split(",") if t.strip()]

    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(
        f"""
        SELECT object_id, object_type, title, summary, tags
        FROM index_docs
        WHERE object_id IN ({placeholders})
        """,
        ids,
    ).fetchall()
    by_id = {int(r[0]): r for r in rows}
    source_metadata = _recall_source_metadata(conn, ids)
    invalidation_sources = _recall_invalidation_sources(conn, ids)
    ranked_scores = _rank_recall_scores(ordered, source_metadata)

    hits: List[Dict[str, Any]] = []
    for oid, adjusted_score, raw_score, authority_weight in ranked_scores:
        if oid not in by_id:
            continue
        _, otype, title, summary, tags = by_id[oid]
        if type_filter and otype not in type_filter:
            continue
        if oid in invalidation_sources and not args.include_invalidated:
            continue
        hit = {
            "object_id": int(oid),
            "object_type": otype,
            "title": title,
            "summary": summary,
            "tags": tags,
            "score": round(float(adjusted_score), 6),
            "raw_score": round(float(raw_score), 6),
            "authority_weight": authority_weight,
        }
        if oid in source_metadata:
            hit.update(source_metadata[oid])
        if oid in invalidation_sources:
            hit["invalidated_by"] = invalidation_sources[oid]
        hits.append(hit)
        if len(hits) >= top_k:
            break

    json.dump(
        {
            "ok": True,
            "query": query,
            "vector_leg": vec_enabled,
            "top_k": top_k,
            "count": len(hits),
            "hits": hits,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.write("\n")


def cmd_next_wf(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path())
    n = conn.execute(
        "SELECT COALESCE(MAX(sequence_no),0)+1 FROM workflow_tasks"
    ).fetchone()[0]
    json.dump(
        {"ok": True, "sequence_no": int(n), "wf_id": f"WF-{int(n)}"},
        sys.stdout,
    )
    sys.stdout.write("\n")


def cmd_next_run(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path())
    n = conn.execute("SELECT COALESCE(MAX(sequence_no),0)+1 FROM runs").fetchone()[0]
    today = time.strftime("%Y-%m-%d", time.gmtime())
    json.dump(
        {
            "ok": True,
            "sequence_no": int(n),
            "run_id": f"run-{int(n):03d}_{today}",
            "run_date": today,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


def cmd_policy(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path())
    frag = f"%{args.fragment}%"
    rows = conn.execute(
        """
        SELECT policy_name, scope, status, effective_from, source_file,
               policy_text
        FROM policies
        WHERE policy_name LIKE ? OR policy_text LIKE ?
        ORDER BY effective_from DESC
        """,
        (frag, frag),
    ).fetchall()
    hits = [
        {
            "policy_name": r[0],
            "scope": r[1],
            "status": r[2],
            "effective_from": r[3],
            "source_file": r[4],
            "policy_text": r[5],
        }
        for r in rows
    ]
    json.dump({"ok": True, "count": len(hits), "hits": hits}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


def cmd_entity(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path())
    name = args.name.strip().lower()
    row = conn.execute(
        """
        SELECT id, object_id, entity_type, canonical_name, display_name,
               aliases_json, summary, status
        FROM entities
        WHERE LOWER(canonical_name) = ?
           OR EXISTS (
               SELECT 1 FROM json_each(aliases_json)
               WHERE LOWER(value) = ?
           )
        """,
        (name, name),
    ).fetchone()
    if not row:
        json.dump({"ok": True, "found": False}, sys.stdout)
        sys.stdout.write("\n")
        return
    (ent_id, object_id, etype, canonical, display, aliases, summary, status) = row
    claims = [
        dict(zip(["statement", "claim_type", "status", "confidence"], r))
        for r in conn.execute(
            """
            SELECT statement, claim_type, status, confidence
            FROM claims
            WHERE entity_object_id = ? AND status = 'active'
            ORDER BY recorded_at DESC
            """,
            (object_id,),
        )
    ]
    events = [
        dict(zip(["event_type", "title", "happened_at"], r))
        for r in conn.execute(
            """
            SELECT event_type, title, happened_at
            FROM events
            WHERE entity_object_id = ?
            ORDER BY happened_at DESC
            """,
            (object_id,),
        )
    ]
    json.dump(
        {
            "ok": True,
            "found": True,
            "entity": {
                "id": ent_id,
                "object_id": object_id,
                "entity_type": etype,
                "canonical_name": canonical,
                "display_name": display,
                "aliases": json.loads(aliases or "[]"),
                "summary": summary,
                "status": status,
            },
            "active_claims": claims,
            "recent_events": events,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.write("\n")


def cmd_timeline(args: argparse.Namespace) -> None:
    if not args.run and not args.wf:
        die("timeline requires --run or --wf", where="timeline", code=2)
    conn = connect(resolve_db_path())
    where = []
    params: List[Any] = []
    if args.run:
        where.append("r.run_id = ?")
        params.append(args.run)
    if args.wf:
        where.append("wt.wf_id = ?")
        params.append(args.wf)
    rows = conn.execute(
        f"""
        SELECT oe.happened_at, oe.event_type, wt.wf_id, r.run_id,
               oe.agent_role, oe.previous_pushed_sha,
               oe.details, oe.next_action,
               oe.source_file, oe.source_line
        FROM orchestration_events oe
        LEFT JOIN workflow_tasks wt ON wt.id = oe.task_id
        LEFT JOIN runs r ON r.id = oe.run_id
        WHERE {' AND '.join(where)}
        ORDER BY oe.happened_at ASC, oe.id ASC
        """,
        params,
    ).fetchall()
    hits = [
        dict(
            zip(
                [
                    "happened_at",
                    "event_type",
                    "wf_id",
                    "run_id",
                    "agent_role",
                    "previous_pushed_sha",
                    "details",
                    "next_action",
                    "source_file",
                    "source_line",
                ],
                r,
            )
        )
        for r in rows
    ]
    json.dump({"ok": True, "count": len(hits), "events": hits}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


TYPED_TABLE_BY_OBJECT_TYPE = {
    "policy": "policies",
    "decision": "decisions",
    "claim": "claims",
    "run": "runs",
    "tranche": "tranches",
    "workflow_task": "workflow_tasks",
    "orchestration_event": "orchestration_events",
    "review_gate": "review_gates",
    "entity": "entities",
    "event": "events",
    "task": "tasks",
    "generated_view": "generated_views",
    "chunk": "chunks",
    "source": "sources",
}


def _row_to_dict(conn: sqlite3.Connection, table: str, row: Tuple) -> Dict[str, Any]:
    cols = [c[1] for c in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return dict(zip(cols, row))


def cmd_show(args: argparse.Namespace) -> None:
    """Return the full, untruncated representation of one object.

    Includes: objects row, the typed structured-table row, index_docs body,
    the primary_evidence_chunk body (for claim/decision/workflow_task when
    set), and every relation touching the object (incoming + outgoing) with
    the peer's title and object_type.
    """
    conn = connect(resolve_db_path(), need_vec=False)
    try:
        obj_id = int(args.object_id)
    except (TypeError, ValueError):
        die(f"object_id must be an integer, got '{args.object_id}'", where="show", code=2)

    obj_row = conn.execute(
        "SELECT id, object_type, created_at, updated_at FROM objects WHERE id = ?",
        (obj_id,),
    ).fetchone()
    if not obj_row:
        die(f"object {obj_id} not found", where="show", code=2)

    object_type = obj_row[1]
    result: Dict[str, Any] = {
        "object_id": int(obj_row[0]),
        "object_type": object_type,
        "created_at": obj_row[2],
        "updated_at": obj_row[3],
    }

    typed_table = TYPED_TABLE_BY_OBJECT_TYPE.get(object_type)
    evidence_chunk_id: Optional[int] = None
    if typed_table:
        typed_row = conn.execute(
            f"SELECT * FROM {typed_table} WHERE object_id = ?",
            (obj_id,),
        ).fetchone()
        if typed_row is not None:
            typed_dict = _row_to_dict(conn, typed_table, typed_row)
            result["typed"] = typed_dict
            if typed_dict.get("primary_evidence_chunk_id"):
                try:
                    evidence_chunk_id = int(typed_dict["primary_evidence_chunk_id"])
                except (TypeError, ValueError):
                    evidence_chunk_id = None

    idx_row = conn.execute(
        """
        SELECT object_type, title, summary, body, tags, aliases,
               embedding_text, embedding_text_hash, indexed_at
        FROM index_docs WHERE object_id = ?
        """,
        (obj_id,),
    ).fetchone()
    if idx_row is not None:
        result["index_doc"] = dict(
            zip(
                [
                    "object_type", "title", "summary", "body", "tags",
                    "aliases", "embedding_text", "embedding_text_hash", "indexed_at",
                ],
                idx_row,
            )
        )

    if evidence_chunk_id is not None:
        chunk_row = conn.execute(
            """
            SELECT c.id, c.object_id, c.source_id, c.chunk_order, c.heading_path, c.body,
                   c.detected_date, c.extraction_status, c.content_hash, c.imported_at,
                   s.path, s.source_category, s.source_role
            FROM chunks c LEFT JOIN sources s ON s.id = c.source_id
            WHERE c.object_id = ?
            """,
            (evidence_chunk_id,),
        ).fetchone()
        if chunk_row is not None:
            result["primary_evidence_chunk"] = dict(
                zip(
                    [
                        "id", "object_id", "source_id", "chunk_order", "heading_path", "body",
                        "detected_date", "extraction_status", "content_hash", "imported_at",
                        "source_path", "source_type", "source_role",
                    ],
                    chunk_row,
                )
            )

    outgoing = [
        dict(
            zip(
                ["relation", "target_object_id", "target_object_type", "target_title",
                 "confidence", "status", "evidence_chunk_id", "created_at"],
                r,
            )
        )
        for r in conn.execute(
            """
            SELECT r.relation, r.target_object_id, o.object_type, i.title,
                   r.confidence, r.status, r.evidence_chunk_id, r.created_at
            FROM relations r
            LEFT JOIN objects o ON o.id = r.target_object_id
            LEFT JOIN index_docs i ON i.object_id = r.target_object_id
            WHERE r.source_object_id = ?
            ORDER BY r.created_at ASC, r.id ASC
            """,
            (obj_id,),
        )
    ]
    incoming = [
        dict(
            zip(
                ["relation", "source_object_id", "source_object_type", "source_title",
                 "confidence", "status", "evidence_chunk_id", "created_at"],
                r,
            )
        )
        for r in conn.execute(
            """
            SELECT r.relation, r.source_object_id, o.object_type, i.title,
                   r.confidence, r.status, r.evidence_chunk_id, r.created_at
            FROM relations r
            LEFT JOIN objects o ON o.id = r.source_object_id
            LEFT JOIN index_docs i ON i.object_id = r.source_object_id
            WHERE r.target_object_id = ?
            ORDER BY r.created_at ASC, r.id ASC
            """,
            (obj_id,),
        )
    ]
    result["relations"] = {"outgoing": outgoing, "incoming": incoming}

    json.dump({"ok": True, "object": result}, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


# ---------------------------------------------------------------------------
# Write commands


def cmd_write_decision(args: argparse.Namespace) -> None:
    ts = now_utc()
    title = args.title.strip()
    summary = args.summary.strip()
    decision = args.decision.strip()
    rationale = (args.rationale or "").strip()
    consequences = (args.consequences or "").strip()
    if not (title and summary and decision):
        die("write-decision requires --title, --summary, --decision", where="write-decision", code=2)

    embedding_text = compose_embedding_text(
        [
            ("Title", title),
            ("Summary", summary),
            ("Decision", decision),
            ("Rationale", rationale),
            ("Consequences", consequences),
        ]
    )

    if args.dry_run:
        json.dump(
            {
                "ok": True,
                "dry_run": True,
                "object_type": "decision",
                "embedding_text": embedding_text,
                "embedding_text_hash": sha256_text(embedding_text),
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    conn = connect(resolve_db_path(), need_vec=True)
    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "decision", ts)
        conn.execute(
            """
            INSERT INTO decisions(
                object_id, title, summary, decision_text, rationale, consequences,
                status, decided_at, valid_from, valid_until,
                primary_evidence_chunk_id, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                title,
                summary,
                decision,
                rationale,
                consequences,
                args.status,
                ts,
                args.valid_from or ts,
                args.valid_until,
                args.evidence_chunk,
                ts,
                ts,
            ),
        )
        materialize(
            conn,
            obj_id,
            "decision",
            title=title,
            summary=summary,
            body=decision + ("\n\nRationale:\n" + rationale if rationale else "")
                 + ("\n\nConsequences:\n" + consequences if consequences else ""),
            tags=args.tags or "",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        for rel_target in args.relates_to or []:
            add_relation(conn, obj_id, args.relation or "relates_to", int(rel_target))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "type": "decision"}, sys.stdout)
    sys.stdout.write("\n")


def cmd_write_claim(args: argparse.Namespace) -> None:
    ts = now_utc()
    statement = args.statement.strip()
    if not statement:
        die("write-claim requires --statement", where="write-claim", code=2)
    claim_type = args.type
    if claim_type not in {"fact", "requirement", "constraint", "assumption",
                          "rule", "observation", "gotcha", "risk", "status"}:
        die(f"invalid --type {claim_type}", where="write-claim", code=2)
    entity_object_id: Optional[int] = None
    if args.entity:
        conn_pre = connect(resolve_db_path())
        row = conn_pre.execute(
            "SELECT object_id FROM entities WHERE LOWER(canonical_name)=?",
            (args.entity.lower(),),
        ).fetchone()
        conn_pre.close()
        if row:
            entity_object_id = int(row[0])
        else:
            log(f"warning: entity '{args.entity}' not found; storing claim without entity link")

    title = f"[{claim_type}] {statement[:80]}"
    summary = statement
    body = statement
    embedding_text = compose_embedding_text(
        [
            ("ClaimType", claim_type),
            ("Statement", statement),
            ("Entity", args.entity or ""),
        ]
    )

    if args.dry_run:
        json.dump(
            {
                "ok": True,
                "dry_run": True,
                "object_type": "claim",
                "embedding_text": embedding_text,
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    conn = connect(resolve_db_path(), need_vec=True)
    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "claim", ts)
        conn.execute(
            """
            INSERT INTO claims(
                object_id, entity_object_id, claim_type, statement, normalized_statement,
                status, confidence, valid_from, valid_until, recorded_at,
                primary_evidence_chunk_id, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                entity_object_id,
                claim_type,
                statement,
                statement.lower(),
                args.status,
                args.confidence,
                args.valid_from or ts,
                args.valid_until,
                ts,
                args.evidence_chunk,
                ts,
                ts,
            ),
        )
        materialize(
            conn,
            obj_id,
            "claim",
            title=title,
            summary=summary,
            body=body,
            tags=claim_type + (f",entity:{args.entity}" if args.entity else ""),
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        for rel_target in args.relates_to or []:
            add_relation(conn, obj_id, args.relation or "about", int(rel_target))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "type": "claim"}, sys.stdout)
    sys.stdout.write("\n")


def cmd_write_entity(args: argparse.Namespace) -> None:
    ts = now_utc()
    canonical = args.name.strip()
    display = (args.display or canonical).strip()
    etype = args.type
    aliases = json.loads(args.aliases) if args.aliases else []
    if not isinstance(aliases, list):
        die("--aliases must be a JSON array", where="write-entity", code=2)
    summary = (args.summary or "").strip()

    conn = connect(resolve_db_path(), need_vec=True)
    existing = conn.execute(
        "SELECT id, object_id FROM entities WHERE entity_type=? AND canonical_name=?",
        (etype, canonical),
    ).fetchone()
    if existing:
        json.dump(
            {"ok": True, "existing": True, "id": existing[0], "object_id": existing[1]},
            sys.stdout,
        )
        sys.stdout.write("\n")
        return

    embedding_text = compose_embedding_text(
        [
            ("EntityType", etype),
            ("Name", canonical),
            ("Aliases", ", ".join(aliases)),
            ("Summary", summary),
        ]
    )
    if args.dry_run:
        json.dump(
            {"ok": True, "dry_run": True, "embedding_text": embedding_text},
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "entity", ts)
        conn.execute(
            """
            INSERT INTO entities(
                object_id, entity_type, canonical_name, display_name,
                aliases_json, summary, status, first_seen_at, last_seen_at,
                created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                etype,
                canonical,
                display,
                json.dumps(aliases, ensure_ascii=False),
                summary,
                "active",
                ts,
                ts,
                ts,
                ts,
            ),
        )
        materialize(
            conn,
            obj_id,
            "entity",
            title=display,
            summary=summary,
            body=summary,
            tags=etype,
            aliases=", ".join(aliases),
            embedding_text=embedding_text,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "type": "entity"}, sys.stdout)
    sys.stdout.write("\n")


def cmd_alias_entity(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)
    row = conn.execute(
        "SELECT id, object_id, aliases_json, canonical_name, display_name, entity_type, summary "
        "FROM entities WHERE canonical_name = ?",
        (args.canonical,),
    ).fetchone()
    if not row:
        die(f"entity '{args.canonical}' not found", where="alias-entity", code=2)
    ent_id, obj_id, aliases_json, canonical, display, etype, summary = row
    current = set(json.loads(aliases_json or "[]"))
    add_list = json.loads(args.add)
    if not isinstance(add_list, list):
        die("--add must be a JSON array", where="alias-entity", code=2)
    merged = sorted(current.union(add_list))
    if list(merged) == sorted(current):
        json.dump({"ok": True, "object_id": obj_id, "changed": False}, sys.stdout)
        sys.stdout.write("\n")
        return

    embedding_text = compose_embedding_text(
        [
            ("EntityType", etype),
            ("Name", canonical),
            ("Aliases", ", ".join(merged)),
            ("Summary", summary or ""),
        ]
    )
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE entities SET aliases_json=?, updated_at=?, last_seen_at=? WHERE id=?",
            (json.dumps(merged, ensure_ascii=False), ts, ts, ent_id),
        )
        materialize(
            conn,
            obj_id,
            "entity",
            title=display,
            summary=summary or "",
            body=summary or "",
            tags=etype,
            aliases=", ".join(merged),
            embedding_text=embedding_text,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "changed": True}, sys.stdout)
    sys.stdout.write("\n")


def _resolve_run_id_arg(conn: sqlite3.Connection, raw: str) -> int:
    """Accept either 'run-123_2026-04-15' or bare sequence '123' or 'WF-style run-id'."""
    if raw.startswith("run-"):
        row = conn.execute("SELECT id FROM runs WHERE run_id = ?", (raw,)).fetchone()
    else:
        row = conn.execute(
            "SELECT id FROM runs WHERE sequence_no = ?", (int(raw),)
        ).fetchone()
    if not row:
        die(f"run '{raw}' not found", where="open-wf", code=2)
    return int(row[0])


def cmd_open_wf(args: argparse.Namespace) -> None:
    ts = now_utc()
    title = args.title.strip()
    agent = args.agent.strip()
    packet = (args.packet or "").strip()
    acceptance = (args.acceptance or "").strip()
    validation = (args.validation or "").strip()
    owned_files = args.owned_files or "[]"
    forbidden = args.forbidden or "[]"
    try:
        json.loads(owned_files)
        json.loads(forbidden)
    except json.JSONDecodeError as e:
        die(f"--owned-files / --forbidden must be JSON arrays: {e}", where="open-wf", code=2)
    if not title or not agent:
        die("open-wf requires --title and --agent", where="open-wf", code=2)

    conn = connect(resolve_db_path(), need_vec=True)
    run_row = conn.execute(
        "SELECT id FROM runs WHERE run_id = ? OR sequence_no = CAST(? AS INTEGER)",
        (args.run, args.run),
    ).fetchone()
    if not run_row:
        die(f"run '{args.run}' not found", where="open-wf", code=2)
    run_db_id = int(run_row[0])

    next_seq = conn.execute(
        "SELECT COALESCE(MAX(sequence_no),0)+1 FROM workflow_tasks"
    ).fetchone()[0]
    wf_id = f"WF-{next_seq}"

    embedding_text = compose_embedding_text(
        [
            ("WF", wf_id),
            ("Title", title),
            ("Agent", agent),
            ("OwnedFiles", owned_files),
            ("Forbidden", forbidden),
            ("Acceptance", acceptance),
            ("Validation", validation),
        ]
    )
    if args.dry_run:
        json.dump(
            {"ok": True, "dry_run": True, "wf_id": wf_id, "embedding_text": embedding_text},
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "workflow_task", ts)
        conn.execute(
            """
            INSERT INTO workflow_tasks(
                object_id, wf_id, sequence_no, run_id, agent_role, packet_path, title,
                status, opened_at, owned_files_json, forbidden_paths_json,
                acceptance_criteria, validation_commands, discovered_only_in_agent_log
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)
            """,
            (
                obj_id,
                wf_id,
                next_seq,
                run_db_id,
                agent,
                packet,
                title,
                args.status,
                ts,
                owned_files,
                forbidden,
                acceptance,
                validation,
            ),
        )
        materialize(
            conn,
            obj_id,
            "workflow_task",
            title=f"{wf_id} {title}",
            summary=f"agent={agent} status={args.status} packet={packet}",
            body=(f"Acceptance: {acceptance}\nValidation: {validation}\n"
                  f"Owned: {owned_files}\nForbidden: {forbidden}"),
            tags=f"agent:{agent},status:{args.status}",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        # orchestration event
        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,1)
            """,
            (
                oe_obj_id,
                "task_assignment",
                ts,
                run_db_id,
                # refer to workflow_tasks.id
                conn.execute("SELECT id FROM workflow_tasks WHERE object_id=?", (obj_id,)).fetchone()[0],
                agent,
                args.sha or None,
                f"opened {wf_id}: {title}",
                "await kickoff",
                "memgraph.py",
                0,
            ),
        )
        oe_embed = compose_embedding_text(
            [("Event", "task_assignment"), ("WF", wf_id), ("Agent", agent), ("Title", title)]
        )
        materialize(
            conn,
            oe_obj_id,
            "orchestration_event",
            title=f"task_assignment {wf_id}",
            summary=f"agent={agent}",
            body=title,
            tags="task_assignment",
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "wf_id": wf_id, "sequence_no": next_seq}, sys.stdout)
    sys.stdout.write("\n")


def cmd_wf_status(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)
    row = conn.execute(
        "SELECT id, object_id, run_id, agent_role, title FROM workflow_tasks WHERE wf_id=?",
        (args.wf,),
    ).fetchone()
    if not row:
        die(f"workflow_task '{args.wf}' not found", where="wf-status", code=2)
    wf_db_id, obj_id, run_db_id, agent, title = row

    completion_ts = ts if args.status in ("done", "done_no_findings", "done_with_findings",
                                          "accepted", "closed", "cancelled", "published") else None

    mapping = {
        "kickoff": "task_kickoff",
        "in_progress": "checkpoint",
        "awaiting_review": "review_launch",
        "reviewed_with_findings": "review_result",
        "findings": "review_result",
        "blocked": "pause",
        "blocked_for_remediation": "task_transition",
        "remediation": "task_relaunch",
        "done": "task_completion",
        "done_with_findings": "task_completion",
        "done_no_findings": "task_completion",
        "accepted": "run_accept",
        "closed": "task_completion",
        "cancelled": "task_transition",
        "paused": "pause",
        "checkpoint": "checkpoint",
        "verification": "verification_complete",
    }
    event_type = mapping.get(args.status, "task_transition")

    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE workflow_tasks SET status=?, completed_at=COALESCE(?, completed_at) WHERE id=?",
            (args.status, completion_ts, wf_db_id),
        )
        # refresh index_docs tags with new status
        conn.execute(
            "UPDATE index_docs SET tags=? WHERE object_id=?",
            (f"agent:{agent},status:{args.status}", obj_id),
        )

        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,1)
            """,
            (
                oe_obj_id,
                event_type,
                ts,
                run_db_id,
                wf_db_id,
                agent,
                args.sha or None,
                f"{args.wf} -> {args.status}" + (f" :: {args.note}" if args.note else ""),
                args.next_action or "",
                "memgraph.py",
                0,
            ),
        )
        oe_embed = compose_embedding_text(
            [("Event", event_type), ("WF", args.wf), ("Status", args.status),
             ("Note", args.note or ""), ("SHA", args.sha or "")]
        )
        materialize(
            conn,
            oe_obj_id,
            "orchestration_event",
            title=f"{event_type} {args.wf}",
            summary=f"status={args.status}",
            body=args.note or title,
            tags=event_type,
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    json.dump(
        {"ok": True, "wf_id": args.wf, "new_status": args.status, "event": event_type},
        sys.stdout,
    )
    sys.stdout.write("\n")


def cmd_open_run(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)
    next_seq = conn.execute("SELECT COALESCE(MAX(sequence_no),0)+1 FROM runs").fetchone()[0]
    today = time.strftime("%Y-%m-%d", time.gmtime())
    run_id = f"run-{next_seq:03d}_{today}"
    tranche_db_id: Optional[int] = None
    if args.tranche:
        row = conn.execute(
            "SELECT id FROM tranches WHERE tranche_name=?",
            (args.tranche,),
        ).fetchone()
        if not row:
            die(f"tranche '{args.tranche}' not found", where="open-run", code=2)
        tranche_db_id = int(row[0])

    embedding_text = compose_embedding_text(
        [("Run", run_id), ("Title", args.title or ""), ("Tranche", args.tranche or "")]
    )
    if args.dry_run:
        json.dump(
            {"ok": True, "dry_run": True, "run_id": run_id, "embedding_text": embedding_text},
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "run", ts)
        conn.execute(
            """
            INSERT INTO runs(
                object_id, run_id, sequence_no, run_date, run_title, tranche_id,
                opened_at, status, boundary_decision
            ) VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                run_id,
                next_seq,
                today,
                args.title or "",
                tranche_db_id,
                ts,
                "open",
                args.boundary or "",
            ),
        )
        materialize(
            conn,
            obj_id,
            "run",
            title=run_id,
            summary=args.title or "",
            body=args.boundary or "",
            tags=f"tranche:{args.tranche or ''}",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        run_db_id = conn.execute("SELECT id FROM runs WHERE object_id=?", (obj_id,)).fetchone()[0]
        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,1)
            """,
            (
                oe_obj_id,
                "run_open",
                ts,
                run_db_id,
                tranche_db_id,
                "orchestrator",
                None,
                f"opened {run_id}: {args.title or ''}",
                "queue first WF",
                "memgraph.py",
                0,
            ),
        )
        oe_embed = compose_embedding_text([("Event", "run_open"), ("Run", run_id)])
        materialize(
            conn,
            oe_obj_id,
            "orchestration_event",
            title=f"run_open {run_id}",
            summary=args.title or "",
            body="",
            tags="run_open",
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "run_id": run_id, "sequence_no": next_seq}, sys.stdout)
    sys.stdout.write("\n")


def cmd_close_run(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)
    row = conn.execute(
        "SELECT id, object_id, run_title FROM runs WHERE run_id=?",
        (args.run,),
    ).fetchone()
    if not row:
        die(f"run '{args.run}' not found", where="close-run", code=2)
    run_db_id, obj_id, run_title = row
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE runs SET status=?, closed_at=? WHERE id=?",
            (args.status, ts, run_db_id),
        )
        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,?,NULL,NULL,?,?,?,?,?,?,1)
            """,
            (
                oe_obj_id,
                "run_closeout",
                ts,
                run_db_id,
                "orchestrator",
                args.sha or None,
                f"closed {args.run} -> {args.status}" + (f" :: {args.note}" if args.note else ""),
                "",
                "memgraph.py",
                0,
            ),
        )
        oe_embed = compose_embedding_text(
            [("Event", "run_closeout"), ("Run", args.run), ("Status", args.status), ("SHA", args.sha or "")]
        )
        materialize(
            conn,
            oe_obj_id,
            "orchestration_event",
            title=f"run_closeout {args.run}",
            summary=f"status={args.status}",
            body=args.note or "",
            tags="run_closeout",
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "run_id": args.run, "new_status": args.status}, sys.stdout)
    sys.stdout.write("\n")


def cmd_open_tranche(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)

    existing = conn.execute(
        "SELECT id, status FROM tranches WHERE tranche_name = ?",
        (args.tranche,),
    ).fetchone()
    if existing:
        die(
            f"tranche '{args.tranche}' already exists (status='{existing[1]}'); "
            f"use close-tranche or pick another name",
            where="open-tranche",
            code=2,
        )

    milestone = args.milestone or ""
    phase = args.phase or ""
    scope = args.scope or ""
    deferred = args.deferred_to_next or ""

    embedding_text = compose_embedding_text([
        ("Tranche", args.tranche),
        ("Milestone", milestone),
        ("Phase", phase),
        ("Scope", scope),
    ])

    if args.dry_run:
        json.dump(
            {
                "ok": True, "dry_run": True,
                "tranche": args.tranche, "status": "open",
                "embedding_text": embedding_text,
            },
            sys.stdout, ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return

    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "tranche", ts)
        conn.execute(
            """
            INSERT INTO tranches(
                object_id, tranche_name, milestone, phase, scope,
                deferred_to_next, opened_at, status
            ) VALUES (?,?,?,?,?,?,?,?)
            """,
            (obj_id, args.tranche, milestone, phase, scope, deferred, ts, "open"),
        )
        materialize(
            conn, obj_id, "tranche",
            title=args.tranche,
            summary=f"{milestone} {phase}".strip() or args.tranche,
            body=scope,
            tags=f"tranche,status:open",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        tr_db_id = conn.execute(
            "SELECT id FROM tranches WHERE object_id=?", (obj_id,),
        ).fetchone()[0]

        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,NULL,NULL,?,?,NULL,?,?,?,?,1)
            """,
            (
                oe_obj_id, "tranche_open", ts, tr_db_id,
                "orchestrator", scope, "queue first run",
                "memgraph.py", 0,
            ),
        )
        oe_embed = compose_embedding_text([
            ("Event", "tranche_open"),
            ("Tranche", args.tranche),
            ("Milestone", milestone),
            ("Phase", phase),
        ])
        materialize(
            conn, oe_obj_id, "orchestration_event",
            title=f"tranche_open {args.tranche}",
            summary="status=open",
            body=scope,
            tags=f"tranche_open,status:open",
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    json.dump(
        {
            "ok": True, "tranche": args.tranche,
            "status": "open", "opened_at": ts,
            "tranche_db_id": tr_db_id,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


def cmd_update_tranche(args: argparse.Namespace) -> None:
    """Patch tranche fields (scope/milestone/phase/deferred_to_next/status) and re-materialize.

    Used to align an existing tranche with the canonical plan when a stale
    field was written before the plan got rewritten. Does not insert events
    by itself; if a status flip is needed use close-tranche instead.
    """
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)

    row = conn.execute(
        "SELECT id, object_id, tranche_name, milestone, phase, scope, deferred_to_next, status "
        "FROM tranches WHERE tranche_name = ?",
        (args.tranche,),
    ).fetchone()
    if not row:
        die(f"tranche '{args.tranche}' not found", where="update-tranche", code=2)
    tr_id, tr_obj_id, tr_name, milestone, phase, scope, deferred, status = row

    new_milestone = args.milestone if args.milestone is not None else milestone
    new_phase = args.phase if args.phase is not None else phase
    new_scope = args.scope if args.scope is not None else scope
    new_deferred = args.deferred_to_next if args.deferred_to_next is not None else deferred

    if args.dry_run:
        json.dump({
            "ok": True, "dry_run": True, "tranche": tr_name,
            "milestone": new_milestone, "phase": new_phase,
            "scope_chars": len(new_scope or ""),
            "deferred_to_next_chars": len(new_deferred or ""),
        }, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return

    embedding_text = compose_embedding_text([
        ("Tranche", tr_name),
        ("Milestone", new_milestone or ""),
        ("Phase", new_phase or ""),
        ("Scope", new_scope or ""),
    ])
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE tranches SET milestone=?, phase=?, scope=?, deferred_to_next=? WHERE id=?",
            (new_milestone, new_phase, new_scope, new_deferred, tr_id),
        )
        conn.execute("UPDATE objects SET updated_at=? WHERE id=?", (ts, tr_obj_id))
        materialize(
            conn, tr_obj_id, "tranche",
            title=tr_name,
            summary=f"{new_milestone or ''} {new_phase or ''}".strip() or tr_name,
            body=new_scope or "",
            tags=f"tranche,status:{status}",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    json.dump({
        "ok": True, "tranche": tr_name, "status": status,
        "updated_at": ts, "scope_chars": len(new_scope or ""),
    }, sys.stdout)
    sys.stdout.write("\n")


def cmd_close_tranche(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)

    row = conn.execute(
        """
        SELECT id, object_id, tranche_name, milestone, phase, status, closed_at
          FROM tranches
         WHERE tranche_name = ?
        """,
        (args.tranche,),
    ).fetchone()
    if not row:
        die(f"tranche '{args.tranche}' not found", where="close-tranche", code=2)
    tr_id, tr_obj_id, tr_name, milestone, phase, cur_status, cur_closed = row

    if cur_status in ("closed", "accepted", "stopped") and not args.force:
        die(
            f"tranche '{tr_name}' already in terminal status '{cur_status}' "
            f"(closed_at={cur_closed}); pass --force to rewrite",
            where="close-tranche",
            code=3,
        )

    details_source = "empty"
    details = args.details or ""
    if details:
        details_source = "explicit"
    else:
        fallback = conn.execute(
            """
            SELECT oe.details
              FROM orchestration_events oe
              LEFT JOIN runs r ON r.id = oe.run_id
             WHERE oe.event_type IN ('run_accept', 'run_acceptance')
               AND (oe.tranche_id = ?
                    OR (r.run_title LIKE ? AND oe.tranche_id IS NULL))
             ORDER BY oe.happened_at DESC
             LIMIT 1
            """,
            (tr_id, f"%{tr_name}%"),
        ).fetchone()
        if fallback and fallback[0]:
            details = fallback[0]
            details_source = "fallback_run_accept"

    next_action = args.next_action or ""
    status_new = args.status
    sha = args.sha or None

    if args.dry_run:
        json.dump(
            {
                "dry_run": True,
                "tranche": tr_name,
                "current_status": cur_status,
                "new_status": status_new,
                "closed_at_would_be": ts,
                "details_source": details_source,
                "details_preview": details[:240],
                "next_action_preview": next_action[:240],
                "sha": sha or "",
            },
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
        return

    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE tranches SET status=?, closed_at=? WHERE id=?",
            (status_new, ts, tr_id),
        )
        oe_obj_id = insert_object(conn, "orchestration_event", ts)
        conn.execute(
            """
            INSERT INTO orchestration_events(
                object_id, event_type, happened_at, run_id, task_id, tranche_id,
                agent_role, previous_pushed_sha, details, next_action,
                source_file, source_line, source_primary
            ) VALUES (?,?,?,NULL,NULL,?,?,?,?,?,?,?,1)
            """,
            (
                oe_obj_id,
                "tranche_closed",
                ts,
                tr_id,
                "orchestrator",
                sha,
                details,
                next_action,
                "memgraph.py",
                0,
            ),
        )
        oe_embed = compose_embedding_text([
            ("Event", "tranche_closed"),
            ("Tranche", tr_name),
            ("Milestone", milestone),
            ("Phase", phase),
            ("Status", status_new),
            ("SHA", sha or ""),
            ("Details", details),
        ])
        materialize(
            conn,
            oe_obj_id,
            "orchestration_event",
            title=f"tranche_closed {tr_name}",
            summary=f"status={status_new}",
            body=details,
            tags=f"tranche_closed,status:{status_new}",
            aliases="",
            embedding_text=oe_embed,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    json.dump(
        {
            "ok": True,
            "tranche": tr_name,
            "new_status": status_new,
            "closed_at": ts,
            "orchestration_event_object_id": oe_obj_id,
            "details_source": details_source,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


def cmd_current_tranches(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path(), need_vec=False)
    rows = [
        dict(
            zip(
                ["tranche_name", "milestone", "phase", "status",
                 "scope", "deferred_to_next", "opened_at", "closed_at"],
                row,
            )
        )
        for row in conn.execute(
            """
            SELECT tranche_name, milestone, phase, status,
                   scope, deferred_to_next, opened_at, closed_at
            FROM tranches
            WHERE status IN ('open','accepted')
            ORDER BY opened_at DESC
            """
        )
    ]

    if args.format == "json":
        json.dump(rows, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return

    def _ts(epoch):
        if not epoch:
            return "—"
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(epoch)))

    out: List[str] = []
    out.append(f"Current tranches ({len(rows)}):")
    for t in rows:
        out.append(
            f"  - {t['tranche_name']} [{t['status']}] "
            f"{t['milestone']}/{t['phase']} "
            f"(opened {_ts(t['opened_at'])}"
            + (f", closed {_ts(t['closed_at'])}" if t['closed_at'] else "")
            + ")"
        )
        if t["scope"]:
            out.append("    scope:")
            for line in t["scope"].splitlines():
                out.append(f"      {line}")
        if t["deferred_to_next"]:
            out.append("    deferred_to_next:")
            for line in t["deferred_to_next"].splitlines():
                out.append(f"      {line}")
    sys.stdout.write("\n".join(out) + "\n")


def cmd_write_review(args: argparse.Namespace) -> None:
    ts = now_utc()
    conn = connect(resolve_db_path(), need_vec=True)
    row = conn.execute(
        "SELECT id FROM workflow_tasks WHERE wf_id=?",
        (args.wf,),
    ).fetchone()
    if not row:
        die(f"workflow_task '{args.wf}' not found", where="write-review", code=2)
    wf_db_id = int(row[0])

    embedding_text = compose_embedding_text(
        [
            ("Review", args.type),
            ("WF", args.wf),
            ("Verdict", args.verdict),
            ("Findings", str(args.findings)),
            ("Summary", args.summary or ""),
        ]
    )

    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "review_gate", ts)
        conn.execute(
            """
            INSERT INTO review_gates(
                object_id, task_id, review_type, verdict, findings_count,
                findings_summary, reviewed_at, reviewer_agent, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                wf_db_id,
                args.type,
                args.verdict,
                args.findings,
                args.summary or "",
                ts,
                args.reviewer or "",
                ts,
            ),
        )
        materialize(
            conn,
            obj_id,
            "review_gate",
            title=f"review {args.type} {args.wf} {args.verdict}",
            summary=args.summary or "",
            body=args.summary or "",
            tags=f"verdict:{args.verdict},type:{args.type}",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "wf": args.wf, "verdict": args.verdict}, sys.stdout)
    sys.stdout.write("\n")


def cmd_write_policy(args: argparse.Namespace) -> None:
    ts = now_utc()
    text = args.text.strip()
    name = args.name.strip()
    if not (text and name):
        die("write-policy requires --name and --text", where="write-policy", code=2)

    embedding_text = compose_embedding_text(
        [
            ("Policy", name),
            ("Scope", args.scope),
            ("Status", args.status),
            ("Text", text),
        ]
    )

    conn = connect(resolve_db_path(), need_vec=True)
    try:
        conn.execute("BEGIN IMMEDIATE")
        obj_id = insert_object(conn, "policy", ts)
        conn.execute(
            """
            INSERT INTO policies(
                object_id, policy_name, effective_from, source_file, status,
                policy_text, scope, retires_policy_id, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                obj_id,
                name,
                args.effective_from or ts,
                args.source_file,
                args.status,
                text,
                args.scope,
                args.retires,
                ts,
                ts,
            ),
        )
        if args.retires:
            conn.execute(
                "UPDATE policies SET status='superseded', retired_at=?, retirement_reason=? WHERE id=?",
                (ts, args.retirement_reason or f"superseded by '{name}'", args.retires),
            )
        materialize(
            conn,
            obj_id,
            "policy",
            title=name,
            summary=f"{args.scope} :: {args.status}",
            body=text,
            tags=f"scope:{args.scope},status:{args.status}",
            aliases="",
            embedding_text=embedding_text,
            ts=ts,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    json.dump({"ok": True, "object_id": obj_id, "policy_name": name}, sys.stdout)
    sys.stdout.write("\n")


def cmd_write_relation(args: argparse.Namespace) -> None:
    conn = connect(resolve_db_path())
    add_relation(
        conn,
        int(args.source),
        args.relation,
        int(args.target),
        evidence_chunk_id=args.evidence_chunk,
        confidence=args.confidence,
    )
    json.dump(
        {"ok": True, "source": args.source, "relation": args.relation, "target": args.target},
        sys.stdout,
    )
    sys.stdout.write("\n")


# ---------------------------------------------------------------------------
# ingest-docs: chunk committed markdown docs into sources/chunks + materialize
#
# Documents on disk stay the source of truth; chunks are a search projection
# (no claims/decisions are auto-created). Incremental: unchanged files are
# skipped by whole-file content_hash; changed files are diffed chunk-by-chunk
# so unchanged sections keep their object_id (evidence links stay valid).


@dataclass
class ChunkDraft:
    heading_path: str
    body: str
    content_hash: str


def _ingest_parse_sections(text: str, file_stem: str) -> List[Tuple[str, str]]:
    """Split markdown into (heading_path, body) sections by ATX headings.

    Fenced code blocks (``` / ~~~) are opaque: heading-like lines inside a
    fence are body text, never structural headings. Empty/whitespace-only
    sections are dropped (the heading breadcrumb still updates for children).
    Preamble before the first heading uses file_stem as its heading_path.
    """
    lines = text.split("\n")
    stack: List[Tuple[int, str]] = []
    sections: List[Tuple[str, str]] = []
    body_buf: List[str] = []
    in_fence = False
    fence_char = ""
    fence_len = 0

    def current_path() -> str:
        return " > ".join(t for _, t in stack) if stack else file_stem

    def flush() -> None:
        body = "\n".join(body_buf).strip("\n")
        if body.strip():
            sections.append((current_path(), body))
        body_buf.clear()

    for line in lines:
        lead = len(line) - len(line.lstrip(" "))
        fence_match = INGEST_FENCE_RE.match(line) if lead <= 3 else None

        if in_fence:
            body_buf.append(line)
            if (
                fence_match
                and fence_match.group(1)[0] == fence_char
                and len(fence_match.group(1)) >= fence_len
            ):
                in_fence = False
            continue

        if fence_match:
            in_fence = True
            fence_char = fence_match.group(1)[0]
            fence_len = len(fence_match.group(1))
            body_buf.append(line)
            continue

        heading_match = INGEST_ATX_RE.match(line) if lead <= 3 else None
        if heading_match:
            flush()
            level = len(heading_match.group(1))
            heading_text = (heading_match.group(2) or "").strip()
            heading_text = re.sub(r"\s+#+\s*$", "", heading_text).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, heading_text))
            continue

        body_buf.append(line)

    flush()
    return sections


def _ingest_split_section(body: str, max_chars: int) -> List[str]:
    """Split an over-cap section body at blank-line boundaries; hard-split a
    single over-cap paragraph at the cap."""
    if len(body) <= max_chars:
        return [body]
    paragraphs = re.split(r"\n{2,}", body)
    pieces: List[str] = []
    current = ""
    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            pieces.append(current)
            current = ""
        if len(para) <= max_chars:
            current = para
        else:
            start = 0
            while start < len(para):
                pieces.append(para[start : start + max_chars])
                start += max_chars
    if current:
        pieces.append(current)
    return pieces or [body[:max_chars]]


def _ingest_build_chunk_drafts(text: str, file_stem: str) -> List[ChunkDraft]:
    drafts: List[ChunkDraft] = []
    for heading_path, body in _ingest_parse_sections(text, file_stem):
        pieces = _ingest_split_section(body, MAX_CHUNK_CHARS)
        multi = len(pieces) > 1
        for i, piece in enumerate(pieces):
            hp = f"{heading_path} [part {i + 1}]" if multi else heading_path
            drafts.append(
                ChunkDraft(heading_path=hp, body=piece, content_hash=sha256_text(f"{hp}\n{piece}"))
            )
    return drafts


def _ingest_detect_date(filename: str) -> Optional[int]:
    m = INGEST_DATE_RE.search(filename)
    if not m:
        return None
    try:
        return calendar.timegm(time.strptime(m.group(0), "%Y-%m-%d"))
    except ValueError:
        return None


def _ingest_classify_source(rel_posix: str, *, external: bool = False) -> Tuple[str, str]:
    """Map a selected relpath to (source_role, source_category) per the ingest-docs spec table."""
    if external:
        return "external_memory_archive", "other"
    if rel_posix == "AGENTS.md":
        return "runtime_prompt", "policies"
    if rel_posix.startswith("docs/evidence/"):
        return "evidence", "project_doc"
    if rel_posix.startswith("docs/knowledge/"):
        return "thematic_doc", "project_doc"
    if rel_posix.startswith("docs/"):
        return "strategic_doc", "project_doc"
    if rel_posix.startswith(".agent/tasks/") and rel_posix.endswith("/spec.md"):
        return "task_spec", "task_packet"
    return "doc", "other"


def _ingest_chunk_embedding_text(rel_posix: str, heading_path: str, body: str) -> str:
    text = compose_embedding_text([("Doc", rel_posix), ("Section", heading_path), ("Text", body)])
    return text[:MAX_EMBED_CHARS] if len(text) > MAX_EMBED_CHARS else text


def _ingest_chunk_title(rel_posix: str, heading_path: str) -> str:
    return f"{rel_posix} § {heading_path}"[:200]


def _ingest_chunk_tags(rel_posix: str, source_category: str) -> str:
    return f"doc-chunk,{source_category},{rel_posix.split('/', 1)[0]}"


def _ingest_is_within_repo(path: Path, repo_root: Path) -> bool:
    try:
        path.relative_to(repo_root)
        return True
    except ValueError:
        return False


def _ingest_external_tracked_markdown(external_root: Path) -> List[Path]:
    """Return exactly the tracked Markdown files of an explicitly selected archive repo."""
    root = external_root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"external archive root does not exist: {root}")
    try:
        top = Path(
            subprocess.check_output(
                ["git", "-C", str(root), "rev-parse", "--show-toplevel"],
                stderr=subprocess.STDOUT,
            ).decode().strip()
        ).resolve()
        if top != root:
            raise ValueError(f"external archive root must be its git top-level: {root} != {top}")
        raw = subprocess.check_output(
            ["git", "-C", str(root), "ls-files", "-z", "--", "*.md"],
            stderr=subprocess.STDOUT,
        ).decode("utf-8")
    except (subprocess.CalledProcessError, UnicodeDecodeError) as exc:
        raise ValueError(f"cannot enumerate tracked Markdown in {root}: {exc}") from exc

    real_root = Path(os.path.realpath(root))
    selected: List[Path] = []
    for rel in sorted(item for item in raw.split("\0") if item):
        path = root / rel
        if Path(os.path.realpath(path)) != real_root / rel:
            # A tracked symlink commits the link, not the target bytes, so the
            # target content is not reproducible from the archive HEAD. Skip
            # it here and in verify (both use this selection), consistently.
            continue
        if not _ingest_is_within_repo(path.resolve(), root):
            raise ValueError(f"tracked Markdown escapes external archive root: {rel}")
        if path.suffix == ".md" and path.is_file():
            selected.append(path)
    return selected


def _ingest_external_revision(external_root: Path) -> str:
    """Require committed Markdown bytes and return the reproducible archive HEAD."""
    root = external_root.expanduser().resolve()
    try:
        top = Path(
            subprocess.check_output(
                ["git", "-C", str(root), "rev-parse", "--show-toplevel"],
                stderr=subprocess.STDOUT,
                text=True,
            ).strip()
        ).resolve()
        if top != root:
            raise ValueError(f"external archive root must be its git top-level: {root} != {top}")
        diff = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "diff",
                "--quiet",
                "HEAD",
                "--",
                ":(glob)**/*.md",
            ],
            check=False,
        )
        if diff.returncode == 1:
            raise ValueError(
                f"external archive has dirty tracked Markdown; commit it before ingestion: {root}"
            )
        if diff.returncode != 0:
            raise ValueError(f"cannot verify external archive cleanliness: {root}")
        return subprocess.check_output(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            stderr=subprocess.STDOUT,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as exc:
        raise ValueError(f"cannot resolve external archive revision in {root}: {exc}") from exc


def _external_archive_revision_key(external_root: Path) -> str:
    root_hash = sha256_text(str(external_root.resolve()))[:24]
    return f"external_archive_revision:{root_hash}"


def _record_external_archive_revision(
    conn: sqlite3.Connection, external_root: Path, revision: str
) -> None:
    value = json.dumps(
        {"root": str(external_root.resolve()), "revision": revision},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """
            INSERT INTO meta(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
            """,
            (_external_archive_revision_key(external_root), value),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


def _read_external_archive_revision(
    conn: sqlite3.Connection, external_root: Path
) -> Optional[str]:
    row = conn.execute(
        "SELECT value FROM meta WHERE key=?",
        (_external_archive_revision_key(external_root),),
    ).fetchone()
    if not row:
        return None
    try:
        payload = json.loads(str(row[0]))
    except json.JSONDecodeError:
        return None
    if payload.get("root") != str(external_root.resolve()):
        return None
    revision = payload.get("revision")
    return str(revision) if revision else None


def _ingest_source_key(path: Path, repo_root: Path, external_root: Optional[Path]) -> str:
    if external_root is not None:
        resolved = path.resolve()
        root = external_root.resolve()
        if not _ingest_is_within_repo(resolved, root):
            raise ValueError(f"external source escapes selected root: {resolved}")
        return str(resolved)
    # Lexical identity, deliberately NOT resolve(): a symlink must never be
    # renamed to its target. Selection has already rejected symlinked paths.
    return path.relative_to(repo_root).as_posix()


def _ingest_source_in_scope(
    source_path: str,
    repo_root: Path,
    external_root: Optional[Path],
) -> bool:
    """Keep pruning isolated to the selected repo or external archive namespace.

    Membership is LEXICAL: the stored key already names the namespace it was
    ingested into. Never consult the disk (resolve/realpath) here — a source
    whose file was later replaced by an outward symlink would "leave" its own
    namespace and dodge pruning and verification at exactly the moment it has
    to be cleaned up."""
    candidate = Path(source_path)
    if external_root is not None:
        if not candidate.is_absolute():
            return False
        normalized = Path(os.path.normpath(str(candidate)))
        # Both spellings of the root: keys are minted from the resolved root
        # at ingest time, but the root argument may arrive unresolved (e.g.
        # /tmp vs /private/tmp on macOS). Only the root — the caller's own
        # live argument — is ever resolved; stored keys never are.
        scope_roots = {external_root.resolve(), Path(os.path.normpath(str(external_root)))}
        return any(_ingest_is_within_repo(normalized, root) for root in scope_roots)
    if candidate.is_absolute():
        return False
    normalized = Path(os.path.normpath(source_path))
    return not normalized.is_absolute() and normalized.parts[:1] != ("..",)


def _ingest_source_in_default_scope(source_path: str) -> bool:
    """Return whether a stored relative source belongs to default managed docs."""
    candidate = Path(source_path)
    if candidate.is_absolute() or candidate.suffix != ".md":
        return False
    parts = candidate.parts
    if not parts or candidate.name == "CLAUDE.md" or "memgraph" in parts:
        return False
    if source_path == "AGENTS.md":
        return True
    if parts[0] == "docs":
        return True
    return (
        len(parts) >= 4
        and parts[0] == ".agent"
        and parts[1] == "tasks"
        and candidate.name == "spec.md"
    )


# Pathspecs limiting the git-state scan to the managed document corpus. The
# actual membership test is _ingest_source_in_default_scope; these only bound
# how much of the tree `git status` has to walk. `.agent/memory.db` is outside
# every pathspec by construction, so the ingest-then-commit-the-DB cadence
# never trips the gate.
_MANAGED_GIT_PATHSPECS = ("docs", "AGENTS.md", ".agent/tasks")


def _ingest_git_toplevel(repo_root: Path) -> Optional[Path]:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(repo_root), "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
        )
        return Path(out.decode("utf-8", errors="replace").strip()).resolve()
    except Exception:
        return None


def _ingest_managed_git_state(repo_root: Path) -> Dict[str, Any]:
    """Inspect the managed document corpus against Git for the commit boundary.

    The document lifecycle indexes only committed bytes: the committed
    memory.db must never reference document content other clones cannot
    reproduce from HEAD. Returns:
      git_available        — repo_root is the top level of a git work tree
      git_reason           — why Git is unavailable (None when available)
      dirty_managed_paths  — managed paths with uncommitted state relative to
                             HEAD: modified, added, deleted, renamed (both
                             sides checked), or untracked-and-not-ignored
      ignored_managed_paths— untracked managed paths matched by .gitignore;
                             they are outside the reproducible corpus and are
                             excluded from selection, never silently indexed
    Tracked files that merely match an ignore rule are reported by neither
    list: Git keeps tracking them, so they stay in the corpus.
    """
    root = repo_root.resolve()
    toplevel = _ingest_git_toplevel(root)
    if toplevel is None:
        return {
            "git_available": False,
            "git_reason": f"{root} is not inside a Git work tree",
            "dirty_managed_paths": [],
            "ignored_managed_paths": [],
        }
    if toplevel != root:
        return {
            "git_available": False,
            "git_reason": (
                f"target repo root {root} must be the Git top level "
                f"(found {toplevel})"
            ),
            "dirty_managed_paths": [],
            "ignored_managed_paths": [],
        }
    try:
        raw_status = subprocess.check_output(
            [
                "git",
                "-C",
                str(root),
                "status",
                "--porcelain",
                "-z",
                "--untracked-files=all",
                "--",
                *_MANAGED_GIT_PATHSPECS,
            ],
            stderr=subprocess.STDOUT,
        ).decode("utf-8", errors="replace")
        # Ignored files must be enumerated per FILE, never per directory: for
        # a directory-level ignore rule (`docs/knowledge/`, `.agent/`)
        # `git status` reports only the collapsed directory entry, and the
        # Markdown files inside would silently stay in the corpus. `ls-files
        # --others --ignored` expands every ignored untracked file; tracked
        # files never appear here, so a tracked file matched by a later
        # ignore rule stays indexed.
        raw_ignored = subprocess.check_output(
            [
                "git",
                "-C",
                str(root),
                "ls-files",
                "--others",
                "--ignored",
                "--exclude-standard",
                "-z",
                "--",
                *_MANAGED_GIT_PATHSPECS,
            ],
            stderr=subprocess.STDOUT,
        ).decode("utf-8", errors="replace")
    except (subprocess.CalledProcessError, UnicodeDecodeError) as exc:
        return {
            "git_available": False,
            "git_reason": f"cannot read git state in {root}: {exc}",
            "dirty_managed_paths": [],
            "ignored_managed_paths": [],
        }

    ignored: Set[str] = {
        candidate
        for candidate in raw_ignored.split("\0")
        if candidate and _ingest_source_in_default_scope(candidate)
    }
    dirty: Set[str] = set()
    fields = raw_status.split("\0")
    i = 0
    while i < len(fields):
        entry = fields[i]
        i += 1
        if len(entry) < 4:
            continue
        status_xy = entry[:2]
        paths = [entry[3:]]
        if status_xy[0] in ("R", "C") and i < len(fields) and fields[i]:
            paths.append(fields[i])
            i += 1
        if status_xy == "!!":
            continue
        for candidate in paths:
            if not _ingest_source_in_default_scope(candidate):
                continue
            dirty.add(candidate)
    return {
        "git_available": True,
        "git_reason": None,
        "dirty_managed_paths": sorted(dirty),
        "ignored_managed_paths": sorted(ignored),
    }


def _ingest_expand_paths_arg(raw_paths: Sequence[str], repo_root: Path) -> List[Path]:
    """Expand explicit --paths entries into lexical repo paths. Directories
    expand to their managed **/*.md content. Hard dies (guard #2): an entry
    outside the repo, a missing entry, an entry that is or crosses a symlink
    (Git commits the link, not the target bytes, so target content is not
    reproducible from HEAD), and an explicit file outside the managed corpus
    (--paths narrows the managed selection; it never widens it)."""
    real_root = Path(os.path.realpath(repo_root))
    expanded: List[Path] = []
    for raw in raw_paths:
        p = Path(raw)
        if not p.is_absolute():
            p = Path.cwd() / p
        lexical = Path(os.path.normpath(str(p)))
        rel: Optional[Path] = None
        for root in (repo_root, real_root):
            try:
                rel = lexical.relative_to(root)
                break
            except ValueError:
                continue
        if rel is None:
            die(
                f"--paths entry '{raw}' resolves outside the repo ({repo_root}); "
                "ingest-docs only ingests repo-local files",
                where="ingest-docs",
                code=2,
            )
        anchored = repo_root / rel
        if not anchored.exists():
            die(f"--paths entry '{raw}' does not exist (resolved to {anchored})", where="ingest-docs", code=2)
        if Path(os.path.realpath(anchored)) != real_root / rel:
            die(
                f"--paths entry '{raw}' is or crosses a symlink; the managed corpus "
                "indexes regular committed files only",
                where="ingest-docs",
                code=2,
            )
        if anchored.is_dir():
            expanded.extend(
                child
                for child in sorted(anchored.rglob("*.md"))
                if _ingest_source_in_default_scope(child.relative_to(repo_root).as_posix())
            )
        else:
            if not _ingest_source_in_default_scope(rel.as_posix()):
                die(
                    f"--paths entry '{raw}' is outside the managed document corpus "
                    "(docs/**/*.md, AGENTS.md, .agent/tasks/**/spec.md); the Git commit "
                    "boundary and verify-doc-index cover only that corpus",
                    where="ingest-docs",
                    code=2,
                )
            expanded.append(anchored)
    return expanded


def _ingest_default_selection(repo_root: Path) -> List[Path]:
    candidates: List[Path] = []
    docs_dir = repo_root / "docs"
    if docs_dir.is_dir():
        candidates.extend(docs_dir.rglob("*.md"))
    agents_md = repo_root / "AGENTS.md"
    if agents_md.is_file():
        candidates.append(agents_md)
    tasks_dir = repo_root / ".agent" / "tasks"
    if tasks_dir.is_dir():
        candidates.extend(tasks_dir.rglob("spec.md"))
    return candidates


def _ingest_symlinked_managed_dirs(repo_root: Path) -> List[str]:
    """Symlinked directories inside the managed roots. File selection never
    descends into them (and must not), so they produce no per-file candidates;
    report the directory itself to keep symlinked_managed_paths an honest
    inventory of every managed path excluded by the symlink rule."""
    found: Set[str] = set()
    for base in ("docs", ".agent/tasks"):
        base_dir = repo_root / base
        if base_dir.is_symlink():
            found.add(base)
            continue
        if not base_dir.is_dir():
            continue
        for dirpath, dirnames, _filenames in os.walk(base_dir, followlinks=False):
            for name in dirnames:
                child = Path(dirpath) / name
                if child.is_symlink():
                    found.add(child.relative_to(repo_root).as_posix())
    return sorted(found)


def _ingest_apply_excludes_sort_dedupe(
    paths: Iterable[Path], repo_root: Path
) -> Tuple[List[Path], List[str]]:
    """Always exclude CLAUDE.md, anything under memgraph/, and any non-.md file.
    Applies uniformly to default selection and to --paths expansion.

    Source identity is the LEXICAL repo-relative path — never the resolved
    target of a symlink: resolving would let a link inside the managed corpus
    smuggle non-corpus bytes in under the target's name. A candidate whose
    on-disk identity crosses a symlink anywhere inside the repo (the file
    itself or a directory component) is excluded from the corpus and returned
    in the second element for reporting, mirroring ignored_managed_paths."""
    real_root = Path(os.path.realpath(repo_root))
    seen: Dict[str, Path] = {}
    symlinked: Set[str] = set()
    for p in paths:
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            continue
        if rel.suffix != ".md" or rel.name == "CLAUDE.md":
            continue
        if "memgraph" in rel.parts:
            continue
        if Path(os.path.realpath(p)) != real_root / rel:
            symlinked.add(rel.as_posix())
            continue
        seen[rel.as_posix()] = repo_root / rel
    return [seen[k] for k in sorted(seen)], sorted(symlinked)


def _ingest_is_chunk_referenced(conn: sqlite3.Connection, object_id: int) -> bool:
    row = conn.execute(
        """
        SELECT 1 WHERE EXISTS (
            SELECT 1 FROM relations
            WHERE source_object_id = ? OR target_object_id = ? OR evidence_chunk_id = ?
        ) OR EXISTS (SELECT 1 FROM claims WHERE primary_evidence_chunk_id = ?)
          OR EXISTS (SELECT 1 FROM decisions WHERE primary_evidence_chunk_id = ?)
          OR EXISTS (SELECT 1 FROM tasks WHERE primary_evidence_chunk_id = ?)
          OR EXISTS (SELECT 1 FROM events WHERE primary_evidence_chunk_id = ?)
        """,
        (object_id,) * 7,
    ).fetchone()
    return row is not None


def _ingest_delete_or_deindex_chunk(conn: sqlite3.Connection, chunk_row_id: int, object_id: int) -> str:
    """Reference-safe deletion of one chunk object. Returns 'deleted' or 'deindexed_kept'.

    Unreferenced: DELETE FROM objects cascades chunks + index_docs (FTS
    trigger fires) + embedding_meta; memory_vec is not FK-covered so it is
    deleted explicitly.
    Referenced: keep objects + chunks (flipped to extraction_status=
    'ignored'); drop index_docs/memory_vec/embedding_meta so stale text
    leaves the search index while evidence links stay valid.
    """
    if _ingest_is_chunk_referenced(conn, object_id):
        conn.execute("UPDATE chunks SET extraction_status='ignored' WHERE id=?", (chunk_row_id,))
        conn.execute("DELETE FROM index_docs WHERE object_id=?", (object_id,))
        conn.execute("DELETE FROM memory_vec WHERE rowid=?", (object_id,))
        conn.execute("DELETE FROM embedding_meta WHERE object_id=?", (object_id,))
        return "deindexed_kept"
    # Delete index_docs explicitly, not via the objects FK cascade: the FTS
    # sync trigger must fire on every SQLite build, and trigger-on-cascade
    # behavior is not guaranteed across platforms this kit targets.
    conn.execute("DELETE FROM index_docs WHERE object_id=?", (object_id,))
    conn.execute("DELETE FROM memory_vec WHERE rowid=?", (object_id,))
    conn.execute("DELETE FROM objects WHERE id=?", (object_id,))
    return "deleted"


def _ingest_diff_chunk_rows(
    old_rows: Sequence[Tuple[int, int, str, str]],
    new_drafts: Sequence[ChunkDraft],
) -> Tuple[List[Tuple[int, int, int]], List[Tuple[int, ChunkDraft]], List[Tuple[int, int]]]:
    """Match new chunk drafts to old chunk rows by content_hash.

    Only old rows with extraction_status == 'parsed_structural' are eligible
    for reuse (an 'ignored' row stays retired even on a coincidental hash
    match, since it is pinned as evidence); each old row is consumed at most
    once. Returns:
      reused:    [(new_order_index, old_chunk_row_id, object_id), ...]
      to_insert: [(new_order_index, draft), ...]
      unmatched: [(old_chunk_row_id, object_id), ...]  (delete-with-reference-safety candidates)
    """
    available: Dict[str, List[Tuple[int, int]]] = {}
    for row_id, obj_id, c_hash, status in old_rows:
        if status == "parsed_structural":
            available.setdefault(c_hash, []).append((row_id, obj_id))

    reused: List[Tuple[int, int, int]] = []
    to_insert: List[Tuple[int, ChunkDraft]] = []
    consumed_row_ids: Set[int] = set()

    for idx, draft in enumerate(new_drafts):
        bucket = available.get(draft.content_hash)
        if bucket:
            row_id, obj_id = bucket.pop(0)
            consumed_row_ids.add(row_id)
            reused.append((idx, row_id, obj_id))
        else:
            to_insert.append((idx, draft))

    unmatched = [
        (row_id, obj_id)
        for row_id, obj_id, _c_hash, _status in old_rows
        if row_id not in consumed_row_ids
    ]
    return reused, to_insert, unmatched


def _ingest_insert_chunk(
    conn: sqlite3.Connection,
    *,
    source_id: int,
    rel_posix: str,
    source_category: str,
    draft: ChunkDraft,
    chunk_order: int,
    detected_date: Optional[int],
    vec: List[float],
    ts: int,
) -> int:
    obj_id = insert_object(conn, "chunk", ts)
    conn.execute(
        """
        INSERT INTO chunks(
            object_id, source_id, heading_path, body, chunk_order,
            detected_date, extraction_status, content_hash, imported_at
        ) VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (
            obj_id,
            source_id,
            draft.heading_path,
            draft.body,
            chunk_order,
            detected_date,
            "parsed_structural",
            draft.content_hash,
            ts,
        ),
    )
    materialize(
        conn,
        obj_id,
        "chunk",
        title=_ingest_chunk_title(rel_posix, draft.heading_path),
        summary=draft.body[:300],
        body=draft.body,
        tags=_ingest_chunk_tags(rel_posix, source_category),
        aliases=rel_posix,
        embedding_text=_ingest_chunk_embedding_text(rel_posix, draft.heading_path, draft.body),
        ts=ts,
        precomputed_vec=vec,
    )
    return obj_id


def _ingest_run_prune(
    conn: sqlite3.Connection,
    repo_root: Path,
    *,
    external_root: Optional[Path],
    selected_source_keys: Set[str],
    dry_run: bool,
) -> Dict[str, Any]:
    """Prune only the active ingestion namespace.

    A normal repo ingest never touches absolute external archive sources. An
    external archive ingest never touches repo-relative sources or a different
    archive root. Rows are stale when the source is no longer selected (for an
    external git archive this also catches files that became untracked) or is
    missing on disk.
    """
    rows = conn.execute("SELECT id, path FROM sources").fetchall()
    missing: List[Tuple[int, str]] = []
    for sid, path in rows:
        path_text = str(path)
        if not _ingest_source_in_scope(path_text, repo_root, external_root):
            continue
        disk_path = Path(path_text) if Path(path_text).is_absolute() else repo_root / path_text
        if path_text not in selected_source_keys or not disk_path.exists():
            missing.append((int(sid), path_text))

    if not missing:
        return {"files_pruned": 0, "chunks_deleted": 0, "chunks_deindexed_kept": 0, "plan_pruned": []}

    files_pruned = 0
    chunks_deleted = 0
    chunks_deindexed_kept = 0
    plan_pruned: List[Dict[str, Any]] = []

    if not dry_run:
        conn.execute("BEGIN IMMEDIATE")
    try:
        for source_id, path in missing:
            chunk_rows = conn.execute(
                "SELECT id, object_id FROM chunks WHERE source_id=?", (source_id,)
            ).fetchall()
            n_deleted = 0
            n_kept = 0
            for row_id, obj_id in chunk_rows:
                referenced = _ingest_is_chunk_referenced(conn, obj_id)
                if referenced:
                    n_kept += 1
                else:
                    n_deleted += 1
                if not dry_run:
                    _ingest_delete_or_deindex_chunk(conn, row_id, obj_id)

            if not dry_run:
                remaining = conn.execute(
                    "SELECT COUNT(*) FROM chunks WHERE source_id=?", (source_id,)
                ).fetchone()[0]
                source_removed = False
                if remaining == 0:
                    conn.execute("DELETE FROM sources WHERE id=?", (source_id,))
                    source_removed = True
            else:
                source_removed = n_kept == 0

            files_pruned += 1
            chunks_deleted += n_deleted
            chunks_deindexed_kept += n_kept
            plan_pruned.append(
                {
                    "path": path,
                    "chunks_deleted": n_deleted,
                    "chunks_deindexed_kept": n_kept,
                    "source_removed": source_removed,
                }
            )
        if not dry_run:
            conn.execute("COMMIT")
    except Exception:
        if not dry_run:
            conn.execute("ROLLBACK")
        raise

    return {
        "files_pruned": files_pruned,
        "chunks_deleted": chunks_deleted,
        "chunks_deindexed_kept": chunks_deindexed_kept,
        "plan_pruned": plan_pruned,
    }


def cmd_ingest_docs(args: argparse.Namespace) -> None:
    repo_root = target_repo_root()
    expected_db = (repo_root / ".agent" / "memory.db").resolve()
    actual_db = resolve_db_path().resolve()
    if actual_db != expected_db:
        die(
            f"ingest-docs requires the repo-local DB {expected_db}; MEMGRAPH_DB points elsewhere "
            f"(resolved to {actual_db})",
            where="ingest-docs",
            code=2,
        )

    external_root = (
        Path(args.external_root).expanduser().resolve() if args.external_root else None
    )
    if external_root is not None and args.paths:
        die(
            "--external-root already selects every tracked Markdown file; do not combine it with --paths",
            where="ingest-docs",
            code=2,
        )
    try:
        external_revision: Optional[str] = None
        symlinked_managed_paths: List[str] = []
        if external_root is not None:
            external_revision = _ingest_external_revision(external_root)
            selected = _ingest_external_tracked_markdown(external_root)
        else:
            if args.paths:
                raw_candidates = _ingest_expand_paths_arg(args.paths, repo_root)
            else:
                raw_candidates = _ingest_default_selection(repo_root)
            selected, symlinked_files = _ingest_apply_excludes_sort_dedupe(
                raw_candidates, repo_root
            )
            symlinked_managed_paths = sorted(
                set(symlinked_files) | set(_ingest_symlinked_managed_dirs(repo_root))
            )
            for key in symlinked_managed_paths:
                log(f"symlink, outside the reproducible corpus, not indexed: {key}")
    except ValueError as exc:
        die(str(exc), where="ingest-docs", code=2)

    dry_run = bool(args.dry_run)
    do_prune = not args.no_prune

    git_gate: Optional[Dict[str, Any]] = None
    if external_root is None:
        git_gate = _ingest_managed_git_state(repo_root)
        if not git_gate["git_available"]:
            if not dry_run:
                die(
                    "ingest-docs indexes only committed documents and requires Git: "
                    f"{git_gate['git_reason']}. Infrastructure bootstrap and typed-memory "
                    "writes work without Git; use --dry-run for a non-committable preview.",
                    where="ingest-docs",
                    code=2,
                )
            log(f"warning: {git_gate['git_reason']}; dry-run preview only, committable=false")
        else:
            ignored_keys = set(git_gate["ignored_managed_paths"])
            if ignored_keys:
                kept: List[Path] = []
                for path in selected:
                    key = _ingest_source_key(path, repo_root, None)
                    if key in ignored_keys:
                        log(f"gitignored, outside the reproducible corpus, not indexed: {key}")
                    else:
                        kept.append(path)
                selected = kept
            if git_gate["dirty_managed_paths"] and not dry_run:
                listing = ", ".join(git_gate["dirty_managed_paths"][:20])
                if len(git_gate["dirty_managed_paths"]) > 20:
                    listing += ", ..."
                die(
                    "managed document corpus is dirty relative to HEAD; commit or revert "
                    f"before ingest-docs: {listing}",
                    where="ingest-docs",
                    code=2,
                )

    selected_source_keys = {
        _ingest_source_key(path, repo_root, external_root) for path in selected
    }

    conn = connect(expected_db, need_vec=True)

    counters: Dict[str, int] = {
        "files_scanned": len(selected),
        "files_new": 0,
        "files_changed": 0,
        "files_unchanged": 0,
        "files_reclassified": 0,
        "files_pruned": 0,
        "chunks_added": 0,
        "chunks_reused": 0,
        "chunks_deleted": 0,
        "chunks_deindexed_kept": 0,
        "embedding_batches": 0,
        "embedded_chunks": 0,
    }
    plan_new: List[Dict[str, Any]] = []
    plan_changed: List[Dict[str, Any]] = []
    plan_pruned: List[Dict[str, Any]] = []
    plan_reclassified: List[Dict[str, Any]] = []

    for path in selected:
        rel_posix = _ingest_source_key(path, repo_root, external_root)
        text = path.read_text(encoding="utf-8", errors="replace")
        file_hash = sha256_text(text)
        source_role, source_category = _ingest_classify_source(
            rel_posix, external=external_root is not None
        )

        existing = conn.execute(
            "SELECT id, content_hash, source_role, source_category FROM sources WHERE path=?",
            (rel_posix,),
        ).fetchone()

        if existing and (
            str(existing[2]) != source_role or str(existing[3]) != source_category
        ):
            # Classification is derived state: refresh role/category even when
            # the file bytes are unchanged, or a classifier upgrade strands old
            # rows that verify-doc-index can never reconcile. Category is
            # denormalized into index_docs.tags (FTS syncs via trigger);
            # embedding text contains neither, so vectors stay untouched.
            counters["files_reclassified"] += 1
            if dry_run:
                plan_reclassified.append(
                    {
                        "path": rel_posix,
                        "from_role": str(existing[2]),
                        "from_category": str(existing[3]),
                        "to_role": source_role,
                        "to_category": source_category,
                    }
                )
                log(
                    f"[dry-run] reclassify: {rel_posix} "
                    f"({existing[2]}/{existing[3]} -> {source_role}/{source_category})"
                )
            else:
                category_changed = str(existing[3]) != source_category
                try:
                    conn.execute("BEGIN IMMEDIATE")
                    conn.execute(
                        "UPDATE sources SET source_role=?, source_category=? WHERE id=?",
                        (source_role, source_category, int(existing[0])),
                    )
                    if category_changed:
                        conn.execute(
                            """
                            UPDATE index_docs SET tags=?
                            WHERE object_id IN (
                                SELECT object_id FROM chunks
                                WHERE source_id=? AND extraction_status='parsed_structural'
                            )
                            """,
                            (
                                _ingest_chunk_tags(rel_posix, source_category),
                                int(existing[0]),
                            ),
                        )
                    conn.execute("COMMIT")
                except Exception:
                    conn.execute("ROLLBACK")
                    raise
                log(
                    f"reclassified: {rel_posix} "
                    f"({existing[2]}/{existing[3]} -> {source_role}/{source_category})"
                )

        if existing and existing[1] == file_hash:
            counters["files_unchanged"] += 1
            log(f"unchanged: {rel_posix}")
            continue

        drafts = _ingest_build_chunk_drafts(text, path.stem)
        detected_date = _ingest_detect_date(path.name)

        if not existing:
            embedding_texts = [
                _ingest_chunk_embedding_text(rel_posix, d.heading_path, d.body) for d in drafts
            ]
            if dry_run:
                plan_new.append({"path": rel_posix, "chunks": len(drafts)})
                counters["files_new"] += 1
                counters["chunks_added"] += len(drafts)
                log(f"[dry-run] new: {rel_posix} (+{len(drafts)} chunks)")
                continue

            n_batches = (len(embedding_texts) + MAX_EMBED_BATCH - 1) // MAX_EMBED_BATCH
            vecs = call_embed_batch(embedding_texts)
            ts = now_utc()
            try:
                conn.execute("BEGIN IMMEDIATE")
                cur = conn.execute(
                    """
                    INSERT INTO sources(path, source_role, source_category, content_hash, imported_at)
                    VALUES (?,?,?,?,?)
                    """,
                    (rel_posix, source_role, source_category, file_hash, ts),
                )
                source_id = int(cur.lastrowid)
                for idx, (draft, vec) in enumerate(zip(drafts, vecs)):
                    _ingest_insert_chunk(
                        conn,
                        source_id=source_id,
                        rel_posix=rel_posix,
                        source_category=source_category,
                        draft=draft,
                        chunk_order=idx,
                        detected_date=detected_date,
                        vec=vec,
                        ts=ts,
                    )
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            counters["files_new"] += 1
            counters["chunks_added"] += len(drafts)
            counters["embedded_chunks"] += len(drafts)
            counters["embedding_batches"] += n_batches
            log(f"new: {rel_posix} (+{len(drafts)} chunks)")
        else:
            source_id = int(existing[0])
            old_rows = conn.execute(
                """
                SELECT id, object_id, content_hash, extraction_status
                FROM chunks WHERE source_id=? ORDER BY chunk_order
                """,
                (source_id,),
            ).fetchall()
            reused, to_insert, unmatched = _ingest_diff_chunk_rows(old_rows, drafts)

            unmatched_classified = [
                (row_id, obj_id, _ingest_is_chunk_referenced(conn, obj_id))
                for row_id, obj_id in unmatched
            ]
            n_deleted = sum(1 for *_ids, referenced in unmatched_classified if not referenced)
            n_kept = sum(1 for *_ids, referenced in unmatched_classified if referenced)

            if dry_run:
                plan_changed.append(
                    {
                        "path": rel_posix,
                        "chunks_reused": len(reused),
                        "chunks_added": len(to_insert),
                        "chunks_deleted": n_deleted,
                        "chunks_deindexed_kept": n_kept,
                    }
                )
                counters["files_changed"] += 1
                counters["chunks_reused"] += len(reused)
                counters["chunks_added"] += len(to_insert)
                counters["chunks_deleted"] += n_deleted
                counters["chunks_deindexed_kept"] += n_kept
                log(
                    f"[dry-run] changed: {rel_posix} (+{len(to_insert)} -{n_deleted} "
                    f"reused={len(reused)} kept_ignored={n_kept})"
                )
                continue

            embedding_texts = [
                _ingest_chunk_embedding_text(rel_posix, d.heading_path, d.body) for _idx, d in to_insert
            ]
            n_batches = (
                (len(embedding_texts) + MAX_EMBED_BATCH - 1) // MAX_EMBED_BATCH if embedding_texts else 0
            )
            vecs = call_embed_batch(embedding_texts) if embedding_texts else []
            ts = now_utc()
            try:
                conn.execute("BEGIN IMMEDIATE")
                for idx, row_id, _obj_id in reused:
                    conn.execute(
                        "UPDATE chunks SET chunk_order=?, imported_at=? WHERE id=?",
                        (idx, ts, row_id),
                    )
                for row_id, obj_id in unmatched:
                    _ingest_delete_or_deindex_chunk(conn, row_id, obj_id)
                for (idx, draft), vec in zip(to_insert, vecs):
                    _ingest_insert_chunk(
                        conn,
                        source_id=source_id,
                        rel_posix=rel_posix,
                        source_category=source_category,
                        draft=draft,
                        chunk_order=idx,
                        detected_date=detected_date,
                        vec=vec,
                        ts=ts,
                    )
                conn.execute(
                    "UPDATE sources SET content_hash=?, imported_at=? WHERE id=?",
                    (file_hash, ts, source_id),
                )
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            counters["files_changed"] += 1
            counters["chunks_reused"] += len(reused)
            counters["chunks_added"] += len(to_insert)
            counters["chunks_deleted"] += n_deleted
            counters["chunks_deindexed_kept"] += n_kept
            counters["embedded_chunks"] += len(to_insert)
            counters["embedding_batches"] += n_batches
            log(
                f"changed: {rel_posix} (+{len(to_insert)} -{n_deleted} "
                f"reused={len(reused)} kept_ignored={n_kept})"
            )

    if do_prune:
        pruned = _ingest_run_prune(
            conn,
            repo_root,
            external_root=external_root,
            selected_source_keys=selected_source_keys,
            dry_run=dry_run,
        )
        counters["files_pruned"] = pruned["files_pruned"]
        counters["chunks_deleted"] += pruned["chunks_deleted"]
        counters["chunks_deindexed_kept"] += pruned["chunks_deindexed_kept"]
        plan_pruned = pruned["plan_pruned"]

    if external_root is not None and external_revision is not None and not dry_run:
        _record_external_archive_revision(conn, external_root, external_revision)

    result: Dict[str, Any] = {
        "ok": True,
        "db": str(expected_db),
        "external_root": str(external_root) if external_root is not None else None,
        "external_revision": external_revision,
        "git_available": git_gate["git_available"] if git_gate is not None else None,
        "committable": (
            bool(git_gate["git_available"] and not git_gate["dirty_managed_paths"])
            if git_gate is not None
            else None
        ),
        "dirty_managed_paths": (
            git_gate["dirty_managed_paths"] if git_gate is not None else []
        ),
        "ignored_managed_paths": (
            git_gate["ignored_managed_paths"] if git_gate is not None else []
        ),
        "symlinked_managed_paths": symlinked_managed_paths,
        **counters,
        "dry_run": dry_run,
    }
    if dry_run:
        result["plan_new"] = plan_new
        result["plan_changed"] = plan_changed
        result["plan_pruned"] = plan_pruned
        result["plan_reclassified"] = plan_reclassified
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


def _fts_docsize_available(conn: sqlite3.Connection) -> bool:
    """memory_fts is external-content FTS5 (content='index_docs'), so a rowid
    lookup on it is answered from index_docs and can never see a desynced FTS
    index entry. The docsize shadow table records exactly which rowids the
    FTS index itself holds; probe it when present (canonical schema), fall
    back to a plain rowid lookup for reduced stand-in schemas."""
    return (
        conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='memory_fts_docsize'"
        ).fetchone()
        is not None
    )


def _verify_fts_entry_present(conn: sqlite3.Connection, object_id: int) -> bool:
    if _fts_docsize_available(conn):
        return (
            conn.execute(
                "SELECT 1 FROM memory_fts_docsize WHERE id=?", (object_id,)
            ).fetchone()
            is not None
        )
    return (
        conn.execute(
            "SELECT 1 FROM memory_fts WHERE rowid=?", (object_id,)
        ).fetchone()
        is not None
    )


def _verify_evidence_tombstone_ok(conn: sqlite3.Connection, object_id: int) -> bool:
    """A de-indexed chunk may stay only as genuinely referenced evidence with
    zero search projections (index_docs, FTS, vector, embedding meta)."""
    if not _ingest_is_chunk_referenced(conn, object_id):
        return False
    projected = conn.execute(
        """
        SELECT
          EXISTS(SELECT 1 FROM index_docs WHERE object_id=?),
          EXISTS(SELECT 1 FROM memory_vec WHERE rowid=?),
          EXISTS(SELECT 1 FROM embedding_meta WHERE object_id=?)
        """,
        (object_id, object_id, object_id),
    ).fetchone()
    if any(bool(flag) for flag in projected):
        return False
    return not _verify_fts_entry_present(conn, object_id)


def _verify_active_projections(
    conn: sqlite3.Connection,
    source_by_path: Dict[str, Dict[str, Any]],
    source_ids: Sequence[int],
) -> Dict[str, Any]:
    """Prove chunk/FTS/vector/embedding coverage for a non-empty source set."""
    source_ids = list(source_ids)
    source_placeholders = ",".join("?" * len(source_ids))
    active_rows = conn.execute(
        f"""
        SELECT c.object_id, c.source_id
        FROM chunks c
        WHERE c.source_id IN ({source_placeholders})
          AND c.extraction_status='parsed_structural'
        ORDER BY c.object_id
        """,
        source_ids,
    ).fetchall()
    active_ids = [int(object_id) for object_id, _source_id in active_rows]
    sources_with_chunks = {int(source_id) for _object_id, source_id in active_rows}
    sources_without_active_chunks = sorted(
        path
        for path, row in source_by_path.items()
        if int(row["id"]) not in sources_with_chunks
    )

    def missing_projection(table: str, key: str = "object_id") -> List[int]:
        rows = conn.execute(
            f"""
            SELECT c.object_id
            FROM chunks c
            WHERE c.source_id IN ({source_placeholders})
              AND c.extraction_status='parsed_structural'
              AND NOT EXISTS (
                SELECT 1 FROM {table} projected WHERE projected.{key}=c.object_id
              )
            ORDER BY c.object_id
            """,
            source_ids,
        ).fetchall()
        return [int(row[0]) for row in rows]

    missing_index_docs = missing_projection("index_docs")
    if _fts_docsize_available(conn):
        missing_fts = [
            int(row[0])
            for row in conn.execute(
                f"""
                SELECT c.object_id
                FROM chunks c
                WHERE c.source_id IN ({source_placeholders})
                  AND c.extraction_status='parsed_structural'
                  AND NOT EXISTS (
                    SELECT 1 FROM memory_fts_docsize d WHERE d.id=c.object_id
                  )
                ORDER BY c.object_id
                """,
                source_ids,
            ).fetchall()
        ]
    else:
        missing_fts = missing_projection("memory_fts", "rowid")
    missing_vectors = missing_projection("memory_vec", "rowid")
    missing_embedding_meta = missing_projection("embedding_meta")

    hash_rows = conn.execute(
        f"""
        SELECT c.object_id, s.path, c.heading_path, c.body, c.content_hash,
               i.embedding_text, i.embedding_text_hash,
               e.embedding_text_hash
        FROM chunks c
        JOIN sources s ON s.id=c.source_id
        JOIN index_docs i ON i.object_id=c.object_id
        JOIN embedding_meta e ON e.object_id=c.object_id
        WHERE c.source_id IN ({source_placeholders})
          AND c.extraction_status='parsed_structural'
        ORDER BY c.object_id
        """,
        source_ids,
    ).fetchall()
    chunk_hash_mismatches: List[int] = []
    embedding_hash_mismatches: List[int] = []
    for (
        object_id,
        source_path,
        heading_path,
        body,
        chunk_hash,
        embedding_text,
        index_embedding_hash,
        meta_embedding_hash,
    ) in hash_rows:
        object_id = int(object_id)
        expected_chunk_hash = sha256_text(f"{heading_path}\n{body}")
        if str(chunk_hash) != expected_chunk_hash:
            chunk_hash_mismatches.append(object_id)
        expected_embedding_text = _ingest_chunk_embedding_text(
            str(source_path), str(heading_path), str(body)
        )
        expected_embedding_hash = sha256_text(expected_embedding_text)
        if (
            str(embedding_text) != expected_embedding_text
            or str(index_embedding_hash) != expected_embedding_hash
            or str(meta_embedding_hash) != expected_embedding_hash
        ):
            embedding_hash_mismatches.append(object_id)
    embedding_contract_mismatches = [
        int(row[0])
        for row in conn.execute(
            f"""
            SELECT c.object_id
            FROM chunks c
            JOIN embedding_meta e ON e.object_id=c.object_id
            WHERE c.source_id IN ({source_placeholders})
              AND c.extraction_status='parsed_structural'
              AND (e.model <> ? OR e.dimensions <> ?)
            ORDER BY c.object_id
            """,
            [*source_ids, MODEL, DIMENSIONS],
        ).fetchall()
    ]
    return {
        "active_ids": active_ids,
        "sources_without_active_chunks": sources_without_active_chunks,
        "missing_index_docs": missing_index_docs,
        "missing_fts": missing_fts,
        "missing_vectors": missing_vectors,
        "missing_embedding_meta": missing_embedding_meta,
        "chunk_hash_mismatches": chunk_hash_mismatches,
        "embedding_hash_mismatches": embedding_hash_mismatches,
        "embedding_contract_mismatches": embedding_contract_mismatches,
    }


def _verify_doc_index(
    conn: sqlite3.Connection,
    expected_source_paths: Sequence[str],
    *,
    expected_source_hashes: Optional[Dict[str, str]] = None,
    external_root: Optional[Path] = None,
    repo_root: Optional[Path] = None,
    dirty_managed_paths: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Verify document content and every active search projection end to end.

    An empty expected corpus is a healthy state, not a failure: zero expected
    documents with zero leftover in-scope sources returns ok=true with
    corpus_empty=true. A source whose file left the corpus but whose chunks
    are pinned as evidence is a legitimate tombstone only when every chunk is
    genuinely referenced, has extraction_status='ignored', and carries no
    index_docs/FTS/vector/embedding-meta projection; such sources are listed
    in retained_evidence_sources instead of failing the check, while any
    active, partially indexed, or unjustified leftover still fails it.
    Ignored chunks of sources still in the corpus (section tombstones left by
    removed-but-referenced sections) are audited by the same rule: valid ones
    land in retained_evidence_chunks, violations fail the check via
    invalid_evidence_tombstones.
    In repo scope, EVERY relative source path in the DB is audited, not only
    paths inside the managed corpus: a repo source outside that corpus was
    never legitimately ingested and fails as unexpected regardless of its
    chunk state — no tombstone leniency applies to it.
    dirty_managed_paths (uncommitted managed files, supplied by the caller)
    is its own failure category, kept separate from stale-source reporting.
    """
    expected = sorted(set(str(path) for path in expected_source_paths))
    corpus_empty = not expected
    dirty = sorted(set(str(path) for path in (dirty_managed_paths or [])))

    source_by_path: Dict[str, Dict[str, Any]] = {}
    if expected:
        path_placeholders = ",".join("?" * len(expected))
        source_rows = conn.execute(
            f"""
            SELECT id, path, source_role, source_category, content_hash
            FROM sources
            WHERE path IN ({path_placeholders})
            ORDER BY path
            """,
            expected,
        ).fetchall()
        source_by_path = {
            str(path): {
                "id": int(source_id),
                "source_role": str(source_role),
                "source_category": str(source_category),
                "content_hash": str(content_hash),
            }
            for source_id, path, source_role, source_category, content_hash in source_rows
        }
    source_paths = sorted(source_by_path)
    missing_sources = sorted(set(expected) - set(source_by_path))
    source_ids = [int(row["id"]) for row in source_by_path.values()]

    scoped_paths: Set[str] = set()
    source_role_mismatches: List[str] = []
    source_category_mismatches: List[str] = []
    if external_root is not None:
        root = external_root.resolve()
        # Lexical membership, like _ingest_source_in_scope: resolving stored
        # keys against the current disk would hide a source whose file was
        # since replaced by an outward symlink — the exact stale source this
        # audit exists to catch. Only the live root argument is resolved, and
        # both its spellings (as given and resolved) count.
        scope_roots = {root, Path(os.path.normpath(str(external_root)))}
        scoped_paths = {
            str(path)
            for (path,) in conn.execute("SELECT path FROM sources").fetchall()
            if Path(str(path)).is_absolute()
            and any(
                _ingest_is_within_repo(Path(os.path.normpath(str(path))), scope_root)
                for scope_root in scope_roots
            )
        }
        source_role_mismatches = sorted(
            path
            for path, row in source_by_path.items()
            if row["source_role"] != "external_memory_archive"
        )
        source_category_mismatches = sorted(
            path
            for path, row in source_by_path.items()
            if row["source_category"] != "other"
        )
    elif repo_root is not None:
        # Every relative path is a repo source and must be accounted for —
        # scoping this to _ingest_source_in_default_scope would make sources
        # smuggled in from outside the managed corpus (e.g. via a permissive
        # --paths or a resolved symlink) invisible to verification.
        scoped_paths = {
            str(path)
            for (path,) in conn.execute("SELECT path FROM sources").fetchall()
            if not Path(str(path)).is_absolute()
        }
        expected_roles = {
            path: _ingest_classify_source(path)
            for path in expected
            if _ingest_source_in_default_scope(path)
        }
        source_role_mismatches = sorted(
            path
            for path, (expected_role, _expected_category) in expected_roles.items()
            if path in source_by_path
            and source_by_path[path]["source_role"] != expected_role
        )
        source_category_mismatches = sorted(
            path
            for path, (_expected_role, expected_category) in expected_roles.items()
            if path in source_by_path
            and source_by_path[path]["source_category"] != expected_category
        )

    unexpected_sources: List[str] = []
    retained_evidence_sources: List[str] = []
    retained_evidence_chunks: List[int] = []
    invalid_evidence_tombstones: List[str] = []
    for leftover_path in sorted(scoped_paths - set(expected)):
        row = conn.execute(
            "SELECT id FROM sources WHERE path=?", (leftover_path,)
        ).fetchone()
        if row is None:
            continue
        if external_root is None and not _ingest_source_in_default_scope(leftover_path):
            # A repo source outside the managed corpus was never legitimately
            # ingested, so it gets no evidence-tombstone leniency: reject it
            # outright, whatever the state of its chunks.
            unexpected_sources.append(leftover_path)
            continue
        chunk_rows = conn.execute(
            """
            SELECT id, object_id, extraction_status
            FROM chunks WHERE source_id=? ORDER BY object_id
            """,
            (int(row[0]),),
        ).fetchall()
        if not chunk_rows or any(
            str(status) != "ignored" for _row_id, _object_id, status in chunk_rows
        ):
            unexpected_sources.append(leftover_path)
            continue
        object_ids = [int(object_id) for _row_id, object_id, _status in chunk_rows]
        if all(
            _verify_evidence_tombstone_ok(conn, object_id) for object_id in object_ids
        ):
            retained_evidence_sources.append(leftover_path)
            retained_evidence_chunks.extend(object_ids)
        else:
            invalid_evidence_tombstones.append(leftover_path)

    # Section tombstones: a source still in the corpus can carry ignored
    # chunks left by removed-but-referenced sections. Audit every ignored
    # chunk globally, not only chunks of fully removed sources — a stale
    # projection on any of them re-surfaces deleted text in search.
    for path in sorted(source_by_path):
        ignored_rows = conn.execute(
            """
            SELECT object_id FROM chunks
            WHERE source_id=? AND extraction_status='ignored'
            ORDER BY object_id
            """,
            (int(source_by_path[path]["id"]),),
        ).fetchall()
        for (object_id,) in ignored_rows:
            if _verify_evidence_tombstone_ok(conn, int(object_id)):
                retained_evidence_chunks.append(int(object_id))
            elif path not in invalid_evidence_tombstones:
                invalid_evidence_tombstones.append(path)
    retained_evidence_chunks.sort()
    invalid_evidence_tombstones.sort()

    source_hash_mismatches = sorted(
        path
        for path, expected_hash in (expected_source_hashes or {}).items()
        if path in source_by_path and source_by_path[path]["content_hash"] != expected_hash
    )

    projections: Dict[str, Any] = {
        "active_ids": [],
        "sources_without_active_chunks": [],
        "missing_index_docs": [],
        "missing_fts": [],
        "missing_vectors": [],
        "missing_embedding_meta": [],
        "chunk_hash_mismatches": [],
        "embedding_hash_mismatches": [],
        "embedding_contract_mismatches": [],
    }
    if source_ids:
        projections = _verify_active_projections(conn, source_by_path, source_ids)

    failures = (
        missing_sources
        or unexpected_sources
        or invalid_evidence_tombstones
        or source_role_mismatches
        or source_category_mismatches
        or source_hash_mismatches
        or projections["sources_without_active_chunks"]
        or projections["missing_index_docs"]
        or projections["missing_fts"]
        or projections["missing_vectors"]
        or projections["missing_embedding_meta"]
        or projections["chunk_hash_mismatches"]
        or projections["embedding_hash_mismatches"]
        or projections["embedding_contract_mismatches"]
        or dirty
    )
    return {
        "ok": not bool(failures),
        "corpus_empty": corpus_empty,
        "expected_sources": len(expected),
        "indexed_sources": len(source_paths),
        "active_chunks": len(projections["active_ids"]),
        "source_paths": source_paths,
        "missing_sources": missing_sources,
        "unexpected_sources": unexpected_sources,
        "retained_evidence_sources": retained_evidence_sources,
        "retained_evidence_chunks": retained_evidence_chunks,
        "invalid_evidence_tombstones": invalid_evidence_tombstones,
        "dirty_managed_paths": dirty,
        "source_role_mismatches": source_role_mismatches,
        "source_category_mismatches": source_category_mismatches,
        "source_hash_mismatches": source_hash_mismatches,
        "sources_without_active_chunks": projections["sources_without_active_chunks"],
        "missing_index_docs": projections["missing_index_docs"],
        "missing_fts": projections["missing_fts"],
        "missing_vectors": projections["missing_vectors"],
        "missing_embedding_meta": projections["missing_embedding_meta"],
        "chunk_hash_mismatches": projections["chunk_hash_mismatches"],
        "embedding_hash_mismatches": projections["embedding_hash_mismatches"],
        "embedding_contract_mismatches": projections["embedding_contract_mismatches"],
    }


def cmd_verify_doc_index(args: argparse.Namespace) -> None:
    repo_root = target_repo_root()
    db_path = resolve_db_path()
    external_root = (
        Path(args.external_root).expanduser().resolve() if args.external_root else None
    )
    git_gate: Optional[Dict[str, Any]] = None
    try:
        external_revision: Optional[str] = None
        symlinked_managed_paths: List[str] = []
        if external_root is not None:
            external_revision = _ingest_external_revision(external_root)
            selected = _ingest_external_tracked_markdown(external_root)
        else:
            git_gate = _ingest_managed_git_state(repo_root)
            if not git_gate["git_available"]:
                die(
                    "verify-doc-index proves the index against the committed corpus "
                    f"and requires Git: {git_gate['git_reason']}",
                    where="verify-doc-index",
                    code=2,
                )
            selected, symlinked_files = _ingest_apply_excludes_sort_dedupe(
                _ingest_default_selection(repo_root), repo_root
            )
            symlinked_managed_paths = sorted(
                set(symlinked_files) | set(_ingest_symlinked_managed_dirs(repo_root))
            )
            ignored_keys = set(git_gate["ignored_managed_paths"])
            if ignored_keys:
                selected = [
                    path
                    for path in selected
                    if _ingest_source_key(path, repo_root, None) not in ignored_keys
                ]
        expected_paths = [
            _ingest_source_key(path, repo_root, external_root) for path in selected
        ]
        expected_source_hashes = {
            _ingest_source_key(path, repo_root, external_root): sha256_text(
                path.read_text(encoding="utf-8", errors="replace")
            )
            for path in selected
        }
    except ValueError as exc:
        die(str(exc), where="verify-doc-index", code=2)

    conn = connect(db_path, need_vec=True)
    result = _verify_doc_index(
        conn,
        expected_paths,
        expected_source_hashes=expected_source_hashes,
        external_root=external_root,
        repo_root=repo_root if external_root is None else None,
        dirty_managed_paths=(
            git_gate["dirty_managed_paths"] if git_gate is not None else None
        ),
    )
    recorded_external_revision = (
        _read_external_archive_revision(conn, external_root)
        if external_root is not None
        else None
    )
    external_revision_matches = (
        recorded_external_revision == external_revision
        if external_root is not None
        else None
    )
    if external_root is not None and not external_revision_matches:
        result["ok"] = False
    result.update(
        {
            "db": str(db_path),
            "external_root": str(external_root) if external_root is not None else None,
            "external_revision": external_revision,
            "recorded_external_revision": recorded_external_revision,
            "external_revision_matches": external_revision_matches,
            "ignored_managed_paths": (
                git_gate["ignored_managed_paths"] if git_gate is not None else []
            ),
            "symlinked_managed_paths": symlinked_managed_paths,
        }
    )
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    if not result["ok"]:
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Argparse wiring


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="memgraph", description=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)

    # session-context
    sc = sub.add_parser("session-context", help="Print session startup context")
    sc.add_argument("--format", choices=["text", "json"], default="text")
    sc.set_defaults(func=cmd_session_context)

    # recall
    rc = sub.add_parser("recall", help="Hybrid FTS+vector recall")
    rc.add_argument("query")
    rc.add_argument("--k", type=int, default=DEFAULT_TOP_K,
                    help=(
                        f"cap on result count (default {DEFAULT_TOP_K}); "
                        f"clamped to {MAX_SQLITE_VEC_K} (sqlite-vec limit)"
                    ))
    rc.add_argument("--type", default=None, help="comma-separated object_type filter")
    rc.add_argument(
        "--include-invalidated",
        action="store_true",
        help="include historical objects targeted by active invalidates/supersedes edges",
    )
    rc.set_defaults(func=cmd_recall)

    # next-wf / next-run
    nw = sub.add_parser("next-wf", help="Next workflow_task sequence + WF-id")
    nw.set_defaults(func=cmd_next_wf)
    nr = sub.add_parser("next-run", help="Next run sequence + run-id")
    nr.set_defaults(func=cmd_next_run)

    # policy / entity / timeline
    pol = sub.add_parser("policy", help="Lookup policy by name fragment")
    pol.add_argument("fragment")
    pol.set_defaults(func=cmd_policy)

    en = sub.add_parser("entity", help="Lookup entity by canonical_name or alias")
    en.add_argument("name")
    en.set_defaults(func=cmd_entity)

    tl = sub.add_parser("timeline", help="Orchestration timeline filtered by run or WF")
    tl.add_argument("--run")
    tl.add_argument("--wf")
    tl.set_defaults(func=cmd_timeline)

    sh = sub.add_parser("show", help="Print the full text of one object: all columns of its typed table, the index_docs body, primary evidence chunk, and every relation (incoming + outgoing).")
    sh.add_argument("object_id", help="objects.id of the target")
    sh.set_defaults(func=cmd_show)

    rv = sub.add_parser(
        "refresh-views",
        help=(
            "Re-render generated_views from their source_query and re-materialize "
            "(idempotent: unchanged rows report refreshed=0)."
        ),
    )
    rv.add_argument("--all", action="store_true", help="refresh every generated_view")
    rv.add_argument(
        "--view",
        action="append",
        help="refresh a specific view by name (repeatable)",
    )
    rv.add_argument("--dry-run", action="store_true")
    rv.set_defaults(func=cmd_refresh_views)

    # write-decision
    wd = sub.add_parser("write-decision", help="Insert a decision")
    wd.add_argument("--title", required=True)
    wd.add_argument("--summary", required=True)
    wd.add_argument("--decision", required=True)
    wd.add_argument("--rationale", default="")
    wd.add_argument("--consequences", default="")
    wd.add_argument("--tags", default="")
    wd.add_argument("--status", default="active")
    wd.add_argument("--valid-from", type=int, default=None)
    wd.add_argument("--valid-until", type=int, default=None)
    wd.add_argument("--evidence-chunk", type=int, default=None)
    wd.add_argument("--relates-to", action="append")
    wd.add_argument("--relation", default="relates_to")
    wd.add_argument("--dry-run", action="store_true")
    wd.set_defaults(func=cmd_write_decision)

    # write-claim
    wc = sub.add_parser("write-claim", help="Insert a claim (gotcha/fact/etc.)")
    wc.add_argument("--type", required=True)
    wc.add_argument("--statement", required=True)
    wc.add_argument("--entity", default=None)
    wc.add_argument("--confidence", type=float, default=0.8)
    wc.add_argument("--status", default="active")
    wc.add_argument("--valid-from", type=int, default=None)
    wc.add_argument("--valid-until", type=int, default=None)
    wc.add_argument("--evidence-chunk", type=int, default=None)
    wc.add_argument("--relates-to", action="append")
    wc.add_argument("--relation", default="about")
    wc.add_argument("--dry-run", action="store_true")
    wc.set_defaults(func=cmd_write_claim)

    # write-entity / alias-entity
    we = sub.add_parser("write-entity", help="Insert a new entity")
    we.add_argument("--type", required=True)
    we.add_argument("--name", required=True, help="canonical_name")
    we.add_argument("--display", default=None)
    we.add_argument("--aliases", default="[]", help="JSON array")
    we.add_argument("--summary", default="")
    we.add_argument("--dry-run", action="store_true")
    we.set_defaults(func=cmd_write_entity)

    ae = sub.add_parser("alias-entity", help="Add aliases to an existing entity")
    ae.add_argument("--canonical", required=True)
    ae.add_argument("--add", required=True, help="JSON array of new aliases")
    ae.set_defaults(func=cmd_alias_entity)

    # open-wf / wf-status
    ow = sub.add_parser("open-wf", help="Open a new workflow_task")
    ow.add_argument("--title", required=True)
    ow.add_argument("--agent", required=True)
    ow.add_argument("--run", required=True, help="run_id or sequence_no")
    ow.add_argument("--packet", default="")
    ow.add_argument("--owned-files", default="[]", help="JSON array")
    ow.add_argument("--forbidden", default="[]", help="JSON array")
    ow.add_argument("--acceptance", default="")
    ow.add_argument("--validation", default="")
    ow.add_argument("--status", default="planned")
    ow.add_argument("--sha", default=None)
    ow.add_argument("--dry-run", action="store_true")
    ow.set_defaults(func=cmd_open_wf)

    ws = sub.add_parser("wf-status", help="Update workflow_task.status + emit event")
    ws.add_argument("--wf", required=True)
    ws.add_argument("--status", required=True)
    ws.add_argument("--sha", default=None)
    ws.add_argument("--note", default="")
    ws.add_argument("--next-action", default="")
    ws.set_defaults(func=cmd_wf_status)

    # open-run / close-run
    orun = sub.add_parser("open-run", help="Open a new run")
    orun.add_argument("--title", default="")
    orun.add_argument("--tranche", default=None)
    orun.add_argument("--boundary", default="")
    orun.add_argument("--dry-run", action="store_true")
    orun.set_defaults(func=cmd_open_run)

    cr = sub.add_parser("close-run", help="Close a run")
    cr.add_argument("--run", required=True)
    cr.add_argument("--status", required=True,
                    choices=["closed_accepted", "closed_rejected", "stopped", "paused"])
    cr.add_argument("--sha", default=None)
    cr.add_argument("--note", default="")
    cr.set_defaults(func=cmd_close_run)

    ut = sub.add_parser("update-tranche",
                        help="Patch tranche scope/milestone/phase/deferred_to_next + re-materialize")
    ut.add_argument("--tranche", required=True)
    ut.add_argument("--milestone", default=None)
    ut.add_argument("--phase", default=None)
    ut.add_argument("--scope", default=None)
    ut.add_argument("--deferred-to-next", default=None)
    ut.add_argument("--dry-run", action="store_true")
    ut.set_defaults(func=cmd_update_tranche)

    ot = sub.add_parser("open-tranche",
                        help="Open a new tranche + emit tranche_open event")
    ot.add_argument("--tranche", required=True, help="Unique tranche_name")
    ot.add_argument("--milestone", default="")
    ot.add_argument("--phase", default="")
    ot.add_argument("--scope", default="", help="Free-form scope/intent body")
    ot.add_argument("--deferred-to-next", default="")
    ot.add_argument("--dry-run", action="store_true")
    ot.set_defaults(func=cmd_open_tranche)

    ct = sub.add_parser("close-tranche",
                        help="Close a tranche + emit tranche_closed event")
    ct.add_argument("--tranche", required=True,
                    help="Exact tranche_name (UNIQUE)")
    ct.add_argument("--status", default="accepted",
                    choices=["closed", "accepted", "stopped"])
    ct.add_argument("--sha", default=None,
                    help="Previous pushed SHA at close time (optional)")
    ct.add_argument("--details", default="",
                    help="Explicit details body; falls back to last run_accept.details when empty")
    ct.add_argument("--next-action", default="")
    ct.add_argument("--force", action="store_true",
                    help="Rewrite even if tranche is already in a terminal status")
    ct.add_argument("--dry-run", action="store_true")
    ct.set_defaults(func=cmd_close_tranche)

    curt = sub.add_parser("current-tranches",
                          help="Non-terminal tranches (same query as session-context block)")
    curt.add_argument("--format", default="text", choices=["text", "json"])
    curt.set_defaults(func=cmd_current_tranches)

    # write-review / write-policy / write-relation
    wr = sub.add_parser("write-review", help="Insert a review_gate")
    wr.add_argument("--wf", required=True)
    wr.add_argument("--type", required=True,
                    choices=["claude_reviewer", "codex_code_review", "codex_logic_review",
                             "lead_review", "regression_gate", "application_logic_review"])
    wr.add_argument("--verdict", required=True,
                    choices=["pending", "pass", "fail", "findings", "accepted", "rejected"])
    wr.add_argument("--findings", type=int, default=0)
    wr.add_argument("--summary", default="")
    wr.add_argument("--reviewer", default="")
    wr.set_defaults(func=cmd_write_review)

    wp = sub.add_parser("write-policy", help="Insert a policy (retires old one if --retires)")
    wp.add_argument("--name", required=True)
    wp.add_argument("--scope", required=True,
                    choices=["repo", "orchestration", "execution", "review", "memory", "git", "other"])
    wp.add_argument("--status", default="active",
                    choices=["active", "locked", "retired", "superseded"])
    wp.add_argument("--effective-from", type=int, default=None)
    wp.add_argument("--source-file", required=True)
    wp.add_argument("--text", required=True)
    wp.add_argument("--retires", type=int, default=None)
    wp.add_argument("--retirement-reason", default="")
    wp.set_defaults(func=cmd_write_policy)

    wrel = sub.add_parser("write-relation", help="Insert a typed edge into relations")
    wrel.add_argument("--source", required=True)
    wrel.add_argument("--target", required=True)
    wrel.add_argument("--relation", required=True,
                      choices=["about", "mentions", "evidence_for", "relates_to",
                               "parent_of", "depends_on", "blocks", "solves", "caused_by",
                               "supersedes", "invalidates", "implements", "changes",
                               "documents", "contradicts"])
    wrel.add_argument("--evidence-chunk", type=int, default=None)
    wrel.add_argument("--confidence", type=float, default=1.0)
    wrel.set_defaults(func=cmd_write_relation)

    idoc = sub.add_parser(
        "ingest-docs",
        help=(
            "Chunk + incrementally sync committed markdown docs into "
            "sources/chunks/index_docs/memory_vec (requires Git and a clean "
            "managed corpus; --dry-run previews without either)"
        ),
    )
    idoc.add_argument(
        "--paths",
        nargs="+",
        default=None,
        help=(
            "Explicit managed files and/or directories to ingest (directories "
            "expand to their managed **/*.md); narrows the default selection, "
            "never widens it — entries outside the managed corpus or crossing "
            "a symlink are an error"
        ),
    )
    idoc.add_argument(
        "--external-root",
        default=None,
        help=(
            "Explicit owner-approved external git archive; ingests exactly its tracked Markdown "
            "files as low-authority source chunks into this repo's one memory DB"
        ),
    )
    idoc.add_argument("--dry-run", action="store_true", help="Print the plan and exit without writing")
    idoc.add_argument("--no-prune", action="store_true", help="Skip removing sources rows for files missing on disk")
    idoc.set_defaults(func=cmd_ingest_docs)

    vdoc = sub.add_parser(
        "verify-doc-index",
        help=(
            "Verify document source/chunk/FTS/vector/embedding coverage against "
            "the committed corpus (requires Git; an empty corpus verifies ok "
            "with corpus_empty=true)"
        ),
    )
    vdoc.add_argument(
        "--external-root",
        default=None,
        help="Verify exactly the tracked Markdown files of this explicit external git archive",
    )
    vdoc.set_defaults(func=cmd_verify_doc_index)

    return ap


def main() -> None:
    ap = build_parser()
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except sqlite3.IntegrityError as e:
        die(f"integrity error: {e}", where="sqlite")
    except sqlite3.OperationalError as e:
        die(f"operational error: {e}", where="sqlite")
    except KeyboardInterrupt:
        die("interrupted", where="signal", code=130)
