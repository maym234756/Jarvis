import { RISK_LEVELS } from "../policy-engine.js";

export class ConnectorListTool {
  constructor(connectorRegistry) {
    this.name = "connector.list";
    this.description = "List Jarvis MCP-style connectors and docked backend services.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["connectors", "mcp", "dock-discovery"];
    this.connectorRegistry = connectorRegistry;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "List connectors";
  }

  async run() {
    const connectors = await this.connectorRegistry.listConnectors();
    return {
      summary: `${connectors.length} connector(s) registered`,
      connectors
    };
  }
}

export class ConnectorAddTool {
  constructor(connectorRegistry) {
    this.name = "connector.add";
    this.description = "Register or update a Jarvis connector endpoint.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.capabilities = ["connectors", "mcp", "registry-write"];
    this.connectorRegistry = connectorRegistry;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Register connector ${args.id}`;
  }

  async run(args) {
    const connector = await this.connectorRegistry.addConnector(args);
    return {
      summary: `Registered connector ${connector.id}`,
      connector
    };
  }
}

export class ConnectorTestTool {
  constructor(connectorRegistry) {
    this.name = "connector.test";
    this.description = "Test a registered connector endpoint.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.capabilities = ["connectors", "mcp", "health-check"];
    this.connectorRegistry = connectorRegistry;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Test connector ${args.id}`;
  }

  async run(args) {
    if (!args.id) throw new Error("id is required");
    const result = await this.connectorRegistry.testConnector(args.id);
    return {
      summary: result.message,
      result
    };
  }
}
