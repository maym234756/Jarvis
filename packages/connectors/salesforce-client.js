const DEFAULT_API_VERSION = "v61.0";

export class SalesforceClient {
  constructor({
    instanceUrl = process.env.SALESFORCE_INSTANCE_URL,
    accessToken = process.env.SALESFORCE_ACCESS_TOKEN,
    apiVersion = process.env.SALESFORCE_API_VERSION,
    fetchImpl = fetch
  } = {}) {
    this.instanceUrl = normalizeInstanceUrl(instanceUrl);
    this.accessToken = accessToken || "";
    this.apiVersion = apiVersion || "";
    this.fetch = fetchImpl;
  }

  get configured() {
    return Boolean(this.instanceUrl && this.accessToken);
  }

  status() {
    return {
      configured: this.configured,
      instanceUrl: this.instanceUrl || null,
      apiVersion: this.apiVersion || null,
      auth: this.accessToken ? "access-token" : "missing",
      security: "Salesforce object permissions, field-level security, and sharing rules are enforced by the authenticated user."
    };
  }

  async versions() {
    this.#assertConfigured();
    const data = await this.#request("/services/data/");
    return Array.isArray(data) ? data : [];
  }

  async resolveApiVersion() {
    if (this.apiVersion) return normalizeVersion(this.apiVersion);
    const versions = await this.versions();
    const latest = versions
      .map((item) => item.version)
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a))[0];
    this.apiVersion = latest ? `v${latest}` : DEFAULT_API_VERSION;
    return this.apiVersion;
  }

  async limits() {
    const version = await this.resolveApiVersion();
    return this.#request(`/services/data/${version}/limits`);
  }

  async describeGlobal() {
    const version = await this.resolveApiVersion();
    return this.#request(`/services/data/${version}/sobjects`);
  }

  async describeObject(objectApiName) {
    if (!/^[A-Za-z][A-Za-z0-9_]*(__c|__x|__mdt|__e|__b)?$/.test(String(objectApiName || ""))) {
      throw new Error("Invalid Salesforce object API name.");
    }
    const version = await this.resolveApiVersion();
    return this.#request(`/services/data/${version}/sobjects/${encodeURIComponent(objectApiName)}/describe`);
  }

  async query(soql, { maxRows = Number(process.env.SALESFORCE_MAX_QUERY_ROWS || 50) } = {}) {
    const safeSoql = enforceReadOnlySoql(soql, { maxRows });
    const version = await this.resolveApiVersion();
    return this.#request(`/services/data/${version}/query?q=${encodeURIComponent(safeSoql)}`);
  }

  async #request(pathname, options = {}) {
    this.#assertConfigured();
    const url = new URL(pathname, this.instanceUrl);
    const response = await this.fetch(url, {
      ...options,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.accessToken}`,
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = Array.isArray(data)
        ? data.map((item) => item.message).filter(Boolean).join("; ")
        : data.message || text.slice(0, 300);
      throw new Error(`Salesforce API failed: ${response.status}${message ? ` ${message}` : ""}`);
    }
    return data;
  }

  #assertConfigured() {
    if (!this.configured) {
      throw new Error("Salesforce connector is not configured. Set SALESFORCE_INSTANCE_URL and SALESFORCE_ACCESS_TOKEN.");
    }
  }
}

export function enforceReadOnlySoql(soql = "", { maxRows = 50 } = {}) {
  const query = String(soql || "").replace(/\s+/g, " ").trim();
  if (!/^select\b/i.test(query)) throw new Error("Only SELECT SOQL queries are allowed.");
  if (/\b(insert|update|upsert|delete|undelete|merge|truncate|create|alter|drop)\b/i.test(query)) {
    throw new Error("Only read-only Salesforce queries are allowed.");
  }
  if (!/\blimit\s+\d+\b/i.test(query)) return `${query} LIMIT ${maxRows}`;
  return query.replace(/\blimit\s+(\d+)\b/i, (_, value) => `LIMIT ${Math.min(Number(value), maxRows)}`);
}

function normalizeInstanceUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new URL(raw);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Salesforce instance URL must be http or https.");
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeVersion(value = "") {
  const text = String(value || "").trim();
  if (!text) return DEFAULT_API_VERSION;
  return text.startsWith("v") ? text : `v${text}`;
}
