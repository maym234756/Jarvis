import fs from "node:fs";
import path from "node:path";

export class EventBus {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "events");
    this.eventsPath = path.join(this.stateDir, "events.jsonl");
    this.subscribers = new Set();
  }

  async publish(type, payload = {}) {
    const event = {
      id: eventId(),
      type,
      timestamp: new Date().toISOString(),
      payload
    };
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.appendFile(this.eventsPath, `${JSON.stringify(event)}\n`, "utf8");
    this.#emit(event);
    return event;
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  async list({ limit = 100, type } = {}) {
    const events = await this.#readAll();
    return events
      .filter((event) => !type || event.type === type)
      .slice(-limit)
      .reverse();
  }

  async summary() {
    const events = await this.#readAll();
    const byType = {};
    for (const event of events) byType[event.type] = (byType[event.type] || 0) + 1;
    return {
      total: events.length,
      byType,
      path: this.eventsPath,
      lastEventAt: events.at(-1)?.timestamp || null
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

  #emit(event) {
    for (const listener of this.subscribers) {
      try {
        listener(event);
      } catch {
        this.subscribers.delete(listener);
      }
    }
  }
}

function eventId() {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
