import fs from "node:fs";
import path from "node:path";

export class ArtifactStore {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "artifacts");
    this.metaPath = path.join(this.stateDir, "artifacts.jsonl");
  }

  async create({ type = "text", title = "Artifact", content = "", sourceTask = null, verified = false, metadata = {} } = {}) {
    const id = `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const extension = safeExtension(type);
    const fileName = `${id}${extension}`;
    const now = new Date().toISOString();
    const artifact = {
      id,
      type,
      title,
      sourceTask,
      verified,
      version: 1,
      file: path.join(this.stateDir, fileName),
      metadata,
      created_at: now,
      updated_at: now
    };
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(artifact.file, String(content || ""), "utf8");
    await fs.promises.appendFile(this.metaPath, `${JSON.stringify(artifact)}\n`, "utf8");
    return artifact;
  }

  async list({ limit = 50, type } = {}) {
    const artifacts = await this.#readAll();
    return artifacts
      .filter((artifact) => !type || artifact.type === type)
      .slice(-limit)
      .reverse();
  }

  async summary() {
    const artifacts = await this.#readAll();
    const byType = {};
    for (const artifact of artifacts) byType[artifact.type] = (byType[artifact.type] || 0) + 1;
    return {
      total: artifacts.length,
      byType,
      path: this.stateDir,
      lastArtifactAt: artifacts.at(-1)?.created_at || null
    };
  }

  async #readAll() {
    try {
      const text = await fs.promises.readFile(this.metaPath, "utf8");
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
}

function safeExtension(type) {
  if (type === "json") return ".json";
  if (type === "markdown") return ".md";
  if (type === "log") return ".log";
  return ".txt";
}
