import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createBackendKernel } from "../packages/backend/index.js";

test("backend kernel wires supervisor readiness, topology, and tools", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `backend-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(path.join(root, "apps", "web-console"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "apps", "web-console", "index.html"), "<html></html>", "utf8");
  await fs.promises.writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");

  const kernel = createBackendKernel({ projectRoot: root, forceLocalDraft: true, port: 8999 });
  const report = await kernel.backendSupervisor.report();
  const readiness = await kernel.backendSupervisor.readiness();
  const toolStatus = await kernel.toolRegistry.execute("backend.status", {}, { projectRoot: root });
  const toolReady = await kernel.toolRegistry.execute("backend.ready", {}, { projectRoot: root });

  assert.equal(report.ok, true);
  assert.equal(readiness.ok, true);
  assert.ok(["ready", "degraded"].includes(readiness.status));
  assert.ok(report.services.some((service) => service.id === "agent.orchestrator" && service.health === "ok"));
  assert.ok(report.services.some((service) => service.id === "tools.registry" && service.details.count > 20));
  assert.ok(report.topology.edges.some((edge) => edge.from === "agent.orchestrator" && edge.to === "tools.registry"));
  assert.equal(toolStatus.ok, true);
  assert.equal(toolStatus.report.summary.requiredErrors, 0);
  assert.equal(toolReady.ok, true);
  assert.equal(toolReady.readiness.ok, true);
});
