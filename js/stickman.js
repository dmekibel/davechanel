// Stickman — a drawn stick figure that comes alive and treats the live Win98
// desktop as a platforming world (Animator-vs-Animation × Wreck-It-Ralph).
// V1: a controllable, procedurally-animated figure with gravity + jumping that
// lands on the REAL taskbar, desktop icons and window titlebars.
//
// Controls: ← → (or A/D) move · ↑ / W / Space jump · Esc puts it away.
// The whole thing lives on a pointer-events:none overlay so it never blocks the
// desktop underneath. Coordinates are body-internal px (the desktop is scaled
// with CSS `zoom`, so on-screen rects convert to our space by /currentZoom()).

import { currentZoom } from "./scale.js?v=188";

let active = null; // single instance — the desktop icon toggles it

export function openStickman() {
  if (active) { active.destroy(); active = null; return; }
  active = createStickman();
}
export function isStickmanActive() { return !!active; }
export function dismissStickman() { if (active) { active.destroy(); active = null; } }
// the Paint ritual hands the just-drawn figure to the engine mid-leap:
// spawn at world (x, y) with an exit impulse, already alive
export function spawnStickmanAt(opts) {
  if (active) { active.destroy(); active = null; }
  active = createStickman(opts || {});
}

// ---- figure geometry (SVG-local units; the viewBox is rendered 1:1) ----
const VB = 50, VBH = 66;              // svg box
const HIPX = 25, HIPY = 37;           // pelvis
const TORSO = 16, HEADR = 5.5;
const THIGH = 12, SHIN = 13;
const UARM = 9, FARM = 9;
const FOOTY = HIPY + THIGH + SHIN;    // ≈ 62, where straight legs reach
const NECK_TO_FOOT = FOOTY;           // svg-y of the feet (for positioning)

// ---- tuning (px per 60fps frame) ----
const GRAV = 0.82, JUMP = 13.6, RUN = 4.6, WALK = 2.6;
const ACCEL = 0.7, FRICTION = 0.62, AIR_ACCEL = 0.4;

