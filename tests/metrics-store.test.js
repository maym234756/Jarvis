import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MetricsStore } from "../packages/metrics/index.js";

test("metrics store records and summarizes events", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `metrics-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const metrics = new MetricsStore({ projectRoot: root });
  await metrics.record({ type: "tool", tool: "file.read", ok: true, duration_ms: 10 });
  await metrics.record({ type: "tool", tool: "shell.run", ok: false, duration_ms: 30 });

  const events = await metrics.list();
  const summary = await metrics.summary();

  assert.equal(events.length, 2);
  assert.equal(summary.byType.tool.count, 2);
  assert.equal(summary.byType.tool.failures, 1);
  assert.equal(summary.byType.tool.avgDurationMs, 20);
});
