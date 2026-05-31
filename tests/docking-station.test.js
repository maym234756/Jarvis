import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BackendDockingStation } from "../packages/docking/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { RunStore } from "../packages/runs/index.js";
import { SessionStore } from "../packages/session/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { DockingStatusTool, DockingTestTool } from "../packages/tool-runtime/tools/docking-tool.js";

test("backend docking station reports local docks", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `docking-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(path.join(root, "apps", "web-console"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "apps", "web-console", "index.html"), "<html></html>", "utf8");

  const memoryStore = new MemoryStore({ projectRoot: root });
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore });
  const runStore = new RunStore({ projectRoot: root });
  const sessionStore = new SessionStore({ projectRoot: root });
  const dockingStation = new BackendDockingStation({ projectRoot: root, memoryStore, toolRegistry, runStore, sessionStore });

  const report = await dockingStation.report();
  const memoryTest = await dockingStation.testDock("memory.local-jsonl");
  const missingModel = await dockingStation.testDock("model.openai");

  assert.equal(report.ok, true);
  assert.ok(report.docks.some((dock) => dock.id === "tools.registry"));
  assert.ok(report.docks.some((dock) => dock.id === "engine.reasoning"));
  assert.ok(report.docks.some((dock) => dock.id === "model.router"));
  assert.ok(report.docks.some((dock) => dock.id === "metrics.local-jsonl"));
  assert.equal(memoryTest.ok, true);
  assert.equal(missingModel.status, "not_configured");
});

test("docking tools expose station status", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `docking-tools-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore });
  const dockingStation = new BackendDockingStation({ projectRoot: root, memoryStore, toolRegistry });
  toolRegistry.register(new DockingStatusTool(dockingStation));
  toolRegistry.register(new DockingTestTool(dockingStation));

  const status = await toolRegistry.execute("docking.status", {}, { projectRoot: root });
  const testResult = await toolRegistry.execute("docking.test", { id: "tools.registry" }, { projectRoot: root });

  assert.equal(status.ok, true);
  assert.equal(status.report.summary.error, 0);
  assert.equal(testResult.ok, true);
});
