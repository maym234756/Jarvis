import crypto from "node:crypto";

const DEFAULT_DIMENSIONS = 128;

export async function embedText(text, options = {}) {
  const [embedding] = await embedTexts([text], options);
  return embedding;
}

export async function embedTexts(texts, options = {}) {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_EMBEDDING_MODEL) {
    try {
      return await openAIEmbeddings(texts, options);
    } catch {
      return texts.map((text) => localEmbedding(text, options));
    }
  }
  return texts.map((text) => localEmbedding(text, options));
}

export function localEmbedding(text, { dimensions = DEFAULT_DIMENSIONS } = {}) {
  const vector = new Array(dimensions).fill(0);
  const terms = String(text).toLowerCase().match(/[a-z0-9_./-]+/g) || [];
  for (const term of terms) {
    const hash = crypto.createHash("sha256").update(term).digest();
    const index = hash.readUInt32BE(0) % dimensions;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.log(term.length));
  }
  return normalize(vector);
}

export function cosineSimilarity(a = [], b = []) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index++) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return dot && normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

async function openAIEmbeddings(texts) {
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL,
      input: texts
    })
  });

  if (!response.ok) throw new Error(`OpenAI embeddings failed: ${response.status}`);
  const data = await response.json();
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((item) => normalize(item.embedding));
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}
