#!/usr/bin/env node
// Tiny static + picks-write server for the upscale review page.
// Serves scratch/ on the chosen port. Adds:
//   GET  /picks          → returns scratch/upscale-review/picks.json (or {})
//   POST /picks          → overwrites picks.json with the JSON body
// No npm deps. Run: node scripts/review-server.mjs [port]

import http from "node:http";
import fs from "node:fs/promises";
import { createReadStream, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WEBROOT = path.join(ROOT, "scratch");
const PICKS_PATH = path.join(WEBROOT, "upscale-review", "picks.json");
const LESSONS_PATH = path.join(WEBROOT, "upscale-lessons.json");
const RETRY_LOG = path.join(WEBROOT, "upscale-review", "retry.log");
const PORT = parseInt(process.argv[2] || "8765", 10);

// Track in-flight retries so the UI can show a "retrying…" indicator
const inFlight = new Set();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg":  "image/jpeg", ".jpeg": "image/jpeg",
  ".png":  "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".svg":  "image/svg+xml",
  ".txt":  "text/plain; charset=utf-8",
};

function send(res, code, headers, body) {
  res.writeHead(code, { "Access-Control-Allow-Origin": "*", ...headers });
  if (body && body.pipe) body.pipe(res); else res.end(body);
}

async function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let chunks = [], n = 0;
    req.on("data", c => { n += c.length; if (n > maxBytes) reject(new Error("body too large")); else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return send(res, 204, { "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    }

    // Picks endpoints
    if (pathname === "/picks" && req.method === "GET") {
      let body = "{}";
      try { body = await fs.readFile(PICKS_PATH, "utf8"); } catch (_) {}
      return send(res, 200, { "Content-Type": MIME[".json"] }, body);
    }
    if (pathname === "/picks" && req.method === "POST") {
      const body = await readBody(req);
      JSON.parse(body); // validate
      await fs.mkdir(path.dirname(PICKS_PATH), { recursive: true });
      await fs.writeFile(PICKS_PATH, body, "utf8");
      console.log(`[picks] saved (${body.length} bytes)`);
      return send(res, 200, { "Content-Type": MIME[".json"] }, JSON.stringify({ ok: true }));
    }

    // Status endpoint — what's currently being retried
    if (pathname === "/status" && req.method === "GET") {
      return send(res, 200, { "Content-Type": MIME[".json"] }, JSON.stringify({ in_flight: [...inFlight] }));
    }

    // Retry endpoint — { piece: "IMG_1267", target: "content/images/IMG_1267.JPG",
    //                    reasons: ["over-warm palette", ...], n: 2 }
    if (pathname === "/retry" && req.method === "POST") {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const { piece, target, reasons = [], n = 2 } = body;
      if (!piece || !target) {
        return send(res, 400, { "Content-Type": MIME[".json"] }, JSON.stringify({ error: "piece + target required" }));
      }

      // 1) Append reasons to scratch/upscale-lessons.json under the piece key
      let lessonsFile = {};
      try { lessonsFile = JSON.parse(await fs.readFile(LESSONS_PATH, "utf8")); } catch (_) {}
      const fname = path.basename(target);
      const existing = Array.isArray(lessonsFile[fname]) ? lessonsFile[fname] : [];
      const newReasons = reasons.filter(r => r && r.trim() && !existing.includes(r));
      lessonsFile[fname] = [...existing, ...newReasons];
      await fs.mkdir(path.dirname(LESSONS_PATH), { recursive: true });
      await fs.writeFile(LESSONS_PATH, JSON.stringify(lessonsFile, null, 2), "utf8");

      // 2) Spawn upscale-gpt2.mjs as a child process
      const lessonArg = lessonsFile[fname].join(" | ");
      const args = ["scripts/upscale-gpt2.mjs", target, "--n", String(n)];
      if (lessonArg) args.push("--lessons", lessonArg);

      const child = spawn("node", args, { cwd: ROOT, detached: false });
      inFlight.add(piece);

      let log = `\n=== retry ${piece} ${new Date().toISOString()} ===\n`;
      log += `reasons added: ${newReasons.join(" | ") || "(none new)"}\n`;
      log += `total lessons: ${lessonsFile[fname].length}\n\n`;
      await fs.appendFile(RETRY_LOG, log);

      child.stdout.on("data", (d) => fs.appendFile(RETRY_LOG, d.toString()).catch(() => {}));
      child.stderr.on("data", (d) => fs.appendFile(RETRY_LOG, d.toString()).catch(() => {}));
      child.on("exit", (code) => {
        inFlight.delete(piece);
        fs.appendFile(RETRY_LOG, `\n=== exit ${piece} code=${code} ===\n`).catch(() => {});
        console.log(`[retry] ${piece} done (exit ${code})`);
        // Rebuild the review manifest so new variants surface in the UI
        const rebuild = spawn("bash", ["scripts/build-review.sh"], { cwd: ROOT });
        rebuild.on("exit", () => console.log(`[retry] manifest rebuilt for ${piece}`));
      });

      console.log(`[retry] launched ${piece} with ${lessonsFile[fname].length} lessons`);
      return send(res, 200, { "Content-Type": MIME[".json"] }, JSON.stringify({
        ok: true,
        piece,
        lessons_total: lessonsFile[fname].length,
        lessons_added: newReasons.length,
      }));
    }

    // Get current lessons for a piece — used by the UI to show what's been learned
    if (pathname === "/lessons" && req.method === "GET") {
      let body = "{}";
      try { body = await fs.readFile(LESSONS_PATH, "utf8"); } catch (_) {}
      return send(res, 200, { "Content-Type": MIME[".json"] }, body);
    }

    // Static file from WEBROOT
    let filePath = path.join(WEBROOT, pathname);
    // Resolve directories to index.html
    try {
      const st = statSync(filePath);
      if (st.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch (_) {
      return send(res, 404, { "Content-Type": "text/plain" }, "404 not found");
    }
    // Path safety — must stay inside WEBROOT
    if (!path.resolve(filePath).startsWith(WEBROOT)) {
      return send(res, 403, { "Content-Type": "text/plain" }, "403 forbidden");
    }
    const ext = path.extname(filePath).toLowerCase();
    return send(res, 200, { "Content-Type": MIME[ext] || "application/octet-stream" }, createReadStream(filePath));
  } catch (err) {
    console.error("ERR:", err.message);
    return send(res, 500, { "Content-Type": "text/plain" }, "500: " + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`review server: http://localhost:${PORT}/upscale-review/`);
  console.log(`picks land at: ${path.relative(ROOT, PICKS_PATH)}`);
});
