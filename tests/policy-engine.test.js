import test from "node:test";
import assert from "node:assert/strict";
import { PolicyEngine, RISK_LEVELS } from "../packages/tool-runtime/index.js";

test("policy allows read-only actions", () => {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({ toolName: "file.read", riskLevel: RISK_LEVELS.READ_ONLY });
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, false);
});

test("policy approval-gates network actions", () => {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({ toolName: "search.web", riskLevel: RISK_LEVELS.NETWORK_OR_PACKAGE });
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, true);
});

test("policy blocks dangerous actions by default", () => {
  const policy = new PolicyEngine();
  const decision = policy.evaluate({ toolName: "shell.run", riskLevel: RISK_LEVELS.DANGEROUS });
  assert.equal(decision.allowed, false);
});
