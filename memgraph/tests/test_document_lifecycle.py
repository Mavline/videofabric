from __future__ import annotations

import importlib.util
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, Tuple
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "memgraph.py"
SCHEMA = Path(__file__).resolve().parents[1] / "sql" / "schema.sql"
SPEC = importlib.util.spec_from_file_location("memgraph_lifecycle_under_test", SCRIPT)
assert SPEC and SPEC.loader
MEMGRAPH = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MEMGRAPH
SPEC.loader.exec_module(MEMGRAPH)

_REAL_CONNECT = MEMGRAPH.connect
_VEC_STANZA = re.compile(r"CREATE VIRTUAL TABLE memory_vec USING vec0\([^;]*\);")


def _fake_embed_batch(texts):
    return [[0.0] * 512 for _ in texts]


def _test_connect(db_path, need_vec=False):
    """Real engine connection, but with a passthrough vec_f32 so the plain
    memory_vec stand-in table accepts vector inserts without sqlite-vec."""
    conn = _REAL_CONNECT(db_path, need_vec=False)
    conn.create_function("vec_f32", 1, lambda payload: payload)
    return conn


def _git(root: Path, *args: str) -> None:
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=Memgraph Test",
            "-c",
            "user.email=memgraph-test@example.invalid",
            *args,
        ],
        cwd=root,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class ThematicClassificationTests(unittest.TestCase):
    def test_docs_knowledge_is_thematic_doc(self) -> None:
        self.assertEqual(
            MEMGRAPH._ingest_classify_source("docs/knowledge/authentication.md"),
            ("thematic_doc", "project_doc"),
        )
        self.assertEqual(
            MEMGRAPH._ingest_classify_source("docs/knowledge/nested/storage-findings.md"),
            ("thematic_doc", "project_doc"),
        )
        self.assertEqual(
            MEMGRAPH._ingest_classify_source("docs/evidence/run-42.md"),
            ("evidence", "project_doc"),
        )
        self.assertEqual(
            MEMGRAPH._ingest_classify_source("docs/spec.md"),
            ("strategic_doc", "project_doc"),
        )
        self.assertEqual(
            MEMGRAPH._ingest_classify_source("AGENTS.md"),
            ("runtime_prompt", "policies"),
        )

    def test_thematic_doc_keeps_full_recall_authority(self) -> None:
        ranked = MEMGRAPH._rank_recall_scores(
            [(10, 0.04)], {10: {"source_role": "thematic_doc"}}
        )

        self.assertEqual(ranked, [(10, 0.04, 0.04, 1.0)])


