import fs from "node:fs";
import path from "node:path";

export class ConnectorRegistry {
  constructor({ projectRoot = process.cwd(), fetchImpl = fetch } = {}) {
    this.projectRoot = projectRoot;
    this.fetch = fetchImpl;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "connectors");
    this.registryPath = path.join(this.stateDir, "connectors.json");
  }

  async listConnectors() {
    const connectors = await this.#read();
    return connectors.sort((a, b) => a.id.localeCompare(b.id));
  }

  async addConnector(input = {}) {
    const id = normalizeId(input.id);
    if (!id) throw new Error("connector id is required");
    const connector = {
      id,
      name: input.name || id,
      type: input.type || "mcp",
      url: normalizeUrl(input.url || ""),
      enabled: input.enabled !== false,
      toolFilter: Array.isArray(input.toolFilter) ? input.toolFilter : [],
      permissionPolicy: input.permissionPolicy || "approval-required",
      authType: input.authType || "none",
      scopes: Array.isArray(input.scopes) ? input.scopes : [],
      dataClassification: input.dataClassification || "internal",
      notes: input.notes || "",
      created_at: input.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const connectors = await this.#read();
    const index = connectors.findIndex((item) => item.id === id);
    if (index >= 0) {
      connector.created_at = connectors[index].created_at || connector.created_at;
      connectors[index] = connector;
    } else {
      connectors.push(connector);
    }
    await this.#write(connectors);
    return connector;
  }

  async getConnector(id) {
    const connectors = await this.listConnectors();
    const connector = connectors.find((item) => item.id === normalizeId(id));
    if (!connector) throw new Error(`Connector not found: ${id}`);
    return connector;
  }

  async testConnector(id, { timeoutMs = 5000 } = {}) {
    const connector = await this.getConnector(id);
    if (!connector.enabled) {
      return { ok: false, id: connector.id, status: "disabled", message: "Connector is disabled." };
    }
    if (!connector.url) {
      return { ok: false, id: connector.id, status: "not_configured", message: "Connector URL is not configured." };
    }

    const startedAt = Date.now();
    const candidates = healthCandidates(connector.url);
    let lastError = null;
    for (const url of candidates) {
      try {
        const response = await fetchWithTimeout(this.fetch, url, { timeoutMs });
        const body = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        return {
          ok: true,
          id: connector.id,
          status: "online",
          endpoint: url,
          duration_ms: Date.now() - startedAt,
          message: `${connector.name} responded from ${url}.`
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      ok: false,
      id: connector.id,
      status: "error",
      duration_ms: Date.now() - startedAt,
      message: lastError?.message || "Connector test failed."
    };
  }

  async status() {
    const connectors = await this.listConnectors();
    return {
      count: connectors.length,
      enabled: connectors.filter((item) => item.enabled).length,
      disabled: connectors.filter((item) => !item.enabled).length,
      types: countBy(connectors.map((item) => item.type)),
      accountConnectors: this.discoverAccountConnectors()
    };
  }

  discoverAccountConnectors() {
    return [
      {
        id: "salesforce",
        name: "Salesforce",
        type: "crm",
        configured: Boolean(process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN),
        authType: process.env.SALESFORCE_ACCESS_TOKEN ? "oauth-access-token" : "missing",
        instanceUrl: process.env.SALESFORCE_INSTANCE_URL || null,
        permissionModel: "Authenticated user's Salesforce object permissions, field-level security, and sharing rules."
      }
    ];
  }

  async #read() {
    try {
      const value = await fs.promises.readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(value);
      return Array.isArray(parsed.connectors) ? parsed.connectors : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #write(connectors) {
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(this.registryPath, JSON.stringify({ connectors }, null, 2), "utf8");
  }
}

function normalizeId(id = "") {
  const value = String(id).trim().toLowerCase();
  if (!value) return "";
  if (!/^[a-z0-9._-]+$/.test(value)) throw new Error(`Invalid connector id: ${id}`);
  return value;
}

function normalizeUrl(url = "") {
  const value = String(url).trim();
  if (!value) return "";
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Connector URL must use http or https.");
  }
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function healthCandidates(url) {
  const parsed = new URL(url);
  const root = `${parsed.protocol}//${parsed.host}`;
  const paths = new Set([url, `${url}/health`, `${root}/health`]);
  return [...paths];
}

async function fetchWithTimeout(fetchImpl, url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "JarvisAIPlatform/0.1 connector tester" }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
