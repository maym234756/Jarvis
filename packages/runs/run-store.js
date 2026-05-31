import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class RunStore {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.runDir = path.join(this.projectRoot, ".jarvis", "runs");
    this.runPath = path.join(this.runDir, "runs.jsonl");
  }

  async startRun({ message, mode, privacyLevel, sessionId, taskType, workflow }) {
    const run = {
      id: crypto.randomUUID(),
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: null,
      message,
      mode,
      privacyLevel,
      sessionId: sessionId || null,
      taskType,
      workflow: workflow?.name || null,
      tool_count: 0,
      error: null
    };
    await this.#append(run);
    return run;
  }

  async completeRun(id, patch = {}) {
    const runs = await this.listRuns({ limit: 10000 });
    const index = runs.findIndex((run) => run.id === id);
    if (index === -1) throw new Error(`Run not found: ${id}`);

    const started = new Date(runs[index].started_at).getTime();
    const completed = new Date();
    runs[index] = {
      ...runs[index],
      ...patch,
      status: patch.error ? "failed" : "completed",
      completed_at: completed.toISOString(),
      duration_ms: completed.getTime() - started
    };
    await this.#rewrite(runs);
    return runs[index];
  }

  async listRuns({ limit = 20, sessionId } = {}) {
    try {
      const data = await fs.promises.readFile(this.runPath, "utf8");
      const runs = data.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
      const filtered = sessionId ? runs.filter((run) => run.sessionId === sessionId) : runs;
      return filtered.slice(-limit).reverse();
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async stats() {
    const runs = await this.listRuns({ limit: 10000 });
    return {
      total: runs.length,
      completed: runs.filter((run) => run.status === "completed").length,
      failed: runs.filter((run) => run.status === "failed").length,
      running: runs.filter((run) => run.status === "running").length,
      last_run_at: runs[0]?.started_at || null
    };
  }

  async #append(run) {
    await fs.promises.mkdir(this.runDir, { recursive: true });
    await fs.promises.appendFile(this.runPath, `${JSON.stringify(run)}\n`, "utf8");
  }

  async #rewrite(runs) {
    await fs.promises.mkdir(this.runDir, { recursive: true });
    const ordered = [...runs].sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
    await fs.promises.writeFile(this.runPath, ordered.map((run) => JSON.stringify(run)).join("\n") + (ordered.length ? "\n" : ""), "utf8");
  }
}
