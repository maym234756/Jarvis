import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RiskScorer, classifyFailure } from "../packages/risk/index.js";
import { PolicyDecisionPoint, PolicyStore } from "../packages/policy/index.js";
import { RunLedger } from "../packages/run-ledger/index.js";

test("risk scorer and policy decision point preflight risky actions", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `risk-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const riskScorer = new RiskScorer();
  const policyDecisionPoint = new PolicyDecisionPoint({
    policyStore: new PolicyStore({ projectRoot: root }),
    riskScorer
  });

  const risk = riskScorer.scoreAction({ command: "npm install left-pad" });
  const decision = await policyDecisionPoint.decide({ action: "download https://example.com/file.zip", networkTarget: "https://example.com/file.zip" });
  const blocked = await policyDecisionPoint.decide({ command: "git reset --hard HEAD" });

  assert.equal(risk.approvalRequired, true);
  assert.equal(decision.decision, "approval_required");
  assert.equal(blocked.decision, "deny");
});

test("run ledger stores sanitized replay data", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `ledger-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const ledger = new RunLedger({ projectRoot: root });
  await ledger.start({ runId: "run-test", userGoal: "test ledger", workflow: "TestWorkflow", taskType: "test" });
  await ledger.appendEvent("run-test", "tool.called", { tool: "shell.run", args: { token: "abc123", command: "echo ok" } });
  await ledger.complete("run-test", { final_response: "done" });
  const replay = await ledger.replay("run-test");

  assert.equal((await ledger.summary()).completed, 1);
  assert.equal(replay.tool_trace[0].payload.args.token, "[redacted]");
  assert.equal(replay.final_response, "done");
});

test("failure taxonomy chooses recovery behavior", () => {
  const failure = classifyFailure({ error: "Timed out while running tests" });
  assert.equal(failure.type, "timeout");
  assert.equal(failure.retryable, true);
});
