#!/usr/bin/env python3
"""Embed stdin text into a 512-dim OpenAI vector and print JSON to stdout.

Usage:
    echo "some text" | python3 embed.py
    python3 embed.py --file path/to/text.txt
    python3 embed.py --text "inline string"
    echo '["text one", "text two"]' | python3 embed.py --batch

Contract:
- Uses OPENAI_API_KEY from environment; fails with exit 2 if unset.
- Always emits text-embedding-3-small with dimensions=512 (matches .agent/memory.db meta).
- Single mode: emits ONE JSON array of 512 floats to stdout on success.
- Batch mode (--batch): stdin is a JSON array of strings (1..2048, each
  non-empty after strip); ONE OpenAI call embeds the whole list; stdout is a
  JSON array of 512-float arrays, order preserved.
- Emits single-line human log to stderr (tokens, duration_ms).
- Exit 0 on success, 1 on API error, 2 on usage error.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import List

MODEL = "text-embedding-3-small"
DIMENSIONS = 512
MAX_BATCH_ITEMS = 2048


def read_input(args: argparse.Namespace) -> str:
    if args.text is not None:
        return args.text
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            return f.read()
    if sys.stdin.isatty():
        print("embed.py: no input (pass --text, --file, or pipe stdin)", file=sys.stderr)
        sys.exit(2)
    return sys.stdin.read()


def embed(text: str) -> List[float]:
    # Import lazily so --help works without the dependency.
    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        print("embed.py: missing dependency 'openai' (pip install openai)", file=sys.stderr)
        sys.exit(2)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("embed.py: OPENAI_API_KEY is not set", file=sys.stderr)
        sys.exit(2)

    client = OpenAI(api_key=api_key)
    text = text.strip()
    if not text:
        print("embed.py: input is empty after strip()", file=sys.stderr)
        sys.exit(2)

    t0 = time.time()
    resp = client.embeddings.create(
        model=MODEL,
        dimensions=DIMENSIONS,
        input=text,
    )
    dt_ms = int((time.time() - t0) * 1000)

    vec = resp.data[0].embedding
    if len(vec) != DIMENSIONS:
        print(
            f"embed.py: expected {DIMENSIONS} dims, got {len(vec)}",
            file=sys.stderr,
        )
        sys.exit(1)

    usage = getattr(resp, "usage", None)
    tokens = getattr(usage, "total_tokens", None) if usage else None
    print(
        f"embed.py: model={MODEL} dims={DIMENSIONS} tokens={tokens} ms={dt_ms}",
        file=sys.stderr,
    )
    return list(vec)


def embed_batch(texts: List[str]) -> List[List[float]]:
    """Embed a list of texts with a single OpenAI call. Order preserved."""
    # Import lazily so --help works without the dependency.
    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        print("embed.py: missing dependency 'openai' (pip install openai)", file=sys.stderr)
        sys.exit(2)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("embed.py: OPENAI_API_KEY is not set", file=sys.stderr)
        sys.exit(2)

    stripped = [t.strip() for t in texts]
    for i, t in enumerate(stripped):
        if not t:
            print(f"embed.py: --batch item {i} is empty after strip()", file=sys.stderr)
            sys.exit(2)

    client = OpenAI(api_key=api_key)
    t0 = time.time()
    resp = client.embeddings.create(
        model=MODEL,
        dimensions=DIMENSIONS,
        input=stripped,
    )
    dt_ms = int((time.time() - t0) * 1000)

    # Response items carry their own .index; sort defensively so output order
    # always matches input order even if the API ever reordered them.
    ordered = sorted(resp.data, key=lambda item: item.index)
    vecs: List[List[float]] = []
    for item in ordered:
        vec = item.embedding
        if len(vec) != DIMENSIONS:
            print(
                f"embed.py: expected {DIMENSIONS} dims, got {len(vec)}",
                file=sys.stderr,
            )
            sys.exit(1)
        vecs.append(list(vec))

    usage = getattr(resp, "usage", None)
    tokens = getattr(usage, "total_tokens", None) if usage else None
    print(
        f"embed.py: batch={len(texts)} model={MODEL} tokens={tokens} ms={dt_ms}",
        file=sys.stderr,
    )
    return vecs


def read_batch_input() -> List[str]:
    if sys.stdin.isatty():
        print("embed.py: --batch requires a JSON array of strings on stdin", file=sys.stderr)
        sys.exit(2)
    raw = sys.stdin.read()
    try:
        texts = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"embed.py: --batch stdin is not valid JSON: {e}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(texts, list) or not texts:
        print("embed.py: --batch stdin must be a non-empty JSON array of strings", file=sys.stderr)
        sys.exit(2)
    if len(texts) > MAX_BATCH_ITEMS:
        print(
            f"embed.py: --batch supports at most {MAX_BATCH_ITEMS} items, got {len(texts)}",
            file=sys.stderr,
        )
        sys.exit(2)
    if not all(isinstance(t, str) for t in texts):
        print("embed.py: --batch stdin array must contain only strings", file=sys.stderr)
        sys.exit(2)
    return texts


def main() -> None:
    ap = argparse.ArgumentParser(description="Embed text to 512-dim JSON vector (OpenAI).")
    ap.add_argument("--text", help="Inline text (otherwise reads stdin or --file).")
    ap.add_argument("--file", help="Read text from file instead of stdin.")
    ap.add_argument(
        "--batch",
        action="store_true",
        help="Batch mode: stdin is a JSON array of strings; stdout is a JSON array of vectors.",
    )
    args = ap.parse_args()

    if args.batch:
        if args.text is not None or args.file:
            print("embed.py: --batch cannot be combined with --text/--file (stdin only)", file=sys.stderr)
            sys.exit(2)
        texts = read_batch_input()
        vecs = embed_batch(texts)
        json.dump(vecs, sys.stdout, separators=(",", ":"))
        sys.stdout.write("\n")
        return

    text = read_input(args)
    vec = embed(text)
    json.dump(vec, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