class VerifierContractTests(unittest.TestCase):
    """Pin the empty-corpus / tombstone / dirty-tree contract of _verify_doc_index."""

    REPO_ROOT = Path("/tmp/target-repo")

    def _connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        conn.executescript(
            """
            CREATE TABLE sources(
              id INTEGER PRIMARY KEY,
              path TEXT NOT NULL UNIQUE,
              source_role TEXT NOT NULL,
              source_category TEXT NOT NULL,
              content_hash TEXT NOT NULL,
              imported_at INTEGER NOT NULL
            );
            CREATE TABLE chunks(
              id INTEGER PRIMARY KEY,
              object_id INTEGER NOT NULL UNIQUE,
              source_id INTEGER NOT NULL,
              heading_path TEXT NOT NULL,
              body TEXT NOT NULL,
              extraction_status TEXT NOT NULL,
              content_hash TEXT NOT NULL
            );
            CREATE TABLE index_docs(
              object_id INTEGER PRIMARY KEY,
              embedding_text TEXT NOT NULL,
              embedding_text_hash TEXT NOT NULL
            );
            CREATE TABLE embedding_meta(
              object_id INTEGER PRIMARY KEY,
              embedding_text_hash TEXT NOT NULL,
              model TEXT NOT NULL,
              dimensions INTEGER NOT NULL
            );
            CREATE TABLE memory_vec(embedding TEXT);
            CREATE TABLE memory_fts(title TEXT);
            CREATE TABLE relations(
              source_object_id INTEGER,
              target_object_id INTEGER,
              relation TEXT,
              status TEXT,
              evidence_chunk_id INTEGER
            );
            CREATE TABLE claims(primary_evidence_chunk_id INTEGER);
            CREATE TABLE decisions(primary_evidence_chunk_id INTEGER);
            CREATE TABLE tasks(primary_evidence_chunk_id INTEGER);
            CREATE TABLE events(primary_evidence_chunk_id INTEGER);
            """
        )
        return conn

    def _add_active_source(
        self, conn: sqlite3.Connection, source_id: int, path: str, object_id: int
    ) -> None:
        role, category = MEMGRAPH._ingest_classify_source(path)
        heading_path = "Topic"
        body = "alpha"
        chunk_hash = MEMGRAPH.sha256_text(f"{heading_path}\n{body}")
        embedding_text = MEMGRAPH._ingest_chunk_embedding_text(path, heading_path, body)
        embedding_hash = MEMGRAPH.sha256_text(embedding_text)
        conn.execute(
            "INSERT INTO sources VALUES (?,?,?,?,?,?)",
            (source_id, path, role, category, "file-hash", 1),
        )
        conn.execute(
            "INSERT INTO chunks VALUES (?,?,?,?,?,?,?)",
            (source_id, object_id, source_id, heading_path, body, "parsed_structural", chunk_hash),
        )
        conn.execute(
            "INSERT INTO index_docs VALUES (?,?,?)",
            (object_id, embedding_text, embedding_hash),
        )
        conn.execute(
            "INSERT INTO embedding_meta VALUES (?,?,?,?)",
            (object_id, embedding_hash, "text-embedding-3-small", 512),
        )
        conn.execute(
            "INSERT INTO memory_vec(rowid, embedding) VALUES (?, 'vector')", (object_id,)
        )
        conn.execute(
            "INSERT INTO memory_fts(rowid, title) VALUES (?, 'Topic')", (object_id,)
        )

    def _add_tombstone_source(
        self,
        conn: sqlite3.Connection,
        source_id: int,
        path: str,
        object_id: int,
        *,
        referenced: bool = True,
        leftover_fts: bool = False,
    ) -> None:
        conn.execute(
            "INSERT INTO sources VALUES (?,?,?,?,?,?)",
            (source_id, path, "thematic_doc", "project_doc", "old-hash", 1),
        )
        conn.execute(
            "INSERT INTO chunks VALUES (?,?,?,?,?,?,?)",
            (source_id, object_id, source_id, "Topic", "alpha", "ignored", "chunk-hash"),
        )
        if referenced:
            conn.execute(
                "INSERT INTO relations VALUES (?,?,?,?,?)",
                (object_id, object_id, "mentions", "active", None),
            )
        if leftover_fts:
            conn.execute(
                "INSERT INTO memory_fts(rowid, title) VALUES (?, 'stale')", (object_id,)
            )

    def test_empty_db_verifies_ok_with_corpus_empty(self) -> None:
        conn = self._connection()

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertTrue(result["ok"])
        self.assertTrue(result["corpus_empty"])
        self.assertEqual(result["expected_sources"], 0)
        self.assertEqual(result["unexpected_sources"], [])
        self.assertEqual(result["retained_evidence_sources"], [])
        self.assertEqual(result["dirty_managed_paths"], [])

    def test_empty_expected_with_active_leftover_fails(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/stale.md", 42)

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertTrue(result["corpus_empty"])
        self.assertEqual(result["unexpected_sources"], ["docs/knowledge/stale.md"])

    def test_empty_expected_with_orphan_source_fails(self) -> None:
        conn = self._connection()
        conn.execute(
            "INSERT INTO sources VALUES (1, 'docs/orphan.md', 'strategic_doc', 'project_doc', 'h', 1)"
        )

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertEqual(result["unexpected_sources"], ["docs/orphan.md"])

    def test_valid_evidence_tombstone_passes_empty_corpus(self) -> None:
        conn = self._connection()
        self._add_tombstone_source(conn, 1, "docs/knowledge/removed.md", 42)

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertTrue(result["ok"])
        self.assertTrue(result["corpus_empty"])
        self.assertEqual(result["unexpected_sources"], [])
        self.assertEqual(result["retained_evidence_sources"], ["docs/knowledge/removed.md"])
        self.assertEqual(result["retained_evidence_chunks"], [42])
        self.assertEqual(result["invalid_evidence_tombstones"], [])

    def test_tombstone_with_leftover_projection_fails(self) -> None:
        conn = self._connection()
        self._add_tombstone_source(
            conn, 1, "docs/knowledge/removed.md", 42, leftover_fts=True
        )

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertEqual(
            result["invalid_evidence_tombstones"], ["docs/knowledge/removed.md"]
        )
        self.assertEqual(result["retained_evidence_sources"], [])

    def test_tombstone_without_reference_fails(self) -> None:
        conn = self._connection()
        self._add_tombstone_source(
            conn, 1, "docs/knowledge/removed.md", 42, referenced=False
        )

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertEqual(
            result["invalid_evidence_tombstones"], ["docs/knowledge/removed.md"]
        )

    def test_partially_active_leftover_is_unexpected(self) -> None:
        conn = self._connection()
        self._add_tombstone_source(conn, 1, "docs/knowledge/mixed.md", 42)
        conn.execute(
            "INSERT INTO chunks VALUES (2, 43, 1, 'Live', 'beta', 'parsed_structural', 'h2')"
        )

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertEqual(result["unexpected_sources"], ["docs/knowledge/mixed.md"])
        self.assertEqual(result["retained_evidence_sources"], [])

    def test_out_of_scope_repo_source_is_rejected(self) -> None:
        # A repo-relative source outside the managed corpus (smuggled in by an
        # old permissive --paths or a resolved symlink) must fail verification,
        # not fall outside the audited scope.
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)
        self._add_active_source(conn, 2, "private/uncommitted.md", 43)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["unexpected_sources"], ["private/uncommitted.md"])

    def test_out_of_scope_tombstone_gets_no_leniency(self) -> None:
        # Evidence-tombstone retention exists for previously managed documents.
        # A tombstone-shaped source outside the managed corpus is still an
        # unexpected source, never a retained one.
        conn = self._connection()
        self._add_tombstone_source(conn, 1, "private/old.md", 42)

        result = MEMGRAPH._verify_doc_index(conn, [], repo_root=self.REPO_ROOT)

        self.assertFalse(result["ok"])
        self.assertEqual(result["unexpected_sources"], ["private/old.md"])
        self.assertEqual(result["retained_evidence_sources"], [])
        self.assertEqual(result["invalid_evidence_tombstones"], [])

    def _add_section_tombstone(
        self,
        conn: sqlite3.Connection,
        source_id: int,
        object_id: int,
        *,
        referenced: bool = True,
        leftover_fts: bool = False,
    ) -> None:
        conn.execute(
            "INSERT INTO chunks VALUES (?,?,?,?,?,?,?)",
            (
                object_id,
                object_id,
                source_id,
                "Removed section",
                "old body",
                "ignored",
                "old-chunk-hash",
            ),
        )
        if referenced:
            conn.execute(
                "INSERT INTO relations VALUES (?,?,?,?,?)",
                (object_id, object_id, "mentions", "active", None),
            )
        if leftover_fts:
            conn.execute(
                "INSERT INTO memory_fts(rowid, title) VALUES (?, 'stale')", (object_id,)
            )

    def test_valid_section_tombstone_in_live_source_passes(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)
        self._add_section_tombstone(conn, 1, 43)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["retained_evidence_chunks"], [43])
        self.assertEqual(result["retained_evidence_sources"], [])
        self.assertEqual(result["invalid_evidence_tombstones"], [])

    def test_section_tombstone_with_stale_projection_fails(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)
        self._add_section_tombstone(conn, 1, 43, leftover_fts=True)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(
            result["invalid_evidence_tombstones"], ["docs/knowledge/topic.md"]
        )

    def test_unreferenced_section_tombstone_fails(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)
        self._add_section_tombstone(conn, 1, 43, referenced=False)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(
            result["invalid_evidence_tombstones"], ["docs/knowledge/topic.md"]
        )

    def test_dirty_managed_paths_fail_separately(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
            dirty_managed_paths=["docs/knowledge/topic.md"],
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["dirty_managed_paths"], ["docs/knowledge/topic.md"])
        self.assertEqual(result["unexpected_sources"], [])

    def test_nonempty_corpus_still_verifies(self) -> None:
        conn = self._connection()
        self._add_active_source(conn, 1, "docs/knowledge/topic.md", 42)

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["docs/knowledge/topic.md"],
            expected_source_hashes={"docs/knowledge/topic.md": "file-hash"},
            repo_root=self.REPO_ROOT,
        )

        self.assertTrue(result["ok"])
        self.assertFalse(result["corpus_empty"])
        self.assertEqual(result["source_role_mismatches"], [])
        self.assertEqual(result["retained_evidence_sources"], [])


