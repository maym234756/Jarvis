import test from "node:test";
import assert from "node:assert/strict";
import { classifyTask, requiresFreshResearch } from "../packages/agent-core/planner.js";

test("public office questions route through fresh research", () => {
  assert.equal(requiresFreshResearch("Who is the President of the US?"), true);
  assert.equal(classifyTask("Who is the President of the US?"), "research");
});

test("ordinary chat stays chat", () => {
  assert.equal(requiresFreshResearch("Tell me a fun coding joke"), false);
  assert.equal(classifyTask("Tell me a fun coding joke"), "chat");
});
