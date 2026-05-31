#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";

loadEnv();
const target = process.argv[2] || ".";
const memoryStore = new MemoryStore({ projectRoot: process.cwd() });
const result = await memoryStore.ingestPath(target);

console.log(`Indexed ${result.added} new chunk(s) from ${result.files} file(s).`);
if (result.skipped) console.log(`Skipped ${result.skipped} duplicate, unsupported, or oversized item(s).`);
