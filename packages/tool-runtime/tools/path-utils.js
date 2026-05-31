import path from "node:path";

export function resolveInsideRoot(projectRoot, targetPath = ".") {
  const root = path.resolve(projectRoot || process.cwd());
  const candidate = path.resolve(root, targetPath);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return candidate;
}

export function toWorkspacePath(projectRoot, absolutePath) {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(absolutePath));
  return relative || ".";
}
