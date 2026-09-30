from __future__ import annotations

import importlib.util
import io
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "memgraph.py"
SPEC = importlib.util.spec_from_file_location("memgraph_cli_under_test", SCRIPT)
assert SPEC and SPEC.loader
MEMGRAPH = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MEMGRAPH
SPEC.loader.exec_module(MEMGRAPH)


class ExternalMemoryArchiveSelectionTests(unittest.TestCase):
    def _tracked_markdown_repo(self, root: Path) -> None:
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        (root / "nested").mkdir()
        (root / "MEMORY.md").write_text("# Memory\n\nalpha\n", encoding="utf-8")
        (root / "nested" / "rollout.md").write_text("# Rollout\n\nbeta\n", encoding="utf-8")
        (root / "untracked.md").write_text("# Ignore\n", encoding="utf-8")
        (root / "notes.txt").write_text("not markdown\n", encoding="utf-8")
        subprocess.run(
            ["git", "add", "MEMORY.md", "nested/rollout.md", "notes.txt"],
            cwd=root,
            check=True,
        )
        subprocess.run(
            [
                "git",
                "-c",
                "user.name=Memgraph Test",
                "-c",
                "user.email=memgraph-test@example.invalid",
                "commit",
                "-qm",
                "fixture",
            ],
            cwd=root,
            check=True,
        )

    def test_parser_accepts_explicit_external_archive_and_verifier(self) -> None:
        parser = MEMGRAPH.build_parser()
        ingest = parser.parse_args(
            ["ingest-docs", "--external-root", "/tmp/codex-memory", "--dry-run"]
        )
        verify = parser.parse_args(
            ["verify-doc-index", "--external-root", "/tmp/codex-memory"]
        )

        self.assertEqual(ingest.external_root, "/tmp/codex-memory")
        self.assertEqual(verify.external_root, "/tmp/codex-memory")

    def test_external_selection_is_exactly_git_tracked_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._tracked_markdown_repo(root)

            selected = MEMGRAPH._ingest_external_tracked_markdown(root)

            self.assertEqual(
                [p.relative_to(root.resolve()).as_posix() for p in selected],
                ["MEMORY.md", "nested/rollout.md"],
            )

    def test_external_tracked_symlink_to_untracked_target_is_excluded(self) -> None:
        # The archive commit stores the link, not the target bytes, so a
        # tracked symlink's content is not reproducible from the archive HEAD.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._tracked_markdown_repo(root)
            (root / "private.md").write_text("# Uncommitted\n", encoding="utf-8")
            try:
                os.symlink("private.md", root / "leak.md")
            except OSError as exc:
                self.skipTest(f"cannot create symlinks here: {exc}")
            subprocess.run(["git", "add", "leak.md"], cwd=root, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Memgraph Test",
                    "-c",
                    "user.email=memgraph-test@example.invalid",
                    "commit",
                    "-qm",
                    "tracked symlink",
                ],
                cwd=root,
                check=True,
            )

            selected = MEMGRAPH._ingest_external_tracked_markdown(root)

            self.assertEqual(
                [p.relative_to(root.resolve()).as_posix() for p in selected],
                ["MEMORY.md", "nested/rollout.md"],
            )

    def test_external_revision_rejects_dirty_tracked_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._tracked_markdown_repo(root)
            revision = MEMGRAPH._ingest_external_revision(root)
            self.assertEqual(
                revision,
                subprocess.check_output(
                    ["git", "rev-parse", "HEAD"], cwd=root, text=True
                ).strip(),
            )
            (root / "MEMORY.md").write_text("# Dirty\n", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "dirty tracked Markdown"):
                MEMGRAPH._ingest_external_revision(root)

    def test_external_source_key_is_absolute_link_and_low_authority(self) -> None:
        repo_root = Path("/tmp/target-repo")
        external_root = Path("/tmp/codex-memory")
        path = external_root / "rollout_summaries" / "one.md"

        source_key = MEMGRAPH._ingest_source_key(path, repo_root, external_root)
        role, category = MEMGRAPH._ingest_classify_source(source_key, external=True)

        self.assertEqual(source_key, str(path.resolve()))
        self.assertEqual(role, "external_memory_archive")
        self.assertEqual(category, "other")

    def test_prune_scope_never_crosses_between_repo_and_external_sources(self) -> None:
        repo_root = Path("/tmp/target-repo").resolve()
        external_root = Path("/tmp/codex-memory").resolve()

        self.assertTrue(
            MEMGRAPH._ingest_source_in_scope("docs/spec.md", repo_root, external_root=None)
        )
        self.assertFalse(
            MEMGRAPH._ingest_source_in_scope(
                str(external_root / "MEMORY.md"), repo_root, external_root=None
            )
        )
        self.assertTrue(
            MEMGRAPH._ingest_source_in_scope(
                str(external_root / "MEMORY.md"), repo_root, external_root=external_root
            )
        )
        self.assertFalse(
            MEMGRAPH._ingest_source_in_scope(
                str(Path("/tmp/other") / "MEMORY.md"), repo_root, external_root=external_root
            )
        )

    def test_db_override_cannot_escape_the_target_repository(self) -> None:
        repo_root = Path("/tmp/target-repo").resolve()
        with (
            mock.patch.object(MEMGRAPH, "git_root", return_value=repo_root),
            mock.patch.dict(os.environ, {"MEMGRAPH_DB": "/tmp/global-memory.db"}),
            redirect_stdout(io.StringIO()),
        ):
            with self.assertRaises(SystemExit):
                MEMGRAPH.resolve_db_path()


