import test from "node:test";
import assert from "node:assert/strict";
import { SearchEngine, extractSnippets, rankResults } from "../packages/search/index.js";

test("search engine plans query variants without a provider", async () => {
  const engine = new SearchEngine();
  const result = await engine.search("Node.js LTS", { limit: 3 });
  const cached = await engine.search("Node.js LTS", { limit: 3 });

  assert.equal(result.provider, "none");
  assert.equal(result.plan.length, 3);
  assert.equal(result.results.length, 0);
  assert.equal(cached.cached, true);
  assert.ok(engine.cacheStatus().hits >= 1);
});

test("search ranking prefers authoritative source matches", () => {
  const ranked = rankResults([
    { title: "Random blog", url: "https://example.com/node", description: "Node release notes" },
    { title: "Node.js official release", url: "https://nodejs.org/en/blog/release", description: "Node.js LTS official" }
  ], "Node.js LTS release");

  assert.equal(ranked[0].host, "nodejs.org");
  assert.equal(ranked[0].source_type, "authoritative");
});

test("snippet extraction finds query-adjacent text", () => {
  const snippets = extractSnippets("Alpha opening. Node.js LTS is the stable line for production. Closing.", "Node.js LTS");
  assert.equal(snippets.length, 1);
  assert.ok(snippets[0].includes("Node.js LTS"));
});
