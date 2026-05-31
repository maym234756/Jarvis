import fs from "node:fs";
import path from "node:path";
import { Chunker, hashText } from "../chunking/index.js";
import { resolveInsideRoot, toWorkspacePath } from "../tool-runtime/tools/path-utils.js";
import { cosineSimilarity, embedText, embedTexts } from "./embeddings.js";

const DEFAULT_EXTENSIONS = new Set([
  ".txt", ".md", ".mdx", ".json", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".css", ".html", ".py", ".ps1", ".sh", ".yml", ".yaml", ".toml", ".ini"
]);

const SKIP_DIRS = new Set([".git", ".jarvis", "node_modules", "coverage", ".test-output"]);

export class MemoryStore {
  constructor({ projectRoot, memoryDir, chunker } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.memoryDir = memoryDir || path.join(this.projectRoot, ".jarvis", "memory");
    this.indexPath = path.join(this.memoryDir, "chunks.jsonl");
    this.chunker = chunker || new Chunker();
    this.cache = {
      chunks: null,
      mtimeMs: null,
      size: null,
      loadedAt: null,
      hits: 0,
      misses: 0
    };
  }

  async addText(text, { sourcePath = "memory", title = sourcePath, tags = [] } = {}) {
    const chunks = this.chunker.chunkText(text, {
      doc_id: hashText(sourcePath).slice(0, 16),
      source_path: sourcePath,
      title,
      extension: path.extname(sourcePath).toLowerCase() || null,
      tags
    });
    await this.#enrichChunks(chunks);
    await this.#appendNewChunks(chunks);
    return withCitations(chunks);
  }

  async ingestPath(targetPath = ".", { projectRoot = this.projectRoot } = {}) {
    const target = resolveInsideRoot(projectRoot, targetPath);
    const chunks = await this.#buildChunksForPath(target, projectRoot);
    const result = await this.#appendNewChunks(chunks);
    return { files: new Set(chunks.map((chunk) => chunk.metadata.source_path)).size, ...result };
  }

  async rebuildIndex(targetPath = ".", { projectRoot = this.projectRoot } = {}) {
    const target = resolveInsideRoot(projectRoot, targetPath);
    const chunks = await this.#buildChunksForPath(target, projectRoot);
    await fs.promises.mkdir(this.memoryDir, { recursive: true });
    const tmpPath = `${this.indexPath}.tmp`;
    await fs.promises.writeFile(tmpPath, chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + (chunks.length ? "\n" : ""), "utf8");
    await fs.promises.rename(tmpPath, this.indexPath);
    this.#invalidateCache();
    return {
      files: new Set(chunks.map((chunk) => chunk.metadata.source_path)).size,
      chunks: chunks.length,
      indexPath: this.indexPath
    };
  }

  async compact() {
    const chunks = await this.#loadChunks();
    const unique = new Map();
    for (const chunk of chunks) {
      unique.set(`${chunk.metadata.source_path}:${chunk.metadata.hash}`, chunk);
    }
    const compacted = [...unique.values()].sort(compareChunks);
    await fs.promises.mkdir(this.memoryDir, { recursive: true });
    await fs.promises.writeFile(
      this.indexPath,
      compacted.map((chunk) => JSON.stringify(chunk)).join("\n") + (compacted.length ? "\n" : ""),
      "utf8"
    );
    this.#invalidateCache();
    return { before: chunks.length, after: compacted.length, removed: chunks.length - compacted.length };
  }

