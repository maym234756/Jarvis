import fs from "node:fs";
import path from "node:path";

export class MetricsStore {
  constructor({ projectRoot } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.metricsDir = path.join(this.projectRoot, ".jarvis", "metrics");
    this.metricsPath = path.join(this.metricsDir, "events.jsonl");
  }

  async record(event) {
    await fs.promises.mkdir(this.metricsDir, { recursive: true });
    await fs.promises.appendFile(this.metricsPath, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event
    })}\n`, "utf8");
  }

  async list({ limit = 100, type } = {}) {
    try {
      const data = await fs.promises.readFile(this.metricsPath, "utf8");
      const events = data.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
      const filtered = type ? events.filter((event) => event.type === type) : events;
      return filtered.slice(-limit).reverse();
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async summary() {
    const events = await this.list({ limit: 10000 });
    const byType = {};
    for (const event of events) {
      byType[event.type] ||= { count: 0, totalDurationMs: 0, failures: 0 };
      byType[event.type].count++;
      byType[event.type].totalDurationMs += Number(event.duration_ms || 0);
      if (event.ok === false) byType[event.type].failures++;
    }
    for (const value of Object.values(byType)) {
      value.avgDurationMs = value.count ? Number((value.totalDurationMs / value.count).toFixed(2)) : 0;
    }
    return {
      totalEvents: events.length,
      byType
    };
  }
}
