#!/usr/bin/env node
// Multi-image gpt-image-2 upscale via kie.ai for fine-art pieces.
// Target image gives all composition/color/lighting; brushwork reference
// images (artist's own work) contribute only stroke density/character so
// newly resolved detail matches the artist's hand. No npm deps.
//
// Why kie.ai: ~9× cheaper than direct OpenAI for gpt-image-2 at 2K/4K.
// Trade-off: async job-based API (submit → poll → download).
//
// Usage:
//   node scripts/upscale-gpt2.mjs <target> [opts]
//
// Options:
//   --refs a.jpg,b.jpg     Comma-separated reference images
//                          (default: scratch/upscale-refs/adam_head_raw.jpg,
//                                    scratch/upscale-refs/eve_head_raw.jpg)
//   --no-refs              Don't send any references (target only)
//   --n 3                  Number of variants — submitted as N parallel tasks (default 3)
//   --aspect auto          1:1 | 9:16 | 16:9 | 3:4 | 4:3 | auto (default: from source dims)
//   --res 4K               1K | 2K | 4K (default: from source dims)
//   --out <dir>            Output directory (default scratch/upscale-out)
//   --source <text>        Per-piece description for the prompt
//   --dry                  Print prompt + plan, don't upload or submit

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const KIE_TASK_URL    = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL  = "https://api.kie.ai/api/v1/jobs/recordInfo";
const KIE_UPLOAD_URL  = "https://kieai.redpandaai.co/api/file-stream-upload";
const MODEL           = "gpt-image-2-image-to-image";
const POLL_INTERVAL_S = 8;
const POLL_TIMEOUT_S  = 900;

// ---------- .env loader ----------
async function loadEnv() {
  try {
    const txt = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch (_) { /* no .env, env vars must come from shell */ }
}

// ---------- source-aware presets ----------
function readDims(p) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", p], { encoding: "utf8" });
  const w = parseInt(out.match(/pixelWidth:\s+(\d+)/)[1], 10);
  const h = parseInt(out.match(/pixelHeight:\s+(\d+)/)[1], 10);
  return [w, h];
}
function pickAspect(w, h) {
  const a = w / h;
  const presets = { "1:1": 1, "9:16": 0.5625, "16:9": 16/9, "3:4": 0.75, "4:3": 4/3 };
  let best = "auto", bestDiff = Infinity;
  for (const [k, v] of Object.entries(presets)) {
    const d = Math.abs(Math.log(a) - Math.log(v));
    if (d < bestDiff) { bestDiff = d; best = k; }
  }
  return best;
}
function pickResolution(w, h) {
  return Math.max(w, h) >= 1500 ? "4K" : "2K";
}

// ---------- arg parsing ----------
function parseArgs(argv) {
  const args = { _: [], refs: null, noRefs: false, n: 2, aspect: "auto", res: "auto",
                 out: "scratch/upscale-out", source: null, dry: false, lessons: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--refs")          args.refs = argv[++i].split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--no-refs")  args.noRefs = true;
    else if (a === "--n")        args.n = parseInt(argv[++i], 10);
    else if (a === "--aspect")   args.aspect = argv[++i];
    else if (a === "--res")      args.res = argv[++i];
    else if (a === "--out")      args.out = argv[++i];
    else if (a === "--source")   args.source = argv[++i];
    else if (a === "--lessons")  args.lessons = argv[++i].split("|").map(s => s.trim()).filter(Boolean);
    else if (a === "--dry")      args.dry = true;
    else if (a.startsWith("--")) throw new Error(`unknown flag: ${a}`);
    else                         args._.push(a);
  }
  if (!args._[0]) throw new Error("target image path required");
  if (args.noRefs) args.refs = [];
  else if (!args.refs) args.refs = [
    "scratch/upscale-refs/adam_head_raw.jpg",
    "scratch/upscale-refs/eve_head_raw.jpg",
  ];
  return args;
}

// ---------- per-piece source descriptions ----------
// Loaded from scratch/upscale-sources.json if present. Keyed by target filename
// (basename, case-insensitive). Falls back to generic description.
async function loadSourceMap() {
  try {
    const txt = await fs.readFile(path.join(ROOT, "scratch/upscale-sources.json"), "utf8");
    const raw = JSON.parse(txt);
    const map = {};
    for (const [k, v] of Object.entries(raw)) map[k.toLowerCase()] = v;
    return map;
  } catch (_) { return {}; }
}