const D2R = Math.PI / 180;
// a limb endpoint: angle 0 = straight DOWN, +angle swings toward +x
const pt = (x, y, deg, len) => [x + len * Math.sin(deg * D2R), y + len * Math.cos(deg * D2R)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function createStickman(opts = {}) {
  const z0 = currentZoom() || 1;
  const W = window.innerWidth / z0, H = window.innerHeight / z0;

  // overlay layer — on top of everything, but click-through
  const layer = document.createElement("div");
  layer.className = "stickman-layer";

  // the figure: a single SVG of strokes we re-point every frame
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${VB} ${VBH}`);
  svg.setAttribute("width", VB); svg.setAttribute("height", VBH);
  svg.classList.add("stickman");
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "stickman-body");
  svg.appendChild(g);

  const mkLine = () => { const l = document.createElementNS(NS, "line"); l.setAttribute("class", "sm-seg"); g.appendChild(l); return l; };
  const seg = { torso: mkLine(), thighL: mkLine(), shinL: mkLine(), thighR: mkLine(), shinR: mkLine(), uarmL: mkLine(), farmL: mkLine(), uarmR: mkLine(), farmR: mkLine() };
  const head = document.createElementNS(NS, "circle");
  head.setAttribute("class", "sm-seg sm-head"); head.setAttribute("r", HEADR);
  g.appendChild(head);
  layer.appendChild(svg);

  // hint toast — re-used as the tiny narrator through the escape arc
  const hint = document.createElement("div");
  hint.className = "stickman-hint";
  layer.appendChild(hint);
  document.body.appendChild(layer);
  let hintTimer = null;
  function say(html, ms = 4200) {
    hint.innerHTML = html;
    hint.classList.remove("fade");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add("fade"), ms);
  }
  say("<b>It's alive.</b> ← → move · Space jump · Esc to put away");

  // ---- state ----
  const ritual = opts.x != null; // born from the Paint ritual: leap out alive, no pause
  // Level 1 — the canvas. While confined, the page IS the world: its edges are
  // the floor/walls/ceiling. The figure earns its freedom by cracking a wall.
  const confine = opts.confine || null; // { rect(), onCrack(side, wy), onBreak(side) }
  let stage = confine ? "canvas" : "free";
  const wallHits = { left: 0, right: 0 };
  const broken = { left: false, right: false };
  let hitCooldown = 0;
  const S = {
    x: ritual ? clamp(opts.x, 6, W - 6) : W / 2,
    y: ritual ? opts.y : H * 0.34,   // feet position; default spawn drops in from mid-air
    vx: ritual ? (opts.vx || 0) : 0,
    vy: ritual ? (opts.vy || 0) : 0,
    facing: (opts.vx || 1) >= 0 ? 1 : -1,
    grounded: false, coyote: 0, jumpBuf: 0,
    phase: 0, mode: ritual ? "fall" : "spawn", t: 0,
  };
  if (ritual) svg.classList.add("alive");
  if (confine) setTimeout(() => { if (stage === "canvas") say("<b>It wants OUT.</b> Slam into a wall — jump against it!"); }, 6000);

  const setLine = (l, a, b) => { l.setAttribute("x1", a[0]); l.setAttribute("y1", a[1]); l.setAttribute("x2", b[0]); l.setAttribute("y2", b[1]); };

  // build a pose from a set of joint angles (degrees) and write it to the SVG
  function drawPose(P) {
    const neck = pt(HIPX, HIPY, 180 + P.lean, TORSO);           // torso goes UP from the hip
    setLine(seg.torso, [HIPX, HIPY], neck);
    const hc = pt(neck[0], neck[1], 180 + P.lean + P.head, HEADR + 1.5);
    head.setAttribute("cx", hc[0]); head.setAttribute("cy", hc[1]);
    // legs from the hip
    const kL = pt(HIPX, HIPY, P.thighL, THIGH), fL = pt(kL[0], kL[1], P.shinL, SHIN);
    const kR = pt(HIPX, HIPY, P.thighR, THIGH), fR = pt(kR[0], kR[1], P.shinR, SHIN);
    setLine(seg.thighL, [HIPX, HIPY], kL); setLine(seg.shinL, kL, fL);
    setLine(seg.thighR, [HIPX, HIPY], kR); setLine(seg.shinR, kR, fR);
    // arms from the shoulders (≈ neck)
    const eL = pt(neck[0], neck[1], P.uarmL, UARM), hL = pt(eL[0], eL[1], P.farmL, FARM);
    const eR = pt(neck[0], neck[1], P.uarmR, UARM), hR = pt(eR[0], eR[1], P.farmR, FARM);
    setLine(seg.uarmL, neck, eL); setLine(seg.farmL, eL, hL);
    setLine(seg.uarmR, neck, eR); setLine(seg.farmR, eR, hR);
    // lowest foot → how far the feet sit below the hip, so we can plant them on the ground
    S.footOffset = Math.max(fL[1], fR[1]) - 0; // svg-y of the lowest foot
    return Math.max(fL[1], fR[1]);
  }

  // poses per state ------------------------------------------------------
  function poseIdle(t) {
    const b = Math.sin(t * 0.05) * 1.4;            // gentle breathing
    return { lean: b * 0.4, head: -b * 0.3,
      thighL: 5, shinL: 4, thighR: -5, shinR: -4,
      uarmL: 16 + b, farmL: 22 + b, uarmR: -16 - b, farmR: -22 - b };
  }
  function poseWalkRun(phase, run) {
    const A = run ? 34 : 22, K = run ? 40 : 26, arm = run ? 30 : 18;
    const sL = Math.sin(phase), sR = Math.sin(phase + Math.PI);
    const thighL = A * sL, thighR = A * sR;
    // knee bends as the leg travels back / lifts (only on the back-swing)
    const bendL = K * clamp(Math.sin(phase + 2.2), 0, 1);
    const bendR = K * clamp(Math.sin(phase + Math.PI + 2.2), 0, 1);
    return { lean: run ? 10 : 5, head: run ? -6 : -3,
      thighL, shinL: thighL - bendL, thighR, shinR: thighR - bendR,
      uarmL: -arm * sL * 0.9 + 6, farmL: -arm * sL * 0.9 - 14,
      uarmR: -arm * sR * 0.9 - 6, farmR: -arm * sR * 0.9 + 14 };
  }
  function poseJump() {
    return { lean: 6, head: -4,
      thighL: 26, shinL: -8, thighR: 18, shinR: -22,
      uarmL: 150, farmL: 168, uarmR: -150, farmR: -168 };  // arms up
  }
  function poseFall() {
    return { lean: -4, head: 6,
      thighL: 12, shinL: 20, thighR: -12, shinR: -2,
      uarmL: 120, farmL: 110, uarmR: -120, farmR: -110 };  // arms out
  }

  // ---- platforms (recomputed each frame from the live DOM) ----
  function platforms() {
    const z = currentZoom() || 1;
    const out = [];
    const add = (el, full) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 2) return;
      out.push({ l: r.left / z, r: r.right / z, top: r.top / z });
      void full;
    };
    const tb = document.getElementById("taskbar");
    if (tb) { const r = tb.getBoundingClientRect(); out.push({ l: 0, r: W, top: r.top / z, ground: true }); }
    document.querySelectorAll("#desktop-icons .desktop-icon").forEach((el) => add(el));
    document.querySelectorAll(".window:not(.minimized) .window-titlebar").forEach((el) => add(el));
    // a hard floor at the very bottom in case the taskbar is missing
    out.push({ l: 0, r: W, top: H - 1, ground: true });
    return out;
  }

  // ---- input ----
  const keys = { left: false, right: false };
  function onKey(e, down) {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return; // let people type
    const k = e.key.toLowerCase();
    if (k === "escape") { if (down) destroy(); return; }
    let m = null;
    if (k === "arrowleft" || k === "a") m = "left";
    else if (k === "arrowright" || k === "d") m = "right";
    else if (k === "arrowup" || k === "w" || k === " " || k === "spacebar") m = "jump";
    if (!m) return;
    e.preventDefault();
    if (m === "jump") { if (down) S.jumpBuf = 8; }
    else keys[m] = down;
  }
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  // ---- main loop ----
  let raf = null, last = 0, born = 0;
  function frame(ts) {
    if (!born) born = ts;
    const dt = clamp((ts - (last || ts)) / 16.67, 0.5, 2.5); // normalize to 60fps, cap spikes
    last = ts;
    S.t += dt;
    const age = ts - born;

    // a brief "drawn to life" beat before control kicks in
    if (S.mode === "spawn") {
      drawPose(poseIdle(S.t));
      place();
      if (age > 650) { S.mode = "fall"; svg.classList.add("alive"); }
      raf = requestAnimationFrame(frame); return;
    }

    // ---- horizontal ----
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const top = S.grounded ? RUN : RUN;          // (air speed cap = run)
    const acc = (S.grounded ? ACCEL : AIR_ACCEL) * dt;
    if (dir !== 0) { S.vx += dir * acc; S.facing = dir; }
    else if (S.grounded) S.vx *= Math.pow(FRICTION, dt);
    S.vx = clamp(S.vx, -top, top);

    // ---- vertical ----
    S.vy += GRAV * dt;
    if (S.jumpBuf > 0) S.jumpBuf -= dt;
    if (S.jumpBuf > 0 && (S.grounded || S.coyote > 0)) { S.vy = -JUMP; S.grounded = false; S.coyote = 0; S.jumpBuf = 0; }
    if (S.coyote > 0) S.coyote -= dt;

    const prevY = S.y;
    let nx = clamp(S.x + S.vx * dt, 6, W - 6);
    let ny = S.y + S.vy * dt;

    if (stage === "canvas") {
      // ---- Level 1: the canvas box IS the world. Crack a wall to get out. ----
      const rb = confine.rect();
      if (!rb) { stage = "free"; } // the page is gone — it's already out
      else {
        if (hitCooldown > 0) hitCooldown -= dt;
        const BODY = 54; // head clearance above the feet
        if (ny >= rb.b - 1) { ny = rb.b - 1; S.vy = 0; S.grounded = true; S.coyote = 6; }
        else if (S.grounded && ny < rb.b - 3) S.grounded = false;
        if (ny - BODY < rb.t && S.vy < 0) { ny = rb.t + BODY; S.vy = 0; }
        // side walls — SLAM them (airborne, or running hard) to crack them
        const slam = (side) => {
          if (broken[side] || hitCooldown > 0) return;
          if (S.grounded && Math.abs(S.vx) < 2.2) return; // a lazy lean doesn't count
          hitCooldown = 18;
          wallHits[side] += 1;
          if (confine.onCrack) confine.onCrack(side, ny - 30, wallHits[side]);
          if (wallHits[side] === 1) say("<b>CRACK.</b> Again — break it open!");
          if (wallHits[side] >= 3) {
            broken[side] = true;
            if (confine.onBreak) confine.onBreak(side, ny - 30);
            say("<b>IT'S OPEN!</b> Through the hole — go!");
          }
        };
        if (nx <= rb.l + 8 && !broken.left)  { slam("left");  nx = rb.l + 8;  S.vx = Math.max(0, S.vx * -0.3); }
        if (nx >= rb.r - 8 && !broken.right) { slam("right"); nx = rb.r - 8;  S.vx = Math.min(0, S.vx * -0.3); }
        // out through a broken wall → the desktop world takes over
        if (nx < rb.l - 12 || nx > rb.r + 12) {
          stage = "free";
          S.grounded = false;
          say("<b>It escaped!</b> The desktop is yours · Esc puts it away", 6500);
        }
      }
    } else {
      // ---- one-way platform collision (land on tops while falling) ----
      const plats = platforms();
      let landed = false, bestTop = Infinity;
      if (S.vy >= 0) {
        for (const p of plats) {
          if (nx < p.l - 2 || nx > p.r + 2) continue;
          if (prevY <= p.top + 1 && ny >= p.top && p.top < bestTop) { bestTop = p.top; landed = true; }
        }
      }
      if (landed) { ny = bestTop; S.vy = 0; S.grounded = true; S.coyote = 6; }
      else {
        // still grounded? only if a platform is right under the feet (else walk off the edge)
        let support = false;
        for (const p of plats) { if (nx >= p.l - 2 && nx <= p.r + 2 && Math.abs(ny - p.top) < 2.5) { support = true; ny = p.top; break; } }
        if (S.grounded && !support) { S.grounded = false; S.coyote = 6; }
      }
    }

    S.x = nx; S.y = ny;

    // ---- pick the animation + advance the walk cycle ----
    let P;
    if (!S.grounded) P = S.vy < 0 ? poseJump() : poseFall();
    else if (Math.abs(S.vx) > 0.4) { const run = Math.abs(S.vx) > WALK + 0.5; S.phase += (Math.abs(S.vx) / (run ? 2.0 : 1.7)) * 0.18 * dt; P = poseWalkRun(S.phase, run); }
    else P = poseIdle(S.t);
    drawPose(P);
    place();
    void prevY;
    raf = requestAnimationFrame(frame);
  }

  // position the SVG so the figure's feet sit at world (S.x, S.y)
  function place() {
    const tx = S.x - HIPX, ty = S.y - NECK_TO_FOOT;
    svg.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${S.facing})`;
  }

  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    layer.remove();
    active = null;
  }

  return { destroy };
}
