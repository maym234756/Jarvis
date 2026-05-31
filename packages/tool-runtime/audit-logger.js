import fs from "node:fs";
import path from "node:path";

export class AuditLogger {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.logPath = path.join(this.projectRoot, ".jarvis", "logs", "audit.jsonl");
  }

  async write(event) {
    await fs.promises.mkdir(path.dirname(this.logPath), { recursive: true });
    const payload = {
      timestamp: new Date().toISOString(),
      ...event
    };
    await fs.promises.appendFile(this.logPath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}
