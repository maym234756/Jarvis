import fs from "node:fs";
import path from "node:path";

const ALLOWED_TRANSITIONS = {
  NEW: ["CONTEXT_GATHERING", "NEEDS_USER_APPROVAL", "FAILED"],
  CONTEXT_GATHERING: ["PLAN_READY", "EXECUTING", "FAILED"],
  PLAN_READY: ["EXECUTING", "NEEDS_USER_APPROVAL", "FAILED"],
  EXECUTING: ["VERIFYING", "NEEDS_USER_APPROVAL", "FAILED"],
  VERIFYING: ["COMPLETE", "FAILED"],
  NEEDS_USER_APPROVAL: ["EXECUTING", "FAILED"],
  COMPLETE: [],
  FAILED: []
};

export class WorkflowStateStore {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "workflow-state");
  }

  async create({ runId, workflow, goal, taskType }) {
    if (!runId) throw new Error("runId is required");
    const now = new Date().toISOString();
    const state = {
      runId,
      goal,
      taskType,
      workflow: workflow?.name || workflow || "unknown",
      status: "NEW",
      currentStep: null,
      transitions: [{ from: null, to: "NEW", at: now, note: "created" }],
      agents: [],
      toolsUsed: [],
      filesChanged: [],
      approvals: [],
      errors: [],
      created_at: now,
      updated_at: now
    };
    await this.#write(state);
    return state;
  }

  async transition(runId, to, { note = "", currentStep = null, tool = null, error = null } = {}) {
    const state = await this.get(runId);
    const allowed = ALLOWED_TRANSITIONS[state.status] || [];
    if (!allowed.includes(to)) throw new Error(`Invalid workflow transition ${state.status} -> ${to}`);
    const now = new Date().toISOString();
    state.transitions.push({ from: state.status, to, at: now, note });
    state.status = to;
    state.updated_at = now;
    if (currentStep) state.currentStep = currentStep;
    if (tool && !state.toolsUsed.includes(tool)) state.toolsUsed.push(tool);
    if (error) state.errors.push({ at: now, error });
    await this.#write(state);
    return state;
  }

  async get(runId) {
    if (!runId) throw new Error("runId is required");
    try {
      return JSON.parse(await fs.promises.readFile(this.#path(runId), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Workflow state not found: ${runId}`);
      throw error;
    }
  }

  async list({ limit = 50 } = {}) {
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    const files = (await fs.promises.readdir(this.stateDir)).filter((file) => file.endsWith(".json"));
    const states = [];
    for (const file of files) states.push(JSON.parse(await fs.promises.readFile(path.join(this.stateDir, file), "utf8")));
    return states.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, limit);
  }

  async summary() {
    const states = await this.list({ limit: 10000 });
    const byStatus = {};
    for (const state of states) byStatus[state.status] = (byStatus[state.status] || 0) + 1;
    return {
      total: states.length,
      byStatus,
      path: this.stateDir
    };
  }

  #path(runId) {
    const safe = String(runId).replace(/[^a-z0-9._-]/gi, "_");
    return path.join(this.stateDir, `${safe}.json`);
  }

  async #write(state) {
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(this.#path(state.runId), JSON.stringify(state, null, 2), "utf8");
  }
}
