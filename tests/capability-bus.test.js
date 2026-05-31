import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CapabilityBus } from "../packages/capabilities/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { RISK_LEVELS } from "../packages/tool-runtime/policy-engine.js";

test("capability bus lists contracts and simulates risky shell commands", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `capability-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const capabilityBus = new CapabilityBus();
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore, capabilityBus });
  capabilityBus.setToolRegistry(toolRegistry);

  const contracts = capabilityBus.listCapabilities();
  const simulation = await capabilityBus.simulate("shell.run", { command: "git reset --hard HEAD" }, { projectRoot: root });

  assert.ok(contracts.some((item) => item.name === "shell.run" && item.contract.simulationSupported));
  assert.equal(simulation.willExecute, false);
  assert.equal(simulation.riskLevel, RISK_LEVELS.DANGEROUS);
  assert.equal(simulation.ok, false);
});
