import fs from "node:fs";
import path from "node:path";

const IGNORE_DIRS = new Set([".git", ".jarvis", "node_modules", "coverage", ".test-output"]);
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".md", ".css", ".html", ".yml", ".yaml"]);

export class RepoIntelligence {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
  }

  async buildMap({ maxFiles = 500 } = {}) {
    const files = await walk(this.projectRoot, { maxFiles });
    const packageInfo = await readPackageInfo(this.projectRoot);
    const fileSummaries = [];
    for (const file of files.filter((item) => TEXT_EXTENSIONS.has(path.extname(item)))) {
      fileSummaries.push(await summarizeFile(this.projectRoot, file));
    }

    return {
      generated_at: new Date().toISOString(),
      root: this.projectRoot,
      package: packageInfo,
      files: fileSummaries,
      summary: summarizeRepo(fileSummaries, packageInfo),
      tests: detectTests(fileSummaries, packageInfo),
      languages: countBy(fileSummaries.map((file) => file.extension || "none")),
      topDirectories: countBy(fileSummaries.map((file) => firstDir(file.path))),
      symbols: fileSummaries.flatMap((file) => file.symbols.map((symbol) => ({ ...symbol, path: file.path }))).slice(0, 200)
    };
  }
}

async function walk(root, { maxFiles }) {
  const found = [];
  async function visit(dir) {
    if (found.length >= maxFiles) return;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (found.length >= maxFiles) return;
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(root, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) await visit(fullPath);
      } else if (entry.isFile()) {
        found.push(rel);
      }
    }
  }
  await visit(root);
  return found;
}

async function summarizeFile(root, relPath) {
  const fullPath = path.join(root, relPath);
  const stat = await fs.promises.stat(fullPath);
  const extension = path.extname(relPath);
  const text = stat.size <= 150000 ? await fs.promises.readFile(fullPath, "utf8") : "";
  return {
    path: relPath,
    extension,
    sizeBytes: stat.size,
    lines: text ? text.split(/\r?\n/).length : null,
    symbols: extractSymbols(text, extension)
  };
}

async function readPackageInfo(root) {
  try {
    const data = JSON.parse(await fs.promises.readFile(path.join(root, "package.json"), "utf8"));
    return {
      name: data.name || null,
      version: data.version || null,
      type: data.type || null,
      scripts: data.scripts || {},
      dependencies: Object.keys(data.dependencies || {}),
      devDependencies: Object.keys(data.devDependencies || {})
    };
  } catch {
    return null;
  }
}

function extractSymbols(text, extension) {
  if (!text || ![".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(extension)) return [];
  const symbols = [];
  const patterns = [
    { kind: "class", regex: /\bexport\s+class\s+([A-Za-z_$][\w$]*)|\bclass\s+([A-Za-z_$][\w$]*)/g },
    { kind: "function", regex: /\bexport\s+function\s+([A-Za-z_$][\w$]*)|\bfunction\s+([A-Za-z_$][\w$]*)/g },
    { kind: "const", regex: /\bexport\s+const\s+([A-Za-z_$][\w$]*)/g }
  ];
  for (const item of patterns) {
    for (const match of text.matchAll(item.regex)) {
      symbols.push({ kind: item.kind, name: match[1] || match[2] });
      if (symbols.length >= 30) return symbols;
    }
  }
  return symbols;
}

function summarizeRepo(files, packageInfo) {
  return {
    files: files.length,
    codeFiles: files.filter((file) => [".js", ".mjs", ".ts", ".tsx", ".jsx"].includes(file.extension)).length,
    docs: files.filter((file) => file.extension === ".md").length,
    packageName: packageInfo?.name || null,
    scripts: Object.keys(packageInfo?.scripts || {})
  };
}

function detectTests(files, packageInfo) {
  const testFiles = files.filter((file) => /\btest\b|\.test\.|\.spec\./i.test(file.path));
  const scripts = Object.entries(packageInfo?.scripts || {})
    .filter(([name]) => /test|lint|typecheck|check/i.test(name))
    .map(([name, command]) => ({ name, command }));
  return {
    files: testFiles.map((file) => file.path),
    scripts
  };
}

function firstDir(relPath) {
  const parts = relPath.split("/");
  return parts.length > 1 ? parts[0] : ".";
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
