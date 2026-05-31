import test from "node:test";
import assert from "node:assert/strict";
import { ReasoningEngine } from "../packages/reasoning/index.js";

test("reasoning engine builds research evidence contract", () => {
  const engine = new ReasoningEngine();
  const frame = engine.buildFrame({
    message: "latest Node.js LTS release",
    taskType: "research",
    workflow: { name: "ResearchWorkflow" },
    plan: ["search", "answer"],
    memoryContext: [],
    context: { mode: "research", privacyLevel: "project" }
  });

  assert.equal(frame.confidence, "conditional");
  assert.equal(frame.answerContract.citationRequired, true);
  assert.ok(frame.evidenceNeeds.some((need) => need.kind === "fresh_sources"));
  assert.ok(frame.graph.some((node) => node.id === "research-tool"));
});