  async stats() {
    const chunks = await this.#loadChunks();
    const sources = new Set(chunks.map((chunk) => chunk.metadata.source_path));
    const docs = new Set(chunks.map((chunk) => chunk.metadata.doc_id));
    const tokens = chunks.reduce((sum, chunk) => sum + Number(chunk.metadata.tokens || 0), 0);
    let sizeBytes = 0;
    try {
      sizeBytes = (await fs.promises.stat(this.indexPath)).size;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return {
      chunks: chunks.length,
      sources: sources.size,
      docs: docs.size,
      tokens,
      sizeBytes,
      indexPath: this.indexPath,
      cache: this.cacheStatus()
    };
  }

  cacheStatus() {
    return {
      loaded: Boolean(this.cache.chunks),
      chunks: this.cache.chunks?.length || 0,
      loadedAt: this.cache.loadedAt,
      hits: this.cache.hits,
      misses: this.cache.misses
    };
  }

  async query(queryText, { limit = 5, filters = {} } = {}) {
    const chunks = applyFilters(await this.#loadChunks(), filters);
    if (!queryText?.trim()) {
      return withCitations(chunks.slice(-limit).reverse().map((chunk) => ({ ...chunk, score: 0 })));
    }

    const queryTerms = termCounts(queryText);
    const queryEmbedding = await embedText(queryText);
    const scored = chunks.map((chunk) => {
      const lexical = lexicalScore(queryTerms, chunk);
      const vector = cosineSimilarity(queryEmbedding, chunk.embedding || []);
      const metadata = metadataBoost(queryTerms, chunk);
      const score = lexical * 0.55 + Math.max(0, vector) * 0.35 + metadata;
      return {
        ...chunk,
        score,
        score_parts: { lexical, vector, metadata }
      };
    }).filter((chunk) => chunk.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return withCitations(scored.slice(0, limit));
  }

  async allChunks({ filters = {} } = {}) {
    return withCitations(applyFilters(await this.#loadChunks(), filters).sort(compareChunks));
  }

  async #buildChunksForPath(target, projectRoot) {
    const files = await collectFiles(target);
    const chunks = [];

    for (const filePath of files) {
      const extension = path.extname(filePath).toLowerCase();
      if (!DEFAULT_EXTENSIONS.has(extension)) continue;
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 2 * 1024 * 1024) continue;

      const text = await fs.promises.readFile(filePath, "utf8");
      const sourcePath = toWorkspacePath(projectRoot, filePath);
      chunks.push(...this.chunker.chunkText(text, {
        doc_id: hashText(sourcePath).slice(0, 16),
        source_path: sourcePath,
        title: path.basename(filePath),
        extension,
        file_size: stat.size,
        modified_at: stat.mtime.toISOString()
      }));
    }

    await this.#enrichChunks(chunks);
    return chunks;
  }

  async #enrichChunks(chunks) {
    if (!chunks.length) return;
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    for (let index = 0; index < chunks.length; index++) {
      chunks[index].embedding = embeddings[index];
      chunks[index].metadata.embedding_model = process.env.OPENAI_EMBEDDING_MODEL || "local-hash-v1";
    }
  }

  async #appendNewChunks(chunks) {
    await fs.promises.mkdir(this.memoryDir, { recursive: true });
    const existing = new Set((await this.#loadChunks()).map(chunkKey));
    const fresh = chunks.filter((chunk) => !existing.has(chunkKey(chunk)));
    if (fresh.length) {
      const lines = fresh.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n";
      await fs.promises.appendFile(this.indexPath, lines, "utf8");
      this.#invalidateCache();
    }
    return { added: fresh.length, skipped: chunks.length - fresh.length };
  }

  async #loadChunks() {
    try {
      const stat = await fs.promises.stat(this.indexPath);
      if (this.cache.chunks && this.cache.mtimeMs === stat.mtimeMs && this.cache.size === stat.size) {
        this.cache.hits++;
        return this.cache.chunks;
      }
      this.cache.misses++;
      const data = await fs.promises.readFile(this.indexPath, "utf8");
      const chunks = data.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
      this.cache.chunks = chunks;
      this.cache.mtimeMs = stat.mtimeMs;
      this.cache.size = stat.size;
      this.cache.loadedAt = new Date().toISOString();
      return chunks;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  #invalidateCache() {
    this.cache.chunks = null;
    this.cache.mtimeMs = null;
    this.cache.size = null;
    this.cache.loadedAt = null;
  }
}

async function collectFiles(target) {
  const stat = await fs.promises.stat(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const entries = await fs.promises.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function termCounts(text) {
  const terms = String(text).toLowerCase().match(/[a-z0-9_./-]+/g) || [];
  const counts = new Map();
  for (const term of terms) counts.set(term, (counts.get(term) || 0) + 1);
  return counts;
}

function lexicalScore(queryTerms, chunk) {
  const textTerms = termCounts(`${chunk.text} ${chunk.metadata?.title || ""} ${chunk.metadata?.source_path || ""}`);
  let dot = 0;
  let queryNorm = 0;
  let textNorm = 0;

  for (const count of queryTerms.values()) queryNorm += count * count;
  for (const count of textTerms.values()) textNorm += count * count;
  for (const [term, count] of queryTerms) dot += count * (textTerms.get(term) || 0);

  return dot && queryNorm && textNorm ? dot / (Math.sqrt(queryNorm) * Math.sqrt(textNorm)) : 0;
}

function metadataBoost(queryTerms, chunk) {
  const haystack = `${chunk.metadata?.source_path || ""} ${chunk.metadata?.title || ""}`.toLowerCase();
  return [...queryTerms.keys()].some((term) => haystack.includes(term)) ? 0.15 : 0;
}

function applyFilters(chunks, filters = {}) {
  return chunks.filter((chunk) => {
    const metadata = chunk.metadata || {};
    if (filters.sourcePath && metadata.source_path !== filters.sourcePath) return false;
    if (filters.sourceIncludes && !metadata.source_path?.toLowerCase().includes(String(filters.sourceIncludes).toLowerCase())) return false;
    if (filters.extension && metadata.extension !== normalizeExtension(filters.extension)) return false;
    if (filters.docId && metadata.doc_id !== filters.docId) return false;
    if (filters.title && metadata.title !== filters.title) return false;
    if (filters.since && new Date(metadata.created_at) < new Date(filters.since)) return false;
    if (filters.until && new Date(metadata.created_at) > new Date(filters.until)) return false;
    return true;
  });
}

function normalizeExtension(extension) {
  if (!extension) return extension;
  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}

function withCitations(chunks) {
  return chunks.map((chunk) => ({
    ...chunk,
    citation: createCitation(chunk)
  }));
}

function createCitation(chunk) {
  const metadata = chunk.metadata || {};
  const line = metadata.line_start ? `:${metadata.line_start}` : "";
  const end = metadata.line_end && metadata.line_end !== metadata.line_start ? `-${metadata.line_end}` : "";
  return {
    label: `${metadata.source_path || "memory"}${line}${end}`,
    source_path: metadata.source_path,
    line_start: metadata.line_start,
    line_end: metadata.line_end,
    chunk_id: metadata.chunk_id
  };
}

function chunkKey(chunk) {
  return `${chunk.metadata?.source_path || ""}:${chunk.metadata?.hash || hashText(chunk.text || "")}`;
}

function compareChunks(a, b) {
  return String(a.metadata?.source_path || "").localeCompare(String(b.metadata?.source_path || ""))
    || String(a.metadata?.chunk_id || "").localeCompare(String(b.metadata?.chunk_id || ""));
}