class EndToEndLifecycleTests(unittest.TestCase):
    """Run the real ingest-docs / verify-doc-index commands against a temp repo
    with stubbed embeddings and a plain-table memory_vec stand-in."""

    def setUp(self) -> None:
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        self.repo = Path(td.name).resolve()

        env_patch = mock.patch.dict(os.environ, {}, clear=False)
        env_patch.start()
        self.addCleanup(env_patch.stop)
        os.environ["MEMGRAPH_REPO_ROOT"] = str(self.repo)
        os.environ.pop("MEMGRAPH_DB", None)
        os.environ.pop("SQLITE_VEC_PATH", None)

        self.embed = mock.patch.object(
            MEMGRAPH, "call_embed_batch", side_effect=_fake_embed_batch
        ).start()
        self.addCleanup(mock.patch.stopall)
        mock.patch.object(MEMGRAPH, "connect", side_effect=_test_connect).start()

        self._create_db()

    def _create_db(self) -> None:
        schema_sql = SCHEMA.read_text(encoding="utf-8")
        schema_sql, n_replaced = _VEC_STANZA.subn(
            "CREATE TABLE memory_vec(embedding TEXT);", schema_sql
        )
        assert n_replaced == 1, "memory_vec vec0 stanza not found in schema.sql"
        db = self.repo / ".agent" / "memory.db"
        db.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db)
        conn.executescript(schema_sql)
        conn.commit()
        conn.close()

    def _db(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.repo / ".agent" / "memory.db")
        self.addCleanup(conn.close)
        return conn

    def _write(self, rel: str, text: str) -> Path:
        path = self.repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def _commit_all(self, message: str = "fixture") -> None:
        _git(self.repo, "add", "-A")
        _git(self.repo, "commit", "-qm", message)

    def _run_cli(self, *argv: str) -> Dict[str, Any]:
        args = MEMGRAPH.build_parser().parse_args(list(argv))
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            args.func(args)
        return json.loads(out.getvalue())

    def _run_cli_expect_exit(self, *argv: str) -> Tuple[Dict[str, Any], int]:
        args = MEMGRAPH.build_parser().parse_args(list(argv))
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            with self.assertRaises(SystemExit) as ctx:
                args.func(args)
        payload = json.loads(out.getvalue()) if out.getvalue().strip() else {}
        return payload, int(ctx.exception.code or 0)

    def _sources(self) -> Dict[str, Tuple[str, str]]:
        return {
            str(path): (str(role), str(category))
            for path, role, category in self._db().execute(
                "SELECT path, source_role, source_category FROM sources"
            ).fetchall()
        }

    def test_empty_repo_bootstrap_state_verifies_ok(self) -> None:
        _git(self.repo, "init", "-q")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["files_scanned"], 0)
        self.assertTrue(ingest["git_available"])
        self.assertTrue(ingest["committable"])
        self.assertTrue(verify["ok"])
        self.assertTrue(verify["corpus_empty"])

    def test_ingest_classifies_knowledge_channel_and_verifies(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("AGENTS.md", "# Agents\n\nRules body.\n")
        self._write(
            "docs/knowledge/auth.md",
            "# Auth\n\nIntro.\n\n## Findings\n\nSession cookies expire.\n",
        )
        self._commit_all()

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["files_new"], 2)
        sources = self._sources()
        self.assertEqual(sources["AGENTS.md"], ("runtime_prompt", "policies"))
        self.assertEqual(
            sources["docs/knowledge/auth.md"], ("thematic_doc", "project_doc")
        )
        self.assertTrue(verify["ok"])
        self.assertFalse(verify["corpus_empty"])

    def test_unchanged_file_is_reclassified_without_reembedding(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        db = self._db()
        db.execute("UPDATE sources SET source_role='strategic_doc'")
        db.commit()
        before_meta = db.execute(
            "SELECT object_id, embedded_at FROM embedding_meta ORDER BY object_id"
        ).fetchall()
        self.embed.reset_mock()

        result = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertEqual(result["files_reclassified"], 1)
        self.assertEqual(result["files_unchanged"], 1)
        self.assertEqual(self.embed.call_count, 0)
        self.assertEqual(
            self._sources()["docs/knowledge/auth.md"], ("thematic_doc", "project_doc")
        )
        after_meta = db.execute(
            "SELECT object_id, embedded_at FROM embedding_meta ORDER BY object_id"
        ).fetchall()
        self.assertEqual(before_meta, after_meta)
        self.assertTrue(verify["ok"])

    def test_changed_file_is_reclassified_and_reingested(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        db = self._db()
        db.execute("UPDATE sources SET source_role='strategic_doc'")
        db.commit()
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n\n## New\n\nMore.\n")
        self._commit_all("edit")

        result = self._run_cli("ingest-docs")

        self.assertEqual(result["files_reclassified"], 1)
        self.assertEqual(result["files_changed"], 1)
        self.assertEqual(
            self._sources()["docs/knowledge/auth.md"], ("thematic_doc", "project_doc")
        )
        self.assertTrue(self._run_cli("verify-doc-index")["ok"])

    def test_category_change_rewrites_tags_without_reembedding(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        db = self._db()
        object_id = int(
            db.execute("SELECT object_id FROM chunks LIMIT 1").fetchone()[0]
        )
        db.execute("UPDATE sources SET source_role='doc', source_category='other'")
        db.execute(
            "UPDATE index_docs SET tags='doc-chunk,other,docs' WHERE object_id=?",
            (object_id,),
        )
        db.commit()
        before_meta = db.execute(
            "SELECT embedded_at FROM embedding_meta WHERE object_id=?", (object_id,)
        ).fetchone()
        self.embed.reset_mock()

        result = self._run_cli("ingest-docs")

        self.assertEqual(result["files_reclassified"], 1)
        self.assertEqual(self.embed.call_count, 0)
        tags = db.execute(
            "SELECT tags FROM index_docs WHERE object_id=?", (object_id,)
        ).fetchone()[0]
        fts_tags = db.execute(
            "SELECT tags FROM memory_fts WHERE rowid=?", (object_id,)
        ).fetchone()[0]
        self.assertEqual(tags, "doc-chunk,project_doc,docs")
        self.assertEqual(fts_tags, "doc-chunk,project_doc,docs")
        after_meta = db.execute(
            "SELECT embedded_at FROM embedding_meta WHERE object_id=?", (object_id,)
        ).fetchone()
        self.assertEqual(before_meta, after_meta)

    def test_untracked_managed_file_blocks_ingest_but_not_dry_run(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/committed.md", "# Committed\n\nBody.\n")
        self._commit_all()
        self._write("docs/knowledge/new.md", "# New\n\nDraft.\n")

        payload, code = self._run_cli_expect_exit("ingest-docs")
        dry = self._run_cli("ingest-docs", "--dry-run")

        self.assertEqual(code, 2)
        self.assertFalse(payload["ok"])
        self.assertIn("docs/knowledge/new.md", payload["error"])
        self.assertTrue(dry["ok"])
        self.assertFalse(dry["committable"])
        self.assertEqual(dry["dirty_managed_paths"], ["docs/knowledge/new.md"])

    def test_modified_tracked_file_blocks_until_committed(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        self._write("docs/knowledge/auth.md", "# Auth\n\nEdited.\n")

        _payload, code = self._run_cli_expect_exit("ingest-docs")
        self.assertEqual(code, 2)

        self._commit_all("edit")
        result = self._run_cli("ingest-docs")
        self.assertTrue(result["ok"])
        self.assertEqual(result["files_changed"], 1)

    def test_uncommitted_deletion_blocks_ingest(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        (self.repo / "docs/knowledge/auth.md").unlink()

        payload, code = self._run_cli_expect_exit("ingest-docs")

        self.assertEqual(code, 2)
        self.assertIn("docs/knowledge/auth.md", payload["error"])

    def test_uncommitted_rename_blocks_then_move_reindexes(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/old-name.md", "# Topic\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        _git(self.repo, "mv", "docs/knowledge/old-name.md", "docs/knowledge/new-name.md")

        dry = self._run_cli("ingest-docs", "--dry-run")
        _payload, code = self._run_cli_expect_exit("ingest-docs")

        self.assertEqual(code, 2)
        self.assertFalse(dry["committable"])
        self.assertIn("docs/knowledge/new-name.md", dry["dirty_managed_paths"])
        self.assertIn("docs/knowledge/old-name.md", dry["dirty_managed_paths"])

        self._commit_all("rename")
        result = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(result["ok"])
        sources = self._sources()
        self.assertIn("docs/knowledge/new-name.md", sources)
        self.assertNotIn("docs/knowledge/old-name.md", sources)
        self.assertTrue(verify["ok"])

    def test_no_git_blocks_production_but_allows_dry_run(self) -> None:
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")

        payload, code = self._run_cli_expect_exit("ingest-docs")
        dry = self._run_cli("ingest-docs", "--dry-run")
        verify_payload, verify_code = self._run_cli_expect_exit("verify-doc-index")

        self.assertEqual(code, 2)
        self.assertIn("Git", payload["error"])
        self.assertTrue(dry["ok"])
        self.assertFalse(dry["git_available"])
        self.assertFalse(dry["committable"])
        self.assertEqual(verify_code, 2)
        self.assertFalse(verify_payload["ok"])

    def test_untracked_ignored_file_is_excluded_and_listed(self) -> None:
        _git(self.repo, "init", "-q")
        self._write(".gitignore", "docs/knowledge/tmp-*.md\n")
        self._write("docs/knowledge/keep.md", "# Keep\n\nBody.\n")
        self._commit_all()
        self._write("docs/knowledge/tmp-scratch.md", "# Scratch\n\nDraft.\n")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertTrue(ingest["committable"])
        self.assertEqual(
            ingest["ignored_managed_paths"], ["docs/knowledge/tmp-scratch.md"]
        )
        self.assertNotIn("docs/knowledge/tmp-scratch.md", self._sources())
        self.assertIn("docs/knowledge/keep.md", self._sources())
        self.assertTrue(verify["ok"])
        self.assertEqual(
            verify["ignored_managed_paths"], ["docs/knowledge/tmp-scratch.md"]
        )

    def test_tracked_file_matching_ignore_rule_stays_indexed(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/pinned.md", "# Pinned\n\nBody.\n")
        _git(self.repo, "add", "-f", "docs/knowledge/pinned.md")
        self._write(".gitignore", "docs/knowledge/pinned.md\n")
        self._commit_all()

        ingest = self._run_cli("ingest-docs")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["ignored_managed_paths"], [])
        self.assertEqual(ingest["dirty_managed_paths"], [])
        self.assertIn("docs/knowledge/pinned.md", self._sources())

    def test_directory_gitignore_rule_excludes_contained_files(self) -> None:
        _git(self.repo, "init", "-q")
        self._write(".gitignore", "docs/knowledge/\n")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._commit_all()
        self._write("docs/knowledge/private.md", "# Private\n\nDraft.\n")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertTrue(ingest["committable"])
        self.assertEqual(
            ingest["ignored_managed_paths"], ["docs/knowledge/private.md"]
        )
        self.assertNotIn("docs/knowledge/private.md", self._sources())
        self.assertIn("docs/spec.md", self._sources())
        self.assertTrue(verify["ok"])
        self.assertEqual(
            verify["ignored_managed_paths"], ["docs/knowledge/private.md"]
        )

    def test_ignored_agent_dir_excludes_task_specs(self) -> None:
        _git(self.repo, "init", "-q")
        self._write(".gitignore", ".agent/\n")
        self._write("AGENTS.md", "# Agents\n\nRules.\n")
        self._commit_all()
        self._write(".agent/tasks/WF-9/spec.md", "# Task\n\nFrozen.\n")

        ingest = self._run_cli("ingest-docs")

        self.assertTrue(ingest["ok"])
        self.assertTrue(ingest["committable"])
        self.assertEqual(
            ingest["ignored_managed_paths"], [".agent/tasks/WF-9/spec.md"]
        )
        self.assertNotIn(".agent/tasks/WF-9/spec.md", self._sources())
        self.assertIn("AGENTS.md", self._sources())

    def _symlink_at(self, link: Path, target: str) -> None:
        link.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.symlink(target, link)
        except OSError as exc:  # e.g. Windows without symlink privilege
            self.skipTest(f"cannot create symlinks here: {exc}")

    def _symlink(self, rel: str, target: str) -> None:
        self._symlink_at(self.repo / rel, target)

    def test_ignored_symlink_to_untracked_target_is_not_indexed(self) -> None:
        # An ignored symlink must not smuggle its (uncommitted) target into the
        # corpus under the target's resolved name.
        _git(self.repo, "init", "-q")
        self._write(".gitignore", "docs/knowledge/\n")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._commit_all()
        self._write("private/uncommitted.md", "# Leak\n\nSecret.\n")
        self._symlink("docs/knowledge/leak.md", "../../private/uncommitted.md")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertTrue(ingest["committable"])
        self.assertEqual(
            ingest["symlinked_managed_paths"], ["docs/knowledge/leak.md"]
        )
        self.assertNotIn("private/uncommitted.md", self._sources())
        self.assertNotIn("docs/knowledge/leak.md", self._sources())
        self.assertIn("docs/spec.md", self._sources())
        self.assertTrue(verify["ok"])
        self.assertEqual(
            verify["symlinked_managed_paths"], ["docs/knowledge/leak.md"]
        )

    def test_tracked_symlink_to_untracked_target_is_not_indexed(self) -> None:
        # Git commits the link itself, not the target bytes: a clean tracked
        # symlink still must not put its untracked target's content into the
        # committed memory.db.
        _git(self.repo, "init", "-q")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._write("private/uncommitted.md", "# Leak\n\nSecret.\n")
        self._symlink("docs/link.md", "../private/uncommitted.md")
        _git(self.repo, "add", "docs")
        _git(self.repo, "commit", "-qm", "tracked symlink")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertTrue(ingest["committable"])
        self.assertEqual(ingest["symlinked_managed_paths"], ["docs/link.md"])
        self.assertNotIn("private/uncommitted.md", self._sources())
        self.assertNotIn("docs/link.md", self._sources())
        self.assertIn("docs/spec.md", self._sources())
        self.assertTrue(verify["ok"])
        self.assertEqual(verify["symlinked_managed_paths"], ["docs/link.md"])

    def test_symlinked_directory_component_is_not_indexed(self) -> None:
        # A symlinked directory inside the managed tree must not leak the
        # target directory's files into the corpus under either name, and the
        # directory itself must be listed: file selection never descends into
        # it, so no per-file candidate would otherwise report the exclusion.
        _git(self.repo, "init", "-q")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._commit_all()
        self._write("private/x.md", "# Leak\n\nSecret.\n")
        self._symlink("docs/knowledge", "../private")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["symlinked_managed_paths"], ["docs/knowledge"])
        sources = self._sources()
        self.assertNotIn("docs/knowledge/x.md", sources)
        self.assertNotIn("private/x.md", sources)
        self.assertEqual(sorted(sources), ["docs/spec.md"])
        self.assertTrue(verify["ok"])
        self.assertEqual(verify["symlinked_managed_paths"], ["docs/knowledge"])

    def test_file_replaced_by_outward_symlink_is_pruned_everywhere(self) -> None:
        # Transition: a committed, indexed regular file later becomes a
        # tracked symlink pointing outside the corpus. The stored source key
        # must keep belonging to its namespace LEXICALLY, so prune removes it
        # and a pre-prune verify fails it — resolving against the current disk
        # would let the stale chunk keep serving deleted text via recall.
        _git(self.repo, "init", "-q")
        self._write("docs/topic.md", "# Topic\n\nOld searchable token ALPHA-STALE.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        self.assertIn("docs/topic.md", self._sources())

        (self.repo / "docs/topic.md").unlink()
        self._write("private/secret.md", "# New\n\nUncommitted target.\n")
        self._symlink("docs/topic.md", "../private/secret.md")
        _git(self.repo, "add", "docs")
        _git(self.repo, "commit", "-qm", "replace file with symlink")

        stale_verify, code = self._run_cli_expect_exit("verify-doc-index")
        self.assertEqual(code, 1)
        self.assertEqual(stale_verify["unexpected_sources"], ["docs/topic.md"])

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["files_pruned"], 1)
        self.assertEqual(ingest["symlinked_managed_paths"], ["docs/topic.md"])
        self.assertNotIn("docs/topic.md", self._sources())
        self.assertEqual(
            self._db().execute("SELECT COUNT(*) FROM index_docs").fetchone()[0], 0
        )
        self.assertTrue(verify["ok"])
        self.assertTrue(verify["corpus_empty"])

    def test_external_file_replaced_by_outward_symlink_is_pruned_and_flagged(self) -> None:
        # Transition in an external archive: a tracked, indexed regular file
        # later becomes a tracked symlink pointing outside the archive. The
        # stored absolute key must keep belonging to the archive namespace
        # lexically: verify must flag the stale source even when the archive
        # revision matches, and prune must remove it.
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        base = Path(td.name).resolve()
        archive = base / "archive"
        outside = base / "outside"
        archive.mkdir()
        outside.mkdir()
        (outside / "secret.md").write_text(
            "# Outside\n\nUncommitted bytes.\n", encoding="utf-8"
        )
        _git(archive, "init", "-q")
        (archive / "leak.md").write_text(
            "# Leak\n\nOld searchable token ALPHA-STALE.\n", encoding="utf-8"
        )
        (archive / "keep.md").write_text("# Keep\n\nStays tracked.\n", encoding="utf-8")
        _git(archive, "add", "-A")
        _git(archive, "commit", "-qm", "archive fixture")

        first = self._run_cli("ingest-docs", "--external-root", str(archive))
        leak_key = str(archive / "leak.md")
        self.assertTrue(first["ok"])
        self.assertIn(leak_key, self._sources())

        (archive / "leak.md").unlink()
        self._symlink_at(archive / "leak.md", str(outside / "secret.md"))
        _git(archive, "add", "-A")
        _git(archive, "commit", "-qm", "replace file with outward symlink")

        # Defence in depth: even if pruning is skipped, verify must fail the
        # stale source — with the recorded revision already matching the new
        # HEAD, exactly the state that used to verify ok.
        self._run_cli("ingest-docs", "--external-root", str(archive), "--no-prune")
        stale, code = self._run_cli_expect_exit(
            "verify-doc-index", "--external-root", str(archive)
        )
        self.assertEqual(code, 1)
        self.assertTrue(stale["external_revision_matches"])
        self.assertIn(leak_key, stale["unexpected_sources"])

        cleanup = self._run_cli("ingest-docs", "--external-root", str(archive))
        verify = self._run_cli("verify-doc-index", "--external-root", str(archive))

        self.assertEqual(cleanup["files_pruned"], 1)
        self.assertNotIn(leak_key, self._sources())
        self.assertTrue(verify["ok"])

    def test_paths_outside_managed_corpus_dies(self) -> None:
        # --paths narrows the managed selection; it must never widen the
        # corpus past the Git gate's and the verifier's managed scope.
        _git(self.repo, "init", "-q")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._write("README.md", "# Readme\n\nCommitted but unmanaged.\n")
        self._commit_all()
        self._write("private/uncommitted.md", "# Leak\n\nSecret.\n")

        for entry in ("private/uncommitted.md", "README.md"):
            payload, code = self._run_cli_expect_exit(
                "ingest-docs", "--paths", str(self.repo / entry), "--no-prune"
            )
            self.assertEqual(code, 2)
            self.assertIn("outside the managed document corpus", payload["error"])
        self.assertEqual(self._sources(), {})

    def test_paths_symlink_entry_dies(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/spec.md", "# Spec\n\nBody.\n")
        self._commit_all()
        self._write("private/uncommitted.md", "# Leak\n\nSecret.\n")
        self._symlink("docs/link.md", "../private/uncommitted.md")

        payload, code = self._run_cli_expect_exit(
            "ingest-docs", "--paths", str(self.repo / "docs/link.md"), "--no-prune"
        )

        self.assertEqual(code, 2)
        self.assertIn("symlink", payload["error"])
        self.assertEqual(self._sources(), {})

    def test_removed_section_leaves_tombstone_and_stale_projection_fails(self) -> None:
        _git(self.repo, "init", "-q")
        self._write(
            "docs/knowledge/topic.md",
            "# Topic\n\nIntro body.\n\n## Finding\n\nPinned finding.\n",
        )
        self._commit_all()
        self._run_cli("ingest-docs")
        db = self._db()
        object_id = int(
            db.execute(
                "SELECT object_id FROM chunks WHERE heading_path LIKE '%Finding%'"
            ).fetchone()[0]
        )
        db.execute(
            """
            INSERT INTO relations(source_object_id, relation, target_object_id, created_at)
            VALUES (?, 'mentions', ?, 1)
            """,
            (object_id, object_id),
        )
        db.commit()
        self._write("docs/knowledge/topic.md", "# Topic\n\nIntro body.\n")
        self._commit_all("drop section")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertEqual(ingest["chunks_deindexed_kept"], 1)
        self.assertTrue(verify["ok"])
        self.assertFalse(verify["corpus_empty"])
        self.assertIn(object_id, verify["retained_evidence_chunks"])
        self.assertEqual(verify["retained_evidence_sources"], [])

        db.execute(
            """
            INSERT INTO memory_fts(rowid, object_type, title, summary, body, tags, aliases)
            VALUES (?, 'chunk', 'stale', '', '', '', '')
            """,
            (object_id,),
        )
        db.commit()

        payload, code = self._run_cli_expect_exit("verify-doc-index")

        self.assertEqual(code, 1)
        self.assertFalse(payload["ok"])
        self.assertEqual(
            payload["invalid_evidence_tombstones"], ["docs/knowledge/topic.md"]
        )

    def test_deleting_last_document_returns_to_empty_corpus(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/only.md", "# Only\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        _git(self.repo, "rm", "-q", "docs/knowledge/only.md")
        self._commit_all("remove")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["files_pruned"], 1)
        self.assertEqual(self._sources(), {})
        self.assertTrue(verify["ok"])
        self.assertTrue(verify["corpus_empty"])

    def test_deleted_document_with_evidence_leaves_valid_tombstone(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/evidence-note.md", "# Note\n\nPinned finding.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        db = self._db()
        object_id = int(
            db.execute("SELECT object_id FROM chunks LIMIT 1").fetchone()[0]
        )
        db.execute(
            """
            INSERT INTO relations(source_object_id, relation, target_object_id, created_at)
            VALUES (?, 'mentions', ?, 1)
            """,
            (object_id, object_id),
        )
        db.commit()
        _git(self.repo, "rm", "-q", "docs/knowledge/evidence-note.md")
        self._commit_all("remove")

        ingest = self._run_cli("ingest-docs")
        verify = self._run_cli("verify-doc-index")

        self.assertTrue(ingest["ok"])
        self.assertEqual(ingest["chunks_deindexed_kept"], 1)
        self.assertTrue(verify["ok"])
        self.assertTrue(verify["corpus_empty"])
        self.assertEqual(
            verify["retained_evidence_sources"], ["docs/knowledge/evidence-note.md"]
        )
        self.assertEqual(verify["retained_evidence_chunks"], [object_id])

    def test_verify_reports_dirty_corpus_distinctly(self) -> None:
        _git(self.repo, "init", "-q")
        self._write("docs/knowledge/auth.md", "# Auth\n\nBody.\n")
        self._commit_all()
        self._run_cli("ingest-docs")
        self._write("docs/knowledge/auth.md", "# Auth\n\nUncommitted edit.\n")

        payload, code = self._run_cli_expect_exit("verify-doc-index")

        self.assertEqual(code, 1)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["dirty_managed_paths"], ["docs/knowledge/auth.md"])
        self.assertNotIn("docs/knowledge/auth.md", payload["unexpected_sources"])


if __name__ == "__main__":
    unittest.main()