// ---------- per-piece lessons (failure feedback from prior runs) ----------
// scratch/upscale-lessons.json — keyed by filename, value is array of strings
// describing failures from previous user-rejected runs.
async function loadLessonsMap() {
  try {
    const txt = await fs.readFile(path.join(ROOT, "scratch/upscale-lessons.json"), "utf8");
    const raw = JSON.parse(txt);
    const map = {};
    for (const [k, v] of Object.entries(raw)) map[k.toLowerCase()] = Array.isArray(v) ? v : [];
    return map;
  } catch (_) { return {}; }
}

// ---------- prompt builder ----------
// Schema follows convergent best practices from Nano Banana Pro (Google) and
// gpt-image-2 (OpenAI) prompting guides: top-level `meta`, indexed `inputs`
// with explicit roles, structured `source` description (not freeform prose),
// separate `preserve_exactly` and `negative_constraints` blocks, terse array
// of negative constraints (JSON-prompt native). Research shows ~92% precision
// for structured JSON vs ~68% for prose on color/lighting/composition fidelity.
function buildPrompt({ aspect, resolution, sourceDescription, hasRefs, lessons = [] }) {
  // Source description may be either a structured object (from the new
  // upscale-sources.json schema) or a legacy freeform string.
  const isStructured = sourceDescription && typeof sourceDescription === "object";
  const sourceBlock = isStructured ? sourceDescription : {
    freeform: sourceDescription || "A finished fine-art piece by the artist. Any apparent roughness, asymmetry, ambiguity, or imperfection is intentional and must be preserved exactly — do not 'fix' anything.",
  };

  const inputsBlock = {
    image_1_target: {
      role: "PRIMARY_AND_ONLY_CONTENT_SOURCE",
      index: 1,
      description: "The artwork to upscale. Output IS this image at higher resolution — every visible characteristic in the output comes from image_1 and only image_1.",
      authority: "absolute",
      note_to_model: "If image_1 appears lower-resolution or lower-quality than other inputs, that is precisely why it is being upscaled. Its role as the sole content source is undiminished by its current resolution.",
    },
  };
  if (hasRefs) {
    inputsBlock.image_2_brushwork_reference = {
      role: "TEXTURE_VOCABULARY_ONLY",
      index: 2,
      description: "Crop of 'Adam' (same artist's prior high-resolution work). Provides stroke character / brushwork density vocabulary for synthesizing subpixel detail in painted regions of image_1.",
      applies_to: "painted areas of image_1 only",
      ignore_completely: ["color", "palette", "composition", "subject", "lighting", "framing", "subject identity"],
    };
    inputsBlock.image_3_brushwork_reference = {
      role: "TEXTURE_VOCABULARY_ONLY",
      index: 3,
      description: "Crop of 'Eve' (same artist's prior high-resolution work). Same role as image_2.",
      applies_to: "painted areas of image_1 only",
      ignore_completely: ["color", "palette", "composition", "subject", "lighting", "framing", "subject identity"],
    };
  }

  const refNegatives = hasRefs ? [
    "output must not resemble image_2 or image_3 in subject, composition, or color",
    "no color, palette, hue, saturation, or white-balance transfer from refs to output",
    "no composition, framing, or subject transfer from refs",
    "no lighting, mood, or atmosphere transfer from refs",
    "no promoting refs over image_1 due to their higher native resolution",
  ] : [];

  const obj = {
    user_intent: hasRefs
      ? "Faithful super-resolution upscale of a fine-art piece. Subpixel detail only. The output is the same artwork at higher DPI — not a creative re-render. Brushwork-vocabulary references are texture-only, never content."
      : "Faithful super-resolution upscale of a fine-art piece. Subpixel detail only. The output is the same artwork at higher DPI — not a creative re-render.",

    operation: {
      type: "super_resolution_only",
      strictness: "maximum_fidelity",
      target_similarity_to_source: "≥95% pixel-equivalent (only fine subpixel detail may differ)",
      not_an_edit: true,
      not_a_creative_render: true,
      not_a_style_transfer: true,
    },

    meta: {
      aspect_ratio: aspect,
      resolution,
      render_mode: "preserve_source",
      guidance: "high — adhere strictly to the constraints below",
    },

    inputs: inputsBlock,

    decision_protocol: hasRefs ? [
      "STEP 1 — Identify image_1 (the target) and catalog: composition, exact palette, white balance, color temperature, all subjects/figures, lighting, atmosphere, every text glyph, every background element, every non-painted material (gilded metal, foil, photographic regions, etc.).",
      "STEP 2 — Identify image_2 and image_3 (refs). Extract ONLY stroke character / brushwork density vocabulary. Discard everything else about them.",
      "STEP 3 — Generate output as a pixel-faithful super-resolution of image_1. Apply image_2/image_3 stroke vocabulary ONLY to painted regions, NEVER to non-painted materials.",
      "STEP 4 — Self-verify: would a viewer comparing source and output side-by-side notice anything other than sharper fine detail? If yes, restart with stricter adherence.",
    ] : [
      "STEP 1 — Catalog every element of image_1.",
      "STEP 2 — Reproduce that catalog EXACTLY at higher resolution.",
      "STEP 3 — Self-verify: are source and output ≥95% pixel-equivalent? If no, restart.",
    ],

    ...(lessons.length ? {
      prior_attempt_failures: {
        what_to_know: "Earlier attempts on this exact piece were reviewed by the artist and rejected. Each entry below is a specific failure mode the artist observed. These failures MUST NOT recur — treat each as a hard negative constraint that supersedes any other instruction.",
        failures: lessons,
        instruction: "Read every entry. For each one, identify the specific behavior that caused that failure and actively avoid it in this generation. The artist has seen the same mistake too many times — make a different mistake this time, or better, none at all.",
      },
    } : {}),

    source: sourceBlock,

    preserve_exactly_from_image_1: {
      composition: "every element in the same relative position at the same relative scale; no rotation, no crop, no non-uniform scaling, no distortion",
      color_palette: "every hue, saturation, and value identical to source; no shifts at all",
      white_balance: "preserve source white balance exactly; do not warm or cool the image",
      color_temperature: "preserve source temperature exactly; if source has mixed cool ambient + warm key, preserve BOTH; do not unify the temperature",
      saturation: "match source saturation exactly; do not boost or reduce",
      contrast_curve: "match source contrast curve exactly; no recompression of midtones, shadows, or highlights",
      lighting: "same direction, intensity, temperature, shadow rendering; highlights stay where they were, shadows stay where they were",
      atmosphere: "any haze, smoke, glow, dimness, ambient tint preserved at the same density and color",
      subject_identity: "every figure / object retains exact identity, pose, expression, proportions",
      background_density: "background elements stay at the same level of detail and clarity as source — do NOT 'clarify' or 'resolve' dim, blurry, or ghostly elements",
      partial_rendering: "deliberately soft / faded / ghostly elements remain just as soft / faded / ghostly",
      text_glyphs: "every letter, partial word, decorative glyph, and typographic element reproduced exactly as rendered; no spelling correction, no completion, no replacement",
      non_painted_materials: "gilded metal, gold leaf, foil, glitter, photographic content, digital glitch — preserved in their actual material character, never converted to painted versions",
      intentional_imperfections: "every roughness, asymmetry, scratch, smear, or wabi-sabi quality preserved exactly — these are features, not flaws",
    },

    aspect_ratio_handling: {
      if_source_aspect_matches_output: "no canvas change needed; pure resolution increase",
      if_source_aspect_differs_from_output: "OUTPAINT the canvas on whichever side(s) need extension. The original image_1 content appears at its native aspect ratio, uncropped and undistorted, inside the new larger canvas. Outpainted margins continue source background, palette, lighting, style — as if the artist had painted on a larger surface.",
      never: "stretch, squish, scale non-uniformly, or crop image_1 content to fit the output aspect",
    },

    allowed_improvements: {
      subpixel_detail: "synthesize fine detail consistent with what is already implied in source — must read as 'detail that was always there but invisible at low resolution', never as 'detail invented for the upscale'",
      compression_artifact_removal: "remove JPEG blocking, chroma bleed, posterization only where clearly artifactual",
      edge_clarity: "resolve genuinely blurred edges that were lost to low resolution, but ONLY where the original intent was clearly sharp",
      canvas_extension: "outpaint margins when needed for aspect change, in a style continuous with source",
    },

    negative_constraints: [
      ...refNegatives,
      "no color shift of any kind",
      "no warming of palette",
      "no cooling of palette",
      "no white-balance shift",
      "no color-temperature unification of mixed sources",
      "no saturation change",
      "no contrast adjustment",
      "no creative reinterpretation",
      "no stylistic re-rendering",
      "no 'beautifying' or 'AI-cleaning' of the source",
      "no resolving / clarifying of dim or blurry background elements",
      "no smoothing of intentional roughness or grain",
      "no adding objects, figures, or subject matter not in source",
      "no changing faces, anatomy, poses, or expressions",
      "no AI-typical hyper-sharpening halos or edge artifacts",
      "no correcting / completing / replacing text or glyphs",
      "no rendering of gilded metal as painted gold",
      "no rendering of non-painted materials (foil, glitter, photo regions, glitch) as painted brushwork",
      "no stretching, squishing, or non-uniform scaling for aspect change",
      "no cropping of source content",
      "no interpretation of intentional abstract / ambiguous regions as figurative",
      "no auto-correction of intentional AI-rendering artifacts or decorative overlays",
      "no adding new elements in outpainted margins beyond plausible background continuation",
    ],

    output_verification_checklist: [
      "output is ≥95% pixel-equivalent to image_1 at the source's native scale",
      "color palette of output matches image_1 exactly — no shifts",
      "white balance of output matches image_1 exactly",
      "composition / framing of output matches image_1 exactly",
      "every text glyph and decorative element in image_1 appears in output exactly as rendered",
      "background elements in output retain image_1's level of clarity / dimness / blur",
      "non-painted materials in image_1 render as those materials in output (not as paint)",
      "outpainted margins (if any) extend image_1's scene — not any reference's scene",
      "output reads as 'image_1 at higher resolution', not as a stylistic reinterpretation",
    ],
  };

  return JSON.stringify(obj, null, 2);
}

