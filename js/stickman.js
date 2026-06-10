// Stickman — a drawn stick figure that comes alive and treats the live Win98
// desktop as a platforming world (Animator-vs-Animation × Wreck-It-Ralph).
// V1: a controllable, procedurally-animated figure with gravity + jumping that
// lands on the REAL taskbar, desktop icons and window titlebars.
//
// Controls: ← → (or A/D) move · ↑ / W / Space jump · Esc puts it away.
// The whole thing lives on a pointer-events:none overlay so it never blocks the
// desktop underneath. Coordinates are body-internal px (the desktop is scaled
// with CSS `zoom`, so on-screen rects convert to our space by /currentZoom()).

import { currentZoom } from "./scale.js?v=196";

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
const GRAV = 0.82, JUMP = 13.6, WALK = 2.6;
const BASE = 3.2, SPRINT = 5.8, CRAWL = 1.35; // jog / shift-sprint / crawl speed caps
const ACCEL = 0.7, FRICTION = 0.62, AIR_ACCEL = 0.4;
const WALLJUMP_VX = 5.6, WALLJUMP_VY = 12.8, WALL_SLIDE_VY = 2.0;

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

  // THE PLAYER IS THE DRAWING: when the ritual hands us the cut-out bitmap, the
  // exact pixels the player drew become the character (squash & stretch carries
  // the life). The procedural SVG skeleton remains as the no-drawing fallback.
  const spriteMode = !!(opts.sprite && opts.sprite.url);
  let FW = VB, FH = NECK_TO_FOOT; // the figure's physical width/height (feet at bottom-center)
  let svg = null, seg = null, head = null, img = null;
  if (spriteMode) {
    // SIZE THE DRAWING TO FIT THE GAME: a big doodle is scaled DOWN so it can
    // actually move and jump — capped to ~11% of the screen, ~42% of the canvas
    // it's born in, and a sane width (wide scribbles shrink too). Normal-sized
    // drawings are kept as drawn; tiny ones are nudged up to a playable floor.
    const vH = window.innerHeight / z0, vW = window.innerWidth / z0;
    let maxH = Math.min(74, vH * 0.11);
    const rb = opts.confine && opts.confine.rect && opts.confine.rect();
    if (rb) maxH = Math.min(maxH, (rb.b - rb.t) * 0.42);
    const maxW = Math.min(vW * 0.18, maxH * 2.6);
    let sf = Math.min(1, maxH / opts.sprite.h, maxW / opts.sprite.w); // only ever scale DOWN big ones
    if (opts.sprite.h * sf < 28) sf = Math.min(28 / opts.sprite.h, maxH / opts.sprite.h, maxW / opts.sprite.w); // floor tiny doodles
    FW = Math.max(12, opts.sprite.w * sf);
    FH = Math.max(20, opts.sprite.h * sf);
    if (sf < 0.8) setTimeout(() => say("<b>Sized to fit.</b> Big drawing — shrunk so it can roam!", 3400), 1500);
    img = document.createElement("img");
    img.src = opts.sprite.url;
    img.className = "stickman stickman-sprite";
    img.style.width = FW + "px";
    img.style.height = FH + "px";
    layer.appendChild(img);
  } else {
    // the figure: a single SVG of strokes we re-point every frame
    const NS = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VB} ${VBH}`);
    svg.setAttribute("width", VB); svg.setAttribute("height", VBH);
    svg.classList.add("stickman");
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "stickman-body");
    svg.appendChild(g);
    const mkLine = () => { const l = document.createElementNS(NS, "line"); l.setAttribute("class", "sm-seg"); g.appendChild(l); return l; };
    seg = { torso: mkLine(), thighL: mkLine(), shinL: mkLine(), thighR: mkLine(), shinR: mkLine(), uarmL: mkLine(), farmL: mkLine(), uarmR: mkLine(), farmR: mkLine() };
    head = document.createElementNS(NS, "circle");
    head.setAttribute("class", "sm-seg sm-head"); head.setAttribute("r", HEADR);
    g.appendChild(head);
    layer.appendChild(svg);
  }

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
  const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  say(isTouch
    ? "<b>It's alive.</b> Pads: ▲ jump (twice = double) · ▼ slide · 👊 attack"
    : "<b>It's alive.</b> ← → move · Shift run · ↓ slide · Space jump · X attack · Esc away");

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
    airJumps: 1, landTimer: 0, spinTimer: 0, // double jump + landing squash + air-flip
    walled: 0,        // -1 = wall on the left, +1 = wall on the right (cling/wall-jump)
    sliding: false,   // knee slide (momentum, low friction)
    dirHold: 0,       // frames a direction has been held — mobile auto-sprint
    attackTimer: 0, attackCd: 0, // strike animation + cooldown
    phase: 0, mode: ritual ? "fall" : "spawn", t: 0,
  };
  if (ritual) (img || svg).classList.add("alive");
  if (confine) setTimeout(() => { if (stage === "canvas") say("<b>It wants OUT.</b> Hit the wall (X / 👊) or slam into it!"); }, 6000);
  // windows that already exist never "open onto" the figure — only NEW ones do
  const knownWins = new WeakSet();
  document.querySelectorAll(".window").forEach((w) => knownWins.add(w));

  // escape the canvas → the live desktop is the world now
  function goFree() {
    if (stage === "free") return;
    stage = "free"; S.grounded = false;
    if (confine && confine.onEscape) confine.onEscape(); // un-maximize Paint if needed
    say("<b>It escaped!</b> The desktop is yours · Esc puts it away", 6500);
  }
  // one shared crack path for body-slams AND attacks: 3 hits on a wall break it
  function crackWall(side, wy) {
    if (!confine || broken[side] || hitCooldown > 0) return false;
    hitCooldown = 18;
    wallHits[side] += 1;
    if (confine.onCrack) confine.onCrack(side, wy, wallHits[side]);
    if (wallHits[side] === 1) say("<b>CRACK.</b> Again — break it open!");
    if (wallHits[side] >= 3) {
      broken[side] = true;
      if (confine.onBreak) confine.onBreak(side, wy);
      say("<b>IT'S OPEN!</b> Through the hole — go!");
    }
    return true;
  }

  // ---- ATTACK: a quick strike in the facing direction. In the canvas it cracks
  // the wall (the deliberate way out); on the desktop it knocks icons sliding
  // and rattles windows. X / F, or the 👊 pad on touch.
  function impactFlash(wx, wy) {
    const f = document.createElement("div");
    f.className = "sm-impact";
    f.style.left = wx + "px"; f.style.top = wy + "px";
    layer.appendChild(f);
    setTimeout(() => f.remove(), 240);
  }
  function doAttack() {
    if (S.attackCd > 0 || S.mode === "spawn") return;
    S.attackCd = 22; S.attackTimer = 12; S.sliding = false;
    const z = currentZoom() || 1;
    const reach = 30;
    const hx = S.x + S.facing * (FW / 2 + reach * 0.7); // strike centre
    const hy = S.y - FH * 0.55;
    if (stage === "canvas") {
      const rb = confine.rect();
      if (rb) {
        if (S.facing < 0 && S.x - FW / 2 - reach <= rb.l + 8 && crackWall("left", S.y - FH * 0.5)) impactFlash(rb.l + 8, hy);
        else if (S.facing > 0 && S.x + FW / 2 + reach >= rb.r - 8 && crackWall("right", S.y - FH * 0.5)) impactFlash(rb.r - 8, hy);
      }
      return;
    }
    // free desktop: knock icons, rattle windows
    let hitSomething = false;
    const x0 = Math.min(S.x + S.facing * (FW / 2), S.x + S.facing * (FW / 2 + reach));
    const x1 = Math.max(S.x + S.facing * (FW / 2), S.x + S.facing * (FW / 2 + reach));
    const yTop = S.y - FH * 0.9, yBot = S.y + 4;
    document.querySelectorAll("#desktop-icons .desktop-icon").forEach((el) => {
      const r = el.getBoundingClientRect();
      const l = r.left / z, rr = r.right / z, tt = r.top / z, bb = r.bottom / z;
      if (rr < x0 || l > x1 || bb < yTop || tt > yBot) return;
      hitSomething = true;
      // knocked: slide away with a wobble (not persisted — refresh resets the mess)
      const desk = el.parentElement;
      const maxX = (desk ? desk.clientWidth : W) - el.offsetWidth;
      el.style.transition = "left .28s cubic-bezier(.2,.7,.3,1.3)";
      el.style.left = clamp(el.offsetLeft + S.facing * 46, 0, Math.max(0, maxX)) + "px";
      el.classList.remove("sm-icon-hit"); void el.offsetWidth; el.classList.add("sm-icon-hit");
      setTimeout(() => { el.style.transition = ""; }, 320);
    });
    document.querySelectorAll(".window:not(.minimized)").forEach((el) => {
      const r = el.getBoundingClientRect();
      const l = r.left / z, rr = r.right / z, tt = r.top / z, bb = r.bottom / z;
      if (rr < x0 || l > x1 || bb < yTop || tt > yBot) return;
      hitSomething = true;
      el.classList.remove("sm-win-shake"); void el.offsetWidth; el.classList.add("sm-win-shake");
      setTimeout(() => el.classList.remove("sm-win-shake"), 340);
    });
    if (hitSomething) impactFlash(hx, hy);
  }

  const setLine = (l, a, b) => { l.setAttribute("x1", a[0]); l.setAttribute("y1", a[1]); l.setAttribute("x2", b[0]); l.setAttribute("y2", b[1]); };

  // build a pose from a set of joint angles (degrees) and write it to the SVG
  function drawPose(P) {
    if (!seg) return; // sprite mode: the bitmap animates via applySpriteVisual instead
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
  function poseSlide() { // knee slide: leaning way back, legs thrown forward
    return { lean: -34, head: 14,
      thighL: 72, shinL: 64, thighR: 58, shinR: 84,
      uarmL: -130, farmL: -120, uarmR: 40, farmR: 70 };
  }
  function poseCrawl(phase) { // hands-and-knees scuttle
    const s = Math.sin(phase) * 14;
    return { lean: 62, head: -34,
      thighL: 38 + s, shinL: -30 + s, thighR: 38 - s, shinR: -30 - s,
      uarmL: 150 - s, farmL: 165, uarmR: 150 + s, farmR: 165 };
  }
  function poseWallCling() { // hugging the wall, sliding
    return { lean: 8, head: -4,
      thighL: 34, shinL: -26, thighR: 10, shinR: -8,
      uarmL: 165, farmL: 175, uarmR: 30, farmR: 50 };
  }
  function poseAttack(k) { // a punch: arm rams out front, body behind it
    return { lean: 14 * k, head: -8 * k,
      thighL: 18, shinL: 4, thighR: -14, shinR: -22,
      uarmL: 96 + 14 * k, farmL: 92, uarmR: -20, farmR: -36 };
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
    // window bottom edges are sills — hop floor → sill → titlebar to scale a window
    document.querySelectorAll(".window:not(.minimized)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4) return;
      out.push({ l: r.left / z, r: r.right / z, top: r.bottom / z });
    });
    // a hard floor at the very bottom in case the taskbar is missing
    out.push({ l: 0, r: W, top: H - 1, ground: true });
    return out;
  }

  // ---- input ----
  const keys = { left: false, right: false, down: false, shift: false };
  // pressing Down at speed kicks off a knee slide; held while slow = crawl
  function tryStartSlide() {
    if (S.grounded && Math.abs(S.vx) > 3.0 && !S.sliding) { S.sliding = true; S.vx *= 1.12; }
  }
  function onKey(e, down) {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return; // let people type
    const k = e.key.toLowerCase();
    if (k === "escape") { if (down) destroy(); return; }
    if (k === "shift") { keys.shift = down; return; }
    if (k === "x" || k === "f") { if (down && !e.repeat) { e.preventDefault(); doAttack(); } return; }
    let m = null;
    if (k === "arrowleft" || k === "a") m = "left";
    else if (k === "arrowright" || k === "d") m = "right";
    else if (k === "arrowdown" || k === "s") m = "down";
    else if (k === "arrowup" || k === "w" || k === " " || k === "spacebar") m = "jump";
    if (!m) return;
    e.preventDefault();
    if (m === "jump") { if (down) S.jumpBuf = 8; }
    else {
      if (m === "down" && down && !keys.down) tryStartSlide();
      keys[m] = down;
    }
  }
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  // ---- touch pads (coarse pointers): ◀ ▶ on the left, ▼ ▲ on the right, ✕ away ----
  if (isTouch) {
    layer.classList.add("sm-has-pads"); // lifts the hint toast clear of the pad band
    const pads = document.createElement("div");
    pads.className = "stickman-pads";
    pads.innerHTML = `
      <div class="sm-pads-group">
        <button class="sm-pad" data-pad="left" aria-label="Left">◀</button>
        <button class="sm-pad" data-pad="right" aria-label="Right">▶</button>
      </div>
      <div class="sm-pads-group">
        <button class="sm-pad" data-pad="down" aria-label="Slide">▼</button>
        <button class="sm-pad" data-pad="hit" aria-label="Attack">👊</button>
        <button class="sm-pad sm-pad-jump" data-pad="jump" aria-label="Jump">▲</button>
      </div>`;
    layer.appendChild(pads);
    const bye = document.createElement("button");
    bye.className = "sm-pad sm-pad-bye";
    bye.dataset.pad = "bye";
    bye.setAttribute("aria-label", "Put away");
    bye.textContent = "✕";
    layer.appendChild(bye); // anchored to the layer's top-right, not the pad row
    layer.querySelectorAll(".sm-pad").forEach((b) => {
      const code = b.dataset.pad;
      const press = (on) => (e) => {
        e.preventDefault();
        b.classList.toggle("on", on);
        if (code === "bye") { if (on) destroy(); return; }
        if (code === "jump") { if (on) S.jumpBuf = 8; return; }
        if (code === "hit") { if (on) doAttack(); return; }
        if (code === "down" && on && !keys.down) tryStartSlide();
        keys[code] = on;
      };
      b.addEventListener("pointerdown", press(true));
      b.addEventListener("pointerup", press(false));
      b.addEventListener("pointercancel", press(false));
      b.addEventListener("pointerleave", press(false));
    });
  }

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
      if (age > 650) { S.mode = "fall"; (img || svg).classList.add("alive"); }
      raf = requestAnimationFrame(frame); return;
    }

    // ---- horizontal ----
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    S.dirHold = dir !== 0 ? S.dirHold + dt : 0;
    const sprinting = keys.shift || S.dirHold > 32; // Shift, or just keep holding (mobile auto-sprint)
    const crouching = keys.down && S.grounded && !S.sliding;
    if (S.sliding && (!keys.down || !S.grounded || Math.abs(S.vx) < 1.5)) S.sliding = false;
    if (S.sliding) {
      S.vx *= Math.pow(0.985, dt); // a knee slide rides its momentum
    } else {
      const top = crouching ? CRAWL : sprinting ? SPRINT : BASE;
      const acc = (S.grounded ? ACCEL : AIR_ACCEL) * dt;
      if (dir !== 0) { S.vx += dir * acc; S.facing = dir; }
      else if (S.grounded) S.vx *= Math.pow(FRICTION, dt);
      S.vx = clamp(S.vx, -top, top);
    }

    // ---- vertical ----
    S.vy += GRAV * dt;
    if (keys.down && !S.grounded) S.vy += 0.5 * dt; // fast-fall
    if (S.jumpBuf > 0) S.jumpBuf -= dt;
    if (S.jumpBuf > 0) {
      if (S.grounded || S.coyote > 0) { S.vy = -JUMP; S.grounded = false; S.coyote = 0; S.jumpBuf = 0; S.sliding = false; }
      else if (S.walled !== 0) {
        // wall jump (Fancy Pants style): kick away from the wall, reset the air jump
        S.vy = -WALLJUMP_VY; S.vx = -S.walled * WALLJUMP_VX; S.facing = -S.walled;
        S.airJumps = 1; S.jumpBuf = 0; S.walled = 0;
      }
      else if (S.airJumps > 0) {
        // double jump — a mid-air flip that makes windows scalable
        S.vy = -JUMP * 0.92; S.airJumps -= 1; S.jumpBuf = 0; S.spinTimer = 16;
      }
    }
    if (S.coyote > 0) S.coyote -= dt;
    if (S.landTimer > 0) S.landTimer -= dt;
    if (S.spinTimer > 0) S.spinTimer -= dt;
    if (S.attackTimer > 0) S.attackTimer -= dt;
    if (S.attackCd > 0) S.attackCd -= dt;

    const prevY = S.y;
    let nx = clamp(S.x + S.vx * dt, 6, W - 6);
    let ny = S.y + S.vy * dt;

    if (stage === "canvas") {
      // ---- Level 1: the canvas box IS the world. Crack a wall to get out. ----
      const rb = confine.rect();
      if (!rb) { goFree(); } // the page is gone — it's already out
      else {
        if (hitCooldown > 0) hitCooldown -= dt;
        const BODY = FH - 6; // head clearance above the feet
        if (ny >= rb.b - 1) { if (!S.grounded) S.landTimer = 8; ny = rb.b - 1; S.vy = 0; S.grounded = true; S.coyote = 6; S.airJumps = 1; }
        else if (S.grounded && ny < rb.b - 3) S.grounded = false;
        if (ny - BODY < rb.t && S.vy < 0) { ny = rb.t + BODY; S.vy = 0; }
        // side walls — SLAM them (airborne, or running hard) to crack them;
        // a deliberate ATTACK (X / 👊) cracks them too, via the same crackWall.
        // The crack is drawn at the figure's CONTACT height (its mid-body).
        const slam = (side) => {
          if (S.grounded && Math.abs(S.vx) < 2.2) return; // a lazy lean doesn't count
          crackWall(side, ny - FH * 0.5);
        };
        S.walled = 0;
        if (nx <= rb.l + 8 && !broken.left)  { slam("left");  nx = rb.l + 8;  S.vx = Math.max(0, S.vx * -0.3); if (!S.grounded && dir < 0) { S.walled = -1; S.vy = Math.min(S.vy, WALL_SLIDE_VY); } }
        if (nx >= rb.r - 8 && !broken.right) { slam("right"); nx = rb.r - 8;  S.vx = Math.min(0, S.vx * -0.3); if (!S.grounded && dir > 0) { S.walled = 1;  S.vy = Math.min(S.vy, WALL_SLIDE_VY); } }
        // out through a broken wall → the desktop world takes over
        if (nx < rb.l - 12 || nx > rb.r + 12) goFree();
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
      if (landed) { if (!S.grounded) S.landTimer = 8; ny = bestTop; S.vy = 0; S.grounded = true; S.coyote = 6; S.airJumps = 1; }
      else {
        // still grounded? only if a platform is right under the feet (else walk off the edge)
        let support = false;
        for (const p of plats) { if (nx >= p.l - 2 && nx <= p.r + 2 && Math.abs(ny - p.top) < 2.5) { support = true; ny = p.top; break; } }
        if (S.grounded && !support) { S.grounded = false; S.coyote = 6; }
      }
      // ---- walls (Fancy Pants): airborne, pressing into a window's side edge or
      // the screen edge → cling (slow slide) and wall-jump away. Grounded walking
      // is never blocked — the figure strolls in front of windows freely.
      S.walled = 0;
      if (!S.grounded) {
        const half = FW / 2;
        const cling = (wx, sideDir, topY, botY) => { // sideDir: -1 wall on left, +1 wall on right
          if (ny < topY + 8 || ny - FH * 0.5 > botY) return;
          if (sideDir === 1 && dir > 0 && Math.abs((nx + half) - wx) < 9) { nx = wx - half; S.walled = 1; S.vy = Math.min(S.vy, WALL_SLIDE_VY); }
          else if (sideDir === -1 && dir < 0 && Math.abs((nx - half) - wx) < 9) { nx = wx + half; S.walled = -1; S.vy = Math.min(S.vy, WALL_SLIDE_VY); }
        };
        document.querySelectorAll(".window:not(.minimized)").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4) return;
          cling(r.left / z0, 1, r.top / z0, r.bottom / z0);   // approach from the left → wall on your right
          cling(r.right / z0, -1, r.top / z0, r.bottom / z0); // approach from the right → wall on your left
        });
        cling(6, -1, 0, H);     // screen edges are walls too
        cling(W - 6, 1, 0, H);
      }
      // ---- a window opened ON the figure → it pops on top (run along the lid) ----
      document.querySelectorAll(".window:not(.minimized)").forEach((el) => {
        if (knownWins.has(el)) return;
        knownWins.add(el);
        const r = el.getBoundingClientRect();
        if (nx > r.left / z0 && nx < r.right / z0 && ny > r.top / z0 && ny < r.bottom / z0 + 20) {
          const tbEl = el.querySelector(".window-titlebar");
          ny = ((tbEl || el).getBoundingClientRect().top) / z0;
          S.vy = 0; S.grounded = true; S.landTimer = 8; S.airJumps = 1;
        }
      });
    }

    S.x = nx; S.y = ny;

    // ---- pick the animation + advance the walk cycle ----
    if (Math.abs(S.vx) > 0.4 && S.grounded) S.phase += (Math.abs(S.vx) / 1.85) * 0.18 * dt;
    if (spriteMode) applySpriteVisual();
    else {
      let P;
      if (S.attackTimer > 0) P = poseAttack(Math.sin((1 - S.attackTimer / 12) * Math.PI));
      else if (S.sliding) P = poseSlide();
      else if (keys.down && S.grounded) P = poseCrawl(S.phase);
      else if (!S.grounded && S.walled !== 0) { S.facing = S.walled; P = poseWallCling(); }
      else if (!S.grounded) P = S.vy < 0 ? poseJump() : poseFall();
      else if (Math.abs(S.vx) > 0.4) P = poseWalkRun(S.phase, Math.abs(S.vx) > WALK + 0.5);
      else P = poseIdle(S.t);
      drawPose(P);
      place();
    }
    void prevY;
    raf = requestAnimationFrame(frame);
  }

  // position the SVG so the figure's feet sit at world (S.x, S.y)
  function place() {
    const tx = S.x - HIPX, ty = S.y - NECK_TO_FOOT;
    svg.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${S.facing})`;
  }
  // the DRAWING as the character: body-level life — lean into the run, bob with
  // the steps, stretch on the rise, squash on landing, flip on the double jump.
  // (transform-origin is the feet: bottom-center)
  function applySpriteVisual() {
    let sx = 1, sy = 1, rot = 0, dy = 0, ax = 0;
    if (S.attackTimer > 0) {                     // PUNCH: wind up → snap forward → settle
      const p = 1 - S.attackTimer / 12;          // 0..1
      let k;
      if (p < 0.26) k = -(p / 0.26) * 0.55;                     // pull back
      else if (p < 0.58) k = ((p - 0.26) / 0.32) * 1.55 - 0.55; // snap out (overshoot)
      else k = (1 - (p - 0.58) / 0.42);                         // recover
      ax = S.facing * k * 13; rot = k * 11; sx = 1 + Math.abs(k) * 0.16; sy = 1 - Math.abs(k) * 0.1;
    } else if (S.sliding) {                       // knee slide: lean way back, low, fast
      rot = -26; sy = 0.58; sx = 1.24; dy = 3;
    } else if (keys.down && S.grounded) {         // crawl: low, waddling side to side
      sy = 0.52; sx = 1.2;
      rot = Math.sin(S.phase) * 7;
      dy = Math.abs(Math.sin(S.phase * 0.5)) * 1.5;
    } else if (S.landTimer > 0) {                 // landing squash, recovering
      const k = S.landTimer / 8;
      sy = 1 - 0.26 * k; sx = 1 + 0.26 * k;
    } else if (!S.grounded) {
      if (S.walled !== 0) { rot = 9; sy = 1.06; sx = 0.95; }    // clinging to a wall, sliding down
      else if (S.spinTimer > 0) rot = (1 - S.spinTimer / 16) * 360 * S.facing; // the double-jump flip
      else { sy = S.vy < 0 ? 1.14 : 0.94; sx = 2 - sy; rot = clamp(S.vx * 1.8, -16, 16); } // stretch up, squash down
    } else if (Math.abs(S.vx) > 0.4) {            // RUN: bound + marching sway + foot-plant squash
      const bob = Math.abs(Math.sin(S.phase));
      dy = -bob * 5.5;
      rot = clamp(S.vx * 1.7, -9, 9) + Math.sin(S.phase) * 4.5 * S.facing; // pendulum sway from the feet
      sy = 1 - (1 - bob) * 0.07; sx = 2 - sy;                   // squashes as the foot lands
    } else {                                      // idle: breathing + subtle sway
      sy = 1 + Math.sin(S.t * 0.05) * 0.025;
      rot = Math.sin(S.t * 0.031) * 1.8;
    }
    if (S.walled !== 0 && !S.grounded) S.facing = S.walled;     // face the wall while clinging
    img.style.transform = `translate(${(S.x - FW / 2 + ax).toFixed(1)}px, ${(S.y - FH + dy).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${(sx * S.facing).toFixed(3)}, ${sy.toFixed(3)})`;
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
