import test from "node:test";
import assert from "node:assert/strict";
import { RISK_LEVELS } from "../packages/tool-runtime/index.js";
import { analyzeShellCommand, classifyShellRisk } from "../packages/tool-runtime/tools/shell-tool.js";

test("shell risk classifier treats status commands as read-only", () => {
  assert.equal(classifyShellRisk("git status --short"), RISK_LEVELS.READ_ONLY);
});

test("shell risk classifier approval-gates package installs", () => {
  assert.equal(classifyShellRisk("npm install left-pad"), RISK_LEVELS.NETWORK_OR_PACKAGE);
});

test("shell risk classifier blocks recursive deletion", () => {
  assert.equal(classifyShellRisk("rm -rf ."), RISK_LEVELS.DANGEROUS);
});

test("shell risk classifier blocks destructive git resets", () => {
  assert.equal(classifyShellRisk("git reset --hard HEAD"), RISK_LEVELS.DANGEROUS);
});

test("shell analyzer explains command risk", () => {
  const analysis = analyzeShellCommand("npm ci");
  assert.equal(analysis.riskLevel, RISK_LEVELS.NETWORK_OR_PACKAGE);
  assert.ok(analysis.reasons[0].includes("network"));
});