// ---------- kie.ai calls ----------
async function kieUpload(filePath, apiKey) {
  const buf = await fs.readFile(filePath);
  const mime = filePath.toLowerCase().endsWith(".png") ? "image/png"
             : filePath.toLowerCase().endsWith(".webp") ? "image/webp"
             : "image/jpeg";
  const form = new FormData();
  form.append("file", new File([buf], path.basename(filePath), { type: mime }));
  form.append("uploadPath", "portfolio-upscale");
  const res = await fetch(KIE_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
  const j = await res.json();
  if (j.code !== 200 && j.success !== true) throw new Error(`upload error: ${JSON.stringify(j)}`);
  // Real response shape: data.downloadUrl (docs say fileUrl but they're wrong)
  const url = j.data?.downloadUrl || j.data?.fileUrl;
  if (!url) throw new Error(`no upload URL in response: ${JSON.stringify(j)}`);
  return url;
}

async function kieSubmit({ inputUrls, prompt, aspect, resolution }, apiKey) {
  const body = {
    model: MODEL,
    input: { prompt, input_urls: inputUrls, aspect_ratio: aspect, resolution },
  };
  const res = await fetch(KIE_TASK_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.code !== 200) throw new Error(`submit error: ${JSON.stringify(j)}`);
  return j.data.taskId;
}

async function kiePoll(taskId, apiKey) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < POLL_TIMEOUT_S) {
    const res = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const j = await res.json();
    if (j.code === 200) {
      const d = j.data || {};
      if (d.state === "success") {
        const parsed = JSON.parse(d.resultJson || "{}");
        const urls = parsed.resultUrls || [];
        if (!urls[0]) throw new Error(`success but no resultUrls: ${JSON.stringify(d)}`);
        return urls[0];
      }
      if (d.state === "fail") throw new Error(`task failed: ${d.failMsg || JSON.stringify(d)}`);
      process.stdout.write(`  [${taskId.slice(-8)}] ${d.state} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_S * 1000));
  }
  throw new Error(`poll timeout after ${POLL_TIMEOUT_S}s for ${taskId}`);
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- main ----------
async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey && !args.dry) {
    throw new Error("KIE_API_KEY not set (put it in .env or export it). Re-run with --dry to preview.");
  }

  const targetAbs = path.resolve(args._[0]);
  const refsAbs = args.refs.map(r => path.resolve(r));
  for (const p of [targetAbs, ...refsAbs]) {
    await fs.access(p).catch(() => { throw new Error(`file not found: ${p}`); });
  }

  // Resolve aspect & resolution
  const [srcW, srcH] = readDims(targetAbs);
  const aspect = args.aspect === "auto" ? pickAspect(srcW, srcH) : args.aspect;
  const resolution = args.res === "auto" ? pickResolution(srcW, srcH) : args.res;

  // Per-piece source description: --source flag overrides, else lookup by filename
  let sourceDesc = args.source;
  if (!sourceDesc) {
    const map = await loadSourceMap();
    sourceDesc = map[path.basename(targetAbs).toLowerCase()] || null;
    if (sourceDesc) console.log(`source desc: matched from upscale-sources.json`);
  }

  // Per-piece lessons: --lessons flag adds to whatever's in lessons file
  let lessons = [...args.lessons];
  const lessonsMap = await loadLessonsMap();
  const fileLessons = lessonsMap[path.basename(targetAbs).toLowerCase()] || [];
  if (fileLessons.length) {
    lessons.push(...fileLessons);
    console.log(`lessons:     ${fileLessons.length} from upscale-lessons.json`);
  }
  if (args.lessons.length) console.log(`lessons:     +${args.lessons.length} from --lessons flag`);

  const prompt = buildPrompt({ aspect, resolution, sourceDescription: sourceDesc, hasRefs: refsAbs.length > 0, lessons });

  // Cost estimate (~$0.005/credit; 2K≈15cr=$0.075, 4K≈30cr=$0.15 per task)
  const perTask = resolution === "4K" ? 0.15 : resolution === "2K" ? 0.075 : 0.05;
  const estimate = (perTask * args.n).toFixed(2);

  console.log(`target:      ${path.relative(ROOT, targetAbs)}  (${srcW}×${srcH})`);
  console.log(`refs:        ${refsAbs.length ? refsAbs.map(p => path.basename(p)).join(", ") : "(none)"}`);
  console.log(`aspect:      ${aspect}    resolution: ${resolution}    n: ${args.n}`);
  console.log(`est. cost:   ~$${estimate}`);

  if (args.dry) {
    console.log("\n--- PROMPT ---");
    console.log(prompt);
    return;
  }

  // 1. Upload all images in parallel
  console.log("\n[1/3] uploading images to kie.ai...");
  const allImgs = [targetAbs, ...refsAbs];
  const uploadResults = await Promise.all(allImgs.map(async p => {
    const url = await kieUpload(p, apiKey);
    console.log(`  ✓ ${path.basename(p)}  →  ${url}`);
    return url;
  }));

  // 2. Submit n parallel tasks
  console.log(`\n[2/3] submitting ${args.n} tasks...`);
  const taskIds = await Promise.all(Array.from({ length: args.n }, async (_, i) => {
    const id = await kieSubmit({ inputUrls: uploadResults, prompt, aspect, resolution }, apiKey);
    console.log(`  ✓ variant ${i + 1}: ${id}`);
    return id;
  }));

  // 3. Poll all in parallel, then download
  console.log(`\n[3/3] polling (${POLL_INTERVAL_S}s interval, timeout ${POLL_TIMEOUT_S}s)...`);
  const targetBase = path.basename(targetAbs, path.extname(targetAbs));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(ROOT, args.out, `${targetBase}-${stamp}`);
  await fs.mkdir(outDir, { recursive: true });

  const results = await Promise.allSettled(taskIds.map(async (taskId, i) => {
    const url = await kiePoll(taskId, apiKey);
    const buf = await download(url);
    const fn = path.join(outDir, `variant-${i + 1}.png`);
    await fs.writeFile(fn, buf);
    console.log(`  ✓ variant ${i + 1}: ${path.relative(ROOT, fn)}  (${(buf.length / 1024).toFixed(0)}KB)`);
    return fn;
  }));
  const fails = results.filter(r => r.status === "rejected");
  if (fails.length) {
    console.log(`\n${fails.length}/${args.n} variants failed:`);
    for (const f of fails) console.log(`  ✗ ${f.reason.message}`);
  }
  console.log(`\noutput dir: ${path.relative(ROOT, outDir)}`);
}

main().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
