import test from "node:test";
import assert from "node:assert/strict";
import { ContextBudgetManager } from "../packages/context-budget/index.js";

test("context budget manager allocates budget by runtime profile", () => {
  const manager = new ContextBudgetManager();
  const instant = manager.allocate({ message: "hello", taskType: "chat", runtimeProfile: "instant" });
  const deep = manager.allocate({ message: "hello", taskType: "coding", runtimeProfile: "deep" });
  const pressured = manager.allocate({ message: "x".repeat(30000), taskType: "chat", runtimeProfile: "instant" });

  assert.ok(deep.total_context > instant.total_context);
  assert.ok(deep.allocations.code > instant.allocations.code);
  assert.notEqual(pressured.pressure.level, "low");
});
