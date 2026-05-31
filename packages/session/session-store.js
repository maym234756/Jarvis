import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class SessionStore {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.sessionDir = path.join(this.projectRoot, ".jarvis", "sessions");
  }

  async createSession({ title = "Jarvis session", mode = "agent", privacyLevel = "project" } = {}) {
    const now = new Date().toISOString();
    const session = {
      id: crypto.randomUUID(),
      title,
      mode,
      privacyLevel,
      created_at: now,
      updated_at: now,
      messages: []
    };
    await this.#writeSession(session);
    return summarizeSession(session);
  }

  async appendMessage(sessionId, message) {
    const session = await this.getSession(sessionId);
    session.messages.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...message
    });
    session.updated_at = new Date().toISOString();
    await this.#writeSession(session);
    return session.messages.at(-1);
  }

  async listSessions({ limit = 20 } = {}) {
    await fs.promises.mkdir(this.sessionDir, { recursive: true });
    const files = (await fs.promises.readdir(this.sessionDir))
      .filter((file) => file.endsWith(".json"));
    const sessions = [];
    for (const file of files) {
      const session = JSON.parse(await fs.promises.readFile(path.join(this.sessionDir, file), "utf8"));
      sessions.push(summarizeSession(session));
    }
    sessions.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return sessions.slice(0, limit);
  }

  async getSession(sessionId) {
    if (!sessionId) throw new Error("sessionId is required");
    const sessionPath = this.#sessionPath(sessionId);
    try {
      return JSON.parse(await fs.promises.readFile(sessionPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Session not found: ${sessionId}`);
      throw error;
    }
  }

  #sessionPath(sessionId) {
    if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new Error(`Invalid session id: ${sessionId}`);
    return path.join(this.sessionDir, `${sessionId}.json`);
  }

  async #writeSession(session) {
    await fs.promises.mkdir(this.sessionDir, { recursive: true });
    await fs.promises.writeFile(this.#sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
  }
}

function summarizeSession(session) {
  return {
    id: session.id,
    title: session.title,
    mode: session.mode,
    privacyLevel: session.privacyLevel,
    created_at: session.created_at,
    updated_at: session.updated_at,
    messages: session.messages.length
  };
}
