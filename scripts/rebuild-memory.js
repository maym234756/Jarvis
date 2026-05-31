#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";

loadEnv();
const target = process.argv[2] || ".";
const memoryStore = new MemoryStore({ projectRoot: process.cwd() });
const result = await memoryStore.rebuildIndex(target);

console.log(`Rebuilt ${result.chunks} chunk(s) from ${result.files} file(s).`);
