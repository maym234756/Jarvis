import fs from "node:fs";
import path from "node:path";
import { RISK_LEVELS } from "../policy-engine.js";
import { resolveInsideRoot, toWorkspacePath } from "./path-utils.js";

export class FileListTool {
  constructor() {
    this.name = "file.list";
    this.description = "List files inside the workspace.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `List ${args.path || "."}`;
  }

  async run(args, context) {
    const target = resolveInsideRoot(context.projectRoot, args.path || ".");
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
    })).sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));

    return {
      summary: `${files.length} item(s) in ${toWorkspacePath(context.projectRoot, target)}`,
      files
    };
  }
}

export class FileReadTool {
  constructor() {
    this.name = "file.read";
    this.description = "Read a text file inside the workspace.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Read ${args.path}`;
  }

  async run(args, context) {
    if (!args.path) throw new Error("path is required");
    const target = resolveInsideRoot(context.projectRoot, args.path);
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) throw new Error("target is not a file");
    if (stat.size > 1024 * 1024) throw new Error("file is larger than 1 MiB; ingest it instead");
    const content = await fs.promises.readFile(target, "utf8");
    return {
      summary: `${toWorkspacePath(context.projectRoot, target)} (${content.length} chars)`,
      content
    };
  }
}

export class FileWriteTool {
  constructor() {
    this.name = "file.write";
    this.description = "Write a text file inside the workspace.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Write ${args.path}`;
  }

  async run(args, context) {
    if (!args.path) throw new Error("path is required");
    if (typeof args.content !== "string") throw new Error("content is required");
    const target = resolveInsideRoot(context.projectRoot, args.path);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, args.content, "utf8");
    return {
      summary: `Wrote ${toWorkspacePath(context.projectRoot, target)} (${args.content.length} chars)`
    };
  }
}
