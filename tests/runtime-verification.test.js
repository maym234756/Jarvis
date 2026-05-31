import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeProfile } from "../packages/runtime/index.js";
import { VerificationEngine } from "../packages/verification/index.js";

test("runtime profiles expose fast, balanced, and deep budgets", () => {
  const instant = resolveRuntimeProfile("instant");
  const deep = resolveRuntimeProfile("deep");

  assert.equal(instant.verificationLevel, "light");
  assert.equal(deep.verificationLevel, "strict");
  assert.ok(deep.latencyBudgetMs > instant.latencyBudgetMs);
});

test("verification engine flags failed tools and pending approvals", () => {
  const report = new VerificationEngine().verify({
    message: "fix the build",
    taskType: "coding",
    plan: ["Inspect", "Patch"],
    toolResults: [
      { tool: "shell.run", ok: false, error: "tests failed" },
      { tool: "search.web", ok: false, pendingApproval: true, reason: "network approval" }
    ],
    memoryContext: [],
    runtimeProfile: resolveRuntimeProfile("balanced")
  });

  assert.equal(report.status, "fail");
  assert.ok(report.checks.some((check) => check.id === "tool_failures" && check.status === "fail"));
  assert.ok(report.checks.some((check) => check.id === "pending_approvals" && check.status === "warn"));
});
