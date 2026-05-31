import fs from "node:fs";
import path from "node:path";

export class PreferenceStore {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "preferences");
    this.storePath = path.join(this.stateDir, "user.json");
  }

  async list({ includeExpired = false } = {}) {
    const records = await this.#read();
    const now = Date.now();
    return records
      .filter((record) => includeExpired || !record.expires_at || Date.parse(record.expires_at) > now)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  async effective() {
    const records = await this.list();
    return records.reduce((acc, record) => {
      acc[record.key] = record.value;
      return acc;
    }, {});
  }

  async set({ key, value, source = "user", confidence = 1, sensitivity = "normal", expiresAt = null } = {}) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) throw new Error("preference key is required");
    const now = new Date().toISOString();
    const record = {
      key: normalizedKey,
      value: String(value ?? ""),
      source,
      confidence: Number(confidence),
      sensitivity,
      expires_at: expiresAt || null,
      created_at: now,
      updated_at: now
    };
    const records = await this.#read();
    const index = records.findIndex((item) => item.key === normalizedKey);
    if (index >= 0) {
      record.created_at = records[index].created_at || now;
      records[index] = record;
    } else {
      records.push(record);
    }
    await this.#write(records);
    return record;
  }

  async remove(key) {
    const normalizedKey = normalizeKey(key);
    const records = await this.#read();
    const next = records.filter((record) => record.key !== normalizedKey);
    await this.#write(next);
    return { removed: records.length - next.length };
  }

  async garbageCollect({ minConfidence = 0.2 } = {}) {
    const records = await this.#read();
    const now = Date.now();
    const next = records.filter((record) => {
      if (record.expires_at && Date.parse(record.expires_at) <= now) return false;
      if (Number(record.confidence) < minConfidence) return false;
      return true;
    });
    await this.#write(next);
    return {
      before: records.length,
      after: next.length,
      removed: records.length - next.length
    };
  }

  async stats() {
    const records = await this.#read();
    const active = await this.list();
    return {
      total: records.length,
      active: active.length,
      expired: records.length - active.length,
      path: this.storePath
    };
  }

  async #read() {
    try {
      const data = JSON.parse(await fs.promises.readFile(this.storePath, "utf8"));
      return Array.isArray(data.preferences) ? data.preferences : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #write(preferences) {
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(this.storePath, JSON.stringify({ preferences }, null, 2), "utf8");
  }
}

function normalizeKey(key = "") {
  const value = String(key).trim().toLowerCase().replace(/\s+/g, ".");
  if (!value) return "";
  if (!/^[a-z0-9._-]+$/.test(value)) throw new Error(`Invalid preference key: ${key}`);
  return value;
}
