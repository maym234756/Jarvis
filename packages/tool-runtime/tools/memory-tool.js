import { RISK_LEVELS } from "../policy-engine.js";

export class MemoryIngestTool {
  constructor(memoryStore) {
    this.name = "memory.ingest";
    this.description = "Chunk and index a workspace file or directory.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Ingest ${args.path || "."}`;
  }

  async run(args, context) {
    const result = await this.memoryStore.ingestPath(args.path || ".", { projectRoot: context.projectRoot });
    return {
      summary: `Indexed ${result.added} new chunk(s) from ${result.files} file(s)`,
      ...result
    };
  }
}

export class MemoryRebuildTool {
  constructor(memoryStore) {
    this.name = "memory.rebuild";
    this.description = "Rebuild the memory index from a workspace file or directory.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Rebuild memory from ${args.path || "."}`;
  }

  async run(args, context) {
    const result = await this.memoryStore.rebuildIndex(args.path || ".", { projectRoot: context.projectRoot });
    return {
      summary: `Rebuilt ${result.chunks} chunk(s) from ${result.files} file(s)`,
      ...result
    };
  }
}

export class MemoryCompactTool {
  constructor(memoryStore) {
    this.name = "memory.compact";
    this.description = "Deduplicate and rewrite the memory index.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Compact memory index";
  }

  async run() {
    const result = await this.memoryStore.compact();
    return {
      summary: `Compacted memory from ${result.before} to ${result.after} chunk(s)`,
      ...result
    };
  }
}

export class MemoryStatsTool {
  constructor(memoryStore) {
    this.name = "memory.stats";
    this.description = "Show memory index statistics.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Show memory stats";
  }

  async run() {
    const stats = await this.memoryStore.stats();
    return {
      summary: `${stats.chunks} chunk(s), ${stats.sources} source(s), ${stats.tokens} token(s)`,
      stats
    };
  }
}

export class MemoryQueryTool {
  constructor(memoryStore) {
    this.name = "memory.query";
    this.description = "Query Jarvis project memory.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Query memory for "${args.query}"`;
  }

  async run(args) {
    const matches = await this.memoryStore.query(args.query || "", {
      limit: args.limit || 5,
      filters: args.filters || {}
    });
    return {
      summary: `${matches.length} memory match(es)`,
      matches
    };
  }
}

export class MemoryAddTool {
  constructor(memoryStore) {
    this.name = "memory.add";
    this.description = "Add a short note to Jarvis memory.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.memoryStore = memoryStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Add memory note";
  }

  async run(args) {
    if (!args.text) throw new Error("text is required");
    const chunks = await this.memoryStore.addText(args.text, {
      sourcePath: args.sourcePath || "user-memory",
      title: args.title || "User memory"
    });
    return {
      summary: `Added ${chunks.length} memory chunk(s)`,
      chunks
    };
  }
}
