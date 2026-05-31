import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class ApprovalQueue {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.queuePath = path.join(this.projectRoot, ".jarvis", "approvals", "queue.json");
    this.items = null;
  }

  async create(request) {
    await this.#load();
    const item = {
      id: crypto.randomUUID(),
      status: "pending",
      created_at: new Date().toISOString(),
      ...request
    };
    this.items.push(item);
    await this.#save();
    return sanitizeApproval(item);
  }

  async list({ status } = {}) {
    await this.#load();
    const items = status ? this.items.filter((item) => item.status === status) : this.items;
    return items.map(sanitizeApproval);
  }

  async get(id) {
    await this.#load();
    return this.items.find((item) => item.id === id) || null;
  }

  async resolve(id, decision) {
    await this.#load();
    const item = this.items.find((entry) => entry.id === id);
    if (!item) throw new Error(`Approval not found: ${id}`);
    if (item.status !== "pending") throw new Error(`Approval is already ${item.status}`);
    item.status = decision.approved ? "approved" : "denied";
    item.resolved_at = new Date().toISOString();
    item.resolution_note = decision.note || null;
    await this.#save();
    return item;
  }

  async complete(id, result) {
    await this.#load();
    const item = this.items.find((entry) => entry.id === id);
    if (!item) throw new Error(`Approval not found: ${id}`);
    item.status = result.ok ? "completed" : "failed";
    item.completed_at = new Date().toISOString();
    item.result = result;
    await this.#save();
    return sanitizeApproval(item);
  }

  async #load() {
    if (this.items) return;
    try {
      this.items = JSON.parse(await fs.promises.readFile(this.queuePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.items = [];
    }
  }

  async #save() {
    await fs.promises.mkdir(path.dirname(this.queuePath), { recursive: true });
    await fs.promises.writeFile(this.queuePath, JSON.stringify(this.items, null, 2), "utf8");
  }
}

function sanitizeApproval(item) {
  return {
    id: item.id,
    status: item.status,
    created_at: item.created_at,
    resolved_at: item.resolved_at,
    completed_at: item.completed_at,
    tool: item.tool,
    args: item.args,
    riskLevel: item.riskLevel,
    summary: item.summary,
    reason: item.reason,
    resolution_note: item.resolution_note,
    result: item.result
  };
}
