import test from "node:test";
import assert from "node:assert/strict";
import { SalesforceClient, enforceReadOnlySoql } from "../packages/connectors/index.js";
import { SalesforceDescribeObjectTool, SalesforceQueryTool, SalesforceStatusTool } from "../packages/tool-runtime/tools/salesforce-tool.js";

test("salesforce client discovers version and runs permission-scoped read query", async () => {
  const calls = [];
  const client = new SalesforceClient({
    instanceUrl: "https://example.my.salesforce.com",
    accessToken: "token",
    fetchImpl: async (url) => {
      calls.push(String(url));
      const pathname = new URL(url).pathname;
      if (pathname === "/services/data/") return json([{ version: "60.0" }, { version: "61.0" }]);
      if (pathname.endsWith("/query")) {
        return json({ totalSize: 1, done: true, records: [{ attributes: { type: "Account" }, Id: "001", Name: "Acme" }] });
      }
      return json({});
    }
  });

  const result = await client.query("SELECT Id, Name FROM Account");
  assert.equal(result.totalSize, 1);
  assert.equal(result.records[0].Name, "Acme");
  assert.ok(calls.some((url) => url.includes("/services/data/v61.0/query?q=")));
  assert.ok(decodeURIComponent(calls.find((url) => url.includes("/query?q="))).includes("LIMIT 50"));
});

test("salesforce tools expose status, describe, and query without leaking attributes", async () => {
  const client = new SalesforceClient({
    instanceUrl: "https://example.my.salesforce.com",
    accessToken: "token",
    apiVersion: "v61.0",
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/limits")) return json({ DailyApiRequests: { Max: 1000, Remaining: 999 } });
      if (parsed.pathname.endsWith("/sobjects/Account/describe")) {
        return json({
          name: "Account",
          label: "Account",
          queryable: true,
          fields: [{ name: "Name", label: "Account Name", type: "string", createable: true, updateable: true }]
        });
      }
      if (parsed.pathname.endsWith("/query")) {
        return json({ totalSize: 1, done: true, records: [{ attributes: { type: "Account" }, Name: "Acme" }] });
      }
      return json({});
    }
  });

  const status = await new SalesforceStatusTool({ client }).run();
  const describe = await new SalesforceDescribeObjectTool({ client }).run({ object: "Account" });
  const query = await new SalesforceQueryTool({ client }).run({ soql: "SELECT Name FROM Account LIMIT 5" });

  assert.equal(status.status, "online");
  assert.equal(describe.object, "Account");
  assert.equal(query.records[0].Name, "Acme");
  assert.equal(query.records[0].attributes, undefined);
});

test("salesforce SOQL guard allows only SELECT and clamps LIMIT", () => {
  assert.equal(enforceReadOnlySoql("SELECT Id FROM Account LIMIT 500", { maxRows: 25 }), "SELECT Id FROM Account LIMIT 25");
  assert.throws(() => enforceReadOnlySoql("DELETE FROM Account"), /Only SELECT/);
});

function json(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
