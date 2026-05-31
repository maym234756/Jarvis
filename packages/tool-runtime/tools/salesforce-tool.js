import { SalesforceClient } from "../../connectors/index.js";
import { RISK_LEVELS } from "../policy-engine.js";

export class SalesforceStatusTool {
  constructor({ client } = {}) {
    this.name = "salesforce.status";
    this.description = "Check whether the Salesforce account connector is configured and reachable.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.capabilities = ["salesforce", "crm", "account-connector", "permissions"];
    this.client = client || new SalesforceClient();
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Check Salesforce connector status";
  }

  async run() {
    const status = this.client.status();
    if (!status.configured) return { status: "not_configured", connector: status };
    const limits = await this.client.limits();
    return {
      status: "online",
      connector: { ...status, apiVersion: await this.client.resolveApiVersion() },
      limits: summarizeLimits(limits)
    };
  }
}

export class SalesforceDescribeObjectTool {
  constructor({ client } = {}) {
    this.name = "salesforce.describe";
    this.description = "Describe a Salesforce object using the authenticated user's access.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.capabilities = ["salesforce", "crm", "object-describe", "field-security"];
    this.client = client || new SalesforceClient();
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args = {}) {
    return `Describe Salesforce object ${args.object || args.objectApiName || ""}`.trim();
  }

  async run(args = {}) {
    const objectApiName = args.object || args.objectApiName;
    if (!objectApiName) throw new Error("object is required");
    const describe = await this.client.describeObject(objectApiName);
    return {
      object: describe.name,
      label: describe.label,
      queryable: describe.queryable,
      createable: describe.createable,
      updateable: describe.updateable,
      deletable: describe.deletable,
      fields: (describe.fields || []).map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        queryable: field.filterable || field.sortable || describe.queryable,
        createable: field.createable,
        updateable: field.updateable
      }))
    };
  }
}

export class SalesforceQueryTool {
  constructor({ client } = {}) {
    this.name = "salesforce.query";
    this.description = "Run a read-only SOQL SELECT query through the authenticated Salesforce user's permissions.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.capabilities = ["salesforce", "crm", "soql", "read-only-query", "sharing-rules"];
    this.client = client || new SalesforceClient();
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args = {}) {
    return `Run Salesforce SOQL query: ${String(args.soql || "").slice(0, 120)}`;
  }

  async run(args = {}) {
    if (!args.soql) throw new Error("soql is required");
    const result = await this.client.query(args.soql, { maxRows: args.maxRows });
    return {
      totalSize: result.totalSize,
      done: result.done,
      records: (result.records || []).map(stripAttributes),
      nextRecordsUrl: result.nextRecordsUrl || null,
      security: "Results are limited by the authenticated Salesforce user's object permissions, field-level security, and sharing rules."
    };
  }
}

function stripAttributes(record = {}) {
  const { attributes, ...rest } = record;
  return rest;
}

function summarizeLimits(limits = {}) {
  const keys = ["DailyApiRequests", "DailyBulkApiRequests", "DataStorageMB", "FileStorageMB"];
  return Object.fromEntries(keys.filter((key) => limits[key]).map((key) => [key, limits[key]]));
}