class SourceLinkRecallTests(unittest.TestCase):
    def test_chunk_object_ids_resolve_to_source_metadata(self) -> None:
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        conn.executescript(
            """
            CREATE TABLE sources(
              id INTEGER PRIMARY KEY,
              path TEXT NOT NULL,
              source_role TEXT NOT NULL,
              source_category TEXT NOT NULL
            );
            CREATE TABLE chunks(
              id INTEGER PRIMARY KEY,
              object_id INTEGER NOT NULL,
              source_id INTEGER NOT NULL
            );
            INSERT INTO sources(id, path, source_role, source_category)
            VALUES (1, '/tmp/codex-memory/MEMORY.md', 'external_memory_archive', 'other');
            INSERT INTO chunks(id, object_id, source_id) VALUES (1, 42, 1);
            """
        )

        result = MEMGRAPH._recall_source_metadata(conn, [7, 42])

        self.assertEqual(
            result,
            {
                42: {
                    "source_path": "/tmp/codex-memory/MEMORY.md",
                    "source_role": "external_memory_archive",
                    "source_category": "other",
                }
            },
        )

    def test_external_archive_is_ranked_below_current_project_evidence(self) -> None:
        scores = [(10, 0.04), (20, 0.035), (30, 0.03)]
        metadata = {
            10: {"source_role": "external_memory_archive"},
            20: {"source_role": "evidence"},
        }

        ranked = MEMGRAPH._rank_recall_scores(scores, metadata)

        self.assertEqual([row[0] for row in ranked], [20, 30, 10])
        self.assertEqual(ranked[0], (20, 0.035, 0.035, 1.0))
        self.assertEqual(ranked[2], (10, 0.03, 0.04, 0.75))

    def test_active_invalidation_edges_are_resolved_for_recall(self) -> None:
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        conn.executescript(
            """
            CREATE TABLE relations(
              source_object_id INTEGER NOT NULL,
              target_object_id INTEGER NOT NULL,
              relation TEXT NOT NULL,
              status TEXT NOT NULL
            );
            INSERT INTO relations VALUES (99, 42, 'invalidates', 'active');
            INSERT INTO relations VALUES (100, 42, 'mentions', 'active');
            INSERT INTO relations VALUES (101, 7, 'supersedes', 'inactive');
            """
        )

        result = MEMGRAPH._recall_invalidation_sources(conn, [7, 42])

        self.assertEqual(result, {42: [99]})

    def test_recall_parser_hides_invalidated_by_default(self) -> None:
        parser = MEMGRAPH.build_parser()

        default_args = parser.parse_args(["recall", "query"])
        audit_args = parser.parse_args(
            ["recall", "query", "--include-invalidated"]
        )

        self.assertFalse(default_args.include_invalidated)
        self.assertTrue(audit_args.include_invalidated)


