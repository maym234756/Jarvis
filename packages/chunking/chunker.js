import crypto from "node:crypto";

export function estimateTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export class Chunker {
  constructor({ maxTokens = 800, overlapTokens = 80 } = {}) {
    this.maxTokens = maxTokens;
    this.overlapTokens = Math.min(overlapTokens, Math.max(0, maxTokens - 1));
  }

  chunkText(text, metadata = {}) {
    const paragraphs = splitBlocks(text);
    if (!paragraphs.length) return [];

    const chunks = [];
    let current = [];
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph.text);
      if (paragraphTokens > this.maxTokens) {
        this.#flush(chunks, current, metadata);
        current = [];
        currentTokens = 0;
        this.#splitLargeParagraph(chunks, paragraph, metadata);
        continue;
      }

      if (currentTokens + paragraphTokens > this.maxTokens && current.length) {
        const previous = this.#flush(chunks, current, metadata);
        current = overlapTail(previous, this.overlapTokens);
        currentTokens = estimateTokens(current.map((part) => part.text).join("\n\n"));
      }

      current.push(paragraph);
      currentTokens += paragraphTokens;
    }

    this.#flush(chunks, current, metadata);
    return chunks.map((chunk, index) => {
      const docId = metadata.doc_id || hashText(metadata.source_path || chunk.text).slice(0, 16);
      const chunkId = `${docId}:${String(index + 1).padStart(4, "0")}`;
      return {
        ...chunk,
        metadata: {
          ...metadata,
          doc_id: docId,
          chunk_id: chunkId,
          title: metadata.title || metadata.source_path || "Untitled",
          section: metadata.section || null,
          source_path: metadata.source_path || "memory",
          created_at: metadata.created_at || new Date().toISOString(),
          line_start: chunk.metadata.line_start,
          line_end: chunk.metadata.line_end,
          tokens: estimateTokens(chunk.text),
          hash: hashText(chunk.text)
        }
      };
    });
  }

  #flush(chunks, parts, metadata) {
    if (!parts.length) return { text: "" };
    const normalizedParts = parts.map((part) => typeof part === "string" ? { text: part } : part);
    const text = normalizedParts.map((part) => part.text).join("\n\n").trim();
    const chunk = {
      text,
      metadata: {
        ...metadata,
        line_start: firstLine(normalizedParts),
        line_end: lastLine(normalizedParts),
        tokens: estimateTokens(text),
        hash: hashText(text)
      }
    };
    chunks.push(chunk);
    return chunk;
  }

  #splitLargeParagraph(chunks, paragraph, metadata) {
    const words = paragraph.text.split(/\s+/).filter(Boolean);
    let start = 0;
    while (start < words.length) {
      const end = Math.min(words.length, start + this.maxTokens);
      this.#flush(chunks, [{
        text: words.slice(start, end).join(" "),
        lineStart: paragraph.lineStart,
        lineEnd: paragraph.lineEnd
      }], metadata);
      if (end === words.length) break;
      start = Math.max(end - this.overlapTokens, start + 1);
    }
  }
}

function splitBlocks(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks = [];
  let current = [];
  let startLine = 1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      flushBlock(blocks, current, startLine, index);
      current = [];
      startLine = index + 2;
      continue;
    }
    if (!current.length) startLine = index + 1;
    current.push(line);
  }

  flushBlock(blocks, current, startLine, lines.length);
  return blocks;
}

function flushBlock(blocks, current, startLine, endLine) {
  if (!current.length) return;
  blocks.push({
    text: current.join("\n").trim(),
    lineStart: startLine,
    lineEnd: endLine
  });
}

function firstLine(parts) {
  return parts.find((part) => part.lineStart !== undefined)?.lineStart || null;
}

function lastLine(parts) {
  return [...parts].reverse().find((part) => part.lineEnd !== undefined)?.lineEnd || null;
}

function overlapTail(chunk, overlapTokens) {
  if (!chunk?.text || overlapTokens <= 0) return [];
  const words = chunk.text.split(/\s+/).filter(Boolean);
  const text = words.slice(Math.max(0, words.length - overlapTokens)).join(" ");
  return [{
    text,
    lineStart: chunk.metadata.line_end,
    lineEnd: chunk.metadata.line_end
  }].filter((part) => part.text);
}
