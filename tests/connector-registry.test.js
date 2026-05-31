import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ConnectorRegistry } from "../packages/connectors/index.js";

test("connector registry stores and tests MCP-style endpoints", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `connectors-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const fetchImpl = async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  const registry = new ConnectorRegistry({ projectRoot: root, fetchImpl });

  const connector = await registry.addConnector({
    id: "local.mcp",
    name: "Local MCP",
    url: "http://localhost:9999/mcp",
    toolFilter: ["docs.search"]
  });
  const list = await registry.listConnectors();
  const status = await registry.status();
  const health = await registry.testConnector(connector.id);

  assert.equal(list.length, 1);
  assert.equal(status.enabled, 1);
  assert.equal(health.ok, true);
  assert.equal(health.status, "online");
});