class DocumentIndexVerificationTests(unittest.TestCase):
    def _connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
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
            INSERT INTO meta(key, value) VALUES
              ('embedding_model', 'text-embedding-3-small'),
              ('embedding_dimensions', '512');
            INSERT INTO memory_vec(rowid, embedding) VALUES (42, 'vector');
            INSERT INTO memory_fts(rowid, title) VALUES (42, 'Memory');
            """
        )
        source_path = "/tmp/codex-memory/MEMORY.md"
        heading_path = "Memory"
        body = "alpha"
        chunk_hash = MEMGRAPH.sha256_text(f"{heading_path}\n{body}")
        embedding_text = MEMGRAPH._ingest_chunk_embedding_text(
            source_path, heading_path, body
        )
        embedding_hash = MEMGRAPH.sha256_text(embedding_text)
        conn.execute(
            "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?)",
            (1, source_path, "external_memory_archive", "other", "file-hash", 1),
        )
        conn.execute(
            "INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?, ?)",
            (1, 42, 1, heading_path, body, "parsed_structural", chunk_hash),
        )
        conn.execute(
            "INSERT INTO index_docs VALUES (?, ?, ?)",
            (42, embedding_text, embedding_hash),
        )
        conn.execute(
            "INSERT INTO embedding_meta VALUES (?, ?, ?, ?)",
            (42, embedding_hash, "text-embedding-3-small", 512),
        )
        return conn

    def test_verify_doc_index_proves_all_projection_layers(self) -> None:
        conn = self._connection()
        self.addCleanup(conn.close)

        result = MEMGRAPH._verify_doc_index(
            conn, ["/tmp/codex-memory/MEMORY.md"]
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["expected_sources"], 1)
        self.assertEqual(result["indexed_sources"], 1)
        self.assertEqual(result["active_chunks"], 1)
        self.assertEqual(result["source_paths"], ["/tmp/codex-memory/MEMORY.md"])
        self.assertEqual(result["missing_sources"], [])
        self.assertEqual(result["missing_vectors"], [])

    def test_verify_doc_index_reports_missing_vector(self) -> None:
        conn = self._connection()
        self.addCleanup(conn.close)
        conn.execute("DELETE FROM memory_vec WHERE rowid=42")

        result = MEMGRAPH._verify_doc_index(
            conn, ["/tmp/codex-memory/MEMORY.md"]
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["missing_vectors"], [42])

    def test_verify_doc_index_rehashes_actual_chunk_and_embedding_text(self) -> None:
        conn = self._connection()
        self.addCleanup(conn.close)
        conn.execute("UPDATE index_docs SET embedding_text='tampered' WHERE object_id=42")

        result = MEMGRAPH._verify_doc_index(
            conn, ["/tmp/codex-memory/MEMORY.md"]
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["embedding_hash_mismatches"], [42])

    def test_verify_external_scope_rejects_wrong_role_and_stale_source(self) -> None:
        conn = self._connection()
        self.addCleanup(conn.close)
        conn.execute("UPDATE sources SET source_role='evidence' WHERE id=1")
        conn.execute(
            "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?)",
            (
                2,
                "/tmp/codex-memory/stale.md",
                "external_memory_archive",
                "other",
                "stale-hash",
                1,
            ),
        )

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["/tmp/codex-memory/MEMORY.md"],
            external_root=Path("/tmp/codex-memory"),
        )

        self.assertFalse(result["ok"])
        self.assertEqual(
            result["source_role_mismatches"], ["/tmp/codex-memory/MEMORY.md"]
        )
        self.assertEqual(result["unexpected_sources"], ["/tmp/codex-memory/stale.md"])

    def test_verify_default_repo_scope_rejects_stale_managed_source(self) -> None:
        conn = self._connection()
        self.addCleanup(conn.close)
        conn.execute(
            "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?)",
            (
                2,
                "docs/stale.md",
                "strategic_doc",
                "project_doc",
                "stale-hash",
                1,
            ),
        )

        result = MEMGRAPH._verify_doc_index(
            conn,
            ["/tmp/codex-memory/MEMORY.md"],
            repo_root=Path("/tmp/target-repo"),
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["unexpected_sources"], ["docs/stale.md"])


if __name__ == "__main__":
    unittest.main()
