import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

export class EnvironmentInspector {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
  }

  async inspect() {
    const packageJson = await readPackageJson(this.projectRoot);
    return {
      generated_at: new Date().toISOString(),
      workspace: this.projectRoot,
      os: {
        platform: process.platform,
        type: os.type(),
        release: os.release(),
        arch: os.arch()
      },
      node: {
        version: process.version,
        execPath: process.execPath
      },
      shell: process.env.SHELL || process.env.ComSpec || null,
      packageManager: detectPackageManager(this.projectRoot, packageJson),
      package: packageJson ? { name: packageJson.name || null, scripts: Object.keys(packageJson.scripts || {}) } : null,
      networkConfigured: Boolean(process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY || process.env.OPENAI_API_KEY),
      git: await gitStatus(this.projectRoot),
      resources: {
        cpus: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMb: Math.round(os.freemem() / 1024 / 1024)
      }
    };
  }
}

async function readPackageJson(root) {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function detectPackageManager(root, packageJson) {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(root, "package-lock.json"))) return "npm";
  if (packageJson) return "npm";
  return null;
}

function gitStatus(root) {
  return new Promise((resolve) => {
    execFile("git", ["status", "--short"], { cwd: root, timeout: 3000, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve({ available: false, dirty: null, summary: error.message });
        return;
      }
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      resolve({
        available: true,
        dirty: lines.length > 0,
        changed: lines.length,
        sample: lines.slice(0, 20)
      });
    });
  });
}
