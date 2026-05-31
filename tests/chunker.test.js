import test from "node:test";
import assert from "node:assert/strict";
import { Chunker } from "../packages/chunking/index.js";

test("chunker creates metadata-rich chunks", () => {
  const chunker = new Chunker({ maxTokens: 5, overlapTokens: 1 });
  const chunks = chunker.chunkText("alpha beta gamma.\n\none two three four five six.", {
    source_path: "docs/example.md",
    title: "Example"
  });

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].metadata.source_path, "docs/example.md");
  assert.ok(chunks[0].metadata.hash);
  assert.ok(chunks[0].metadata.chunk_id.endsWith("0001"));
});

test("chunker records line citations", () => {
  const chunker = new Chunker({ maxTokens: 3, overlapTokens: 1 });
  const chunks = chunker.chunkText("title\n\nalpha\nbeta\n\nclosing", {
    source_path: "docs/lines.md"
  });

  assert.equal(chunks[0].metadata.line_start, 1);
  assert.equal(chunks[0].metadata.line_end, 4);
  assert.equal(chunks[1].metadata.line_start, 4);
  assert.equal(chunks[1].metadata.line_end, 6);
});
