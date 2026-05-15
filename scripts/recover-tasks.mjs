#!/usr/bin/env node
// Recover already-submitted kie.ai tasks by polling their IDs and downloading.
// Usage: node scripts/recover-tasks.mjs <out-dir-name> <taskId1> [taskId2] ...

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const POLL_S = 8, TIMEOUT_S = 900;

async function loadEnv() {
  const txt = await fs.readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function poll(taskId, apiKey) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < TIMEOUT_S) {
    const res = await fetch(`${STATUS_URL}?taskId=${taskId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const j = await res.json();
    if (j.code === 200) {
      const d = j.data || {};
      if (d.state === "success") {
        const parsed = JSON.parse(d.resultJson || "{}");
        return parsed.resultUrls?.[0];
      }
      if (d.state === "fail") throw new Error(`fail: ${d.failMsg}`);
      process.stdout.write(`  [${taskId.slice(-8)}] ${d.state} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    }
    await new Promise(r => setTimeout(r, POLL_S * 1000));
  }
  throw new Error(`timeout ${taskId}`);
}

async function download(url) {
  const r = await fetch(url);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  await loadEnv();
  const apiKey = process.env.KIE_API_KEY;
  const [outName, ...taskIds] = process.argv.slice(2);
  if (!outName || !taskIds.length) throw new Error("usage: recover-tasks.mjs <out-dir-name> <taskId> ...");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(ROOT, "scratch/upscale-out", `${outName}-${stamp}`);
  await fs.mkdir(outDir, { recursive: true });

  await Promise.all(taskIds.map(async (taskId, i) => {
    const url = await poll(taskId, apiKey);
    const buf = await download(url);
    const fn = path.join(outDir, `variant-${i + 1}.png`);
    await fs.writeFile(fn, buf);
    console.log(`  ✓ variant ${i + 1}: ${path.relative(ROOT, fn)} (${(buf.length / 1024).toFixed(0)}KB)`);
  }));
  console.log(`\nout: ${path.relative(ROOT, outDir)}`);
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1); });
