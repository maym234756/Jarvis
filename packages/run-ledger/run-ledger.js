import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class RunLedger {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.ledgerDir = path.join(this.projectRoot, ".jarvis", "run-ledger");
    this.ledgerPath = path.join(this.ledgerDir, "runs.jsonl");
  }

  async start(input = {}) {
    const runId = input.runId || crypto.randomUUID();
    const record = {
      run_id: runId,
      user_goal: input.userGoal || input.message || "",
      workflow: typeof input.workflow === "string" ? input.workflow : input.workflow?.name || null,
      taskType: input.taskType || null,
      status: "running",
      models_used: input.modelRoute ? [input.modelRoute.primaryRole || input.modelRoute.selectedModel].filter(Boolean) : [],
      tools_used: [],
      approvals: [],
      memory_reads: [],
      memory_writes: [],
      artifacts: [],
      decisions: [],
      events: [],
      cost: 0,
      latency_ms: 0,
      risk_level: input.riskLevel || "unknown",
      failure: null,
      final_response: null,
      started_at: new Date().toISOString(),
      completed_at: null
    };
    await this.#upsert(record);
    return record;
  }

  async appendEvent(runId, type, payload = {}) {
    if (!runId) return null;
    const record = await this.get(runId) || await this.start({ runId });
    const event = {
      type,
      at: new Date().toISOString(),
      payload: sanitizePayload(payload)
    };
    record.events.push(event);
    if (type === "decision") record.decisions.push(event.payload);
    if (type === "tool.called" && event.payload.tool) record.tools_used.push(event.payload.tool);
    if (type === "tool.completed" && event.payload.tool) record.tools_used.push(event.payload.tool);
    if (type === "approval.requested") record.approvals.push(event.payload);
    if (type === "memory.read") record.memory_reads.push(event.payload);
    if (type === "memory.write") record.memory_writes.push(event.payload);
    if (type === "artifact.created") record.artifacts.push(event.payload);
    record.tools_used = [...new Set(record.tools_used.filter(Boolean))];
    await this.#upsert(record);
    return event;
  }

  async complete(runId, patch = {}) {
    if (!runId) return null;
    const record = await this.get(runId);
    if (!record) return null;
    const started = new Date(record.started_at).getTime();
    const completed = new Date();
    const updated = {
      ...record,
      ...sanitizePayload(patch),
      status: patch.status || (patch.failure || patch.error ? "failed" : "completed"),
      completed_at: completed.toISOString(),
      latency_ms: completed.getTime() - started
    };
    await this.#upsert(updated);
    return updated;
  }

  async get(runId) {
    const records = await this.list({ limit: 10000 });
    return records.find((record) => record.run_id === runId) || null;
  }

  async list({ limit = 50, status } = {}) {
    try {
      const data = await fs.promises.readFile(this.ledgerPath, "utf8");
      const records = data.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
      const filtered = status ? records.filter((record) => record.status === status) : records;
      return filtered.slice(-limit).reverse();
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async summary() {
    const records = await this.list({ limit: 10000 });
    const completed = records.filter((record) => record.status === "completed");
    const failed = records.filter((record) => record.status === "failed");
    const averageLatency = completed.length
      ? Math.round(completed.reduce((sum, record) => sum + Number(record.latency_ms || 0), 0) / completed.length)
      : 0;
    return {
      total: records.length,
      running: records.filter((record) => record.status === "running").length,
      completed: completed.length,
      failed: failed.length,
      averageLatencyMs: averageLatency,
      lastRunAt: records[0]?.started_at || null,
      path: this.ledgerPath
    };
  }

  async replay(runId) {
    const record = await this.get(runId);
    if (!record) throw new Error(`Run ledger record not found: ${runId}`);
    return {
      run_id: record.run_id,
      input: record.user_goal,
      workflow: record.workflow,
      taskType: record.taskType,
      models_used: record.models_used,
      memory_reads: record.memory_reads,
      decisions: record.decisions,
      tool_trace: record.events.filter((event) => event.type.startsWith("tool.") || event.type.startsWith("approval.")),
      artifacts: record.artifacts,
      failure: record.failure,
      final_response: record.final_response,
      status: record.status
    };
  }

  async #upsert(record) {
    await fs.promises.mkdir(this.ledgerDir, { recursive: true });
    const records = (await this.list({ limit: 10000 })).reverse();
    const index = records.findIndex((item) => item.run_id === record.run_id);
    if (index >= 0) records[index] = record;
    else records.push(record);
    await fs.promises.writeFile(this.ledgerPath, records.map((item) => JSON.stringify(item)).join("\n") + (records.length ? "\n" : ""), "utf8");
  }
}

function sanitizePayload(payload = {}) {
  if (payload === null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map((item) => sanitizePayload(item));
  const copy = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/secret|token|key|password/i.test(key)) {
      copy[key] = "[redacted]";
    } else if (value && typeof value === "object") {
      copy[key] = sanitizePayload(value);
    } else {
      copy[key] = value;
    }
  }
  return copy;
}
