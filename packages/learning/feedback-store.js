import fs from "node:fs";
import path from "node:path";

export class FeedbackStore {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "feedback");
    this.eventsPath = path.join(this.stateDir, "events.jsonl");
  }

  async record(input = {}) {
    const event = {
      id: input.id || cryptoId(),
      timestamp: new Date().toISOString(),
      source: input.source || "system",
      taskType: input.taskType || "unknown",
      workflow: input.workflow || null,
      runtimeProfile: input.runtimeProfile || null,
      modelProvider: input.modelProvider || null,
      ok: input.ok !== false,
      score: typeof input.score === "number" ? input.score : input.ok === false ? 0 : 1,
      labels: Array.isArray(input.labels) ? input.labels : [],
      note: input.note || "",
      metadata: input.metadata || {}
    };
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.appendFile(this.eventsPath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }

  async list({ limit = 50, taskType } = {}) {
    const events = await this.#readAll();
    return events
      .filter((event) => !taskType || event.taskType === taskType)
      .slice(-limit)
      .reverse();
  }

  async summary() {
    const events = await this.#readAll();
    const byTask = {};
    const byProfile = {};
    for (const event of events) {
      accumulate(byTask, event.taskType, event);
      accumulate(byProfile, event.runtimeProfile || "unknown", event);
    }
    return {
      total: events.length,
      successRate: rate(events),
      byTask,
      byProfile,
      path: this.eventsPath
    };
  }

  async #readAll() {
    try {
      const text = await fs.promises.readFile(this.eventsPath, "utf8");
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
}

function accumulate(target, key, event) {
  if (!target[key]) target[key] = { total: 0, ok: 0, avgScore: 0 };
  target[key].total++;
  if (event.ok) target[key].ok++;
  target[key].avgScore = Number((((target[key].avgScore * (target[key].total - 1)) + event.score) / target[key].total).toFixed(3));
  target[key].successRate = Number((target[key].ok / target[key].total).toFixed(3));
}

function rate(events) {
  if (!events.length) return null;
  return Number((events.filter((event) => event.ok).length / events.length).toFixed(3));
}

function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
