// Screensaver engine with multiple modes. Pick in Settings > Screen Saver.

const KEY = "site.screensaver";
export const SAVERS = [
  { id: "bounce",  label: "Bouncing David Mekibel" },
  { id: "stars",   label: "Starfield" },
  { id: "mystify", label: "Mystify" },
  { id: "bezier",  label: "Bezier" },
  { id: "windows", label: "Flying Windows" },
  { id: "pipes",   label: "3D Pipes" },
];

export function getSaver() {
  try { return localStorage.getItem(KEY) || "bounce"; }
  catch (_) { return "bounce"; }
}
export function setSaver(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
}

export function startScreensaver() {
  if (document.getElementById("screensaver")) return;
  const overlay = document.createElement("div");
  overlay.id = "screensaver";
  overlay.className = "screensaver";
  document.body.appendChild(overlay);

  const which = getSaver();
  let stop;
  if      (which === "stars")   stop = mountStarfield(overlay);
  else if (which === "mystify") stop = mountMystify(overlay);
  else if (which === "bezier")  stop = mountBezier(overlay);
  else if (which === "windows") stop = mountFlyingWindows(overlay);
  else if (which === "pipes")   stop = mountPipes(overlay);
  else                          stop = mountBounce(overlay);

  const WAKE_EVENTS = ["click", "keydown", "mousemove", "touchstart", "wheel"];
  const wake = () => {
    stop && stop();
    overlay.classList.add("waking");
    setTimeout(() => overlay.remove(), 220);
    WAKE_EVENTS.forEach(ev => document.removeEventListener(ev, wake, true));
  };
  setTimeout(() => {
    WAKE_EVENTS.forEach(ev => document.addEventListener(ev, wake, true));
  }, 350);
}

/* ---------------- Bouncing David Mekibel ---------------- */
function mountBounce(overlay) {
  const COLORS = ["#ff3344","#ff7a22","#ffd140","#5cd862","#3fc7e6","#5366ff","#b948e3","#ff45b0","#ffffff"];
  const logo = document.createElement("div");
  logo.className = "screensaver-logo";
  logo.textContent = "David Mekibel";
  overlay.appendChild(logo);
  let raf;
  requestAnimationFrame(() => {
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const w = () => logo.offsetWidth, h = () => logo.offsetHeight;
    let x = Math.random() * Math.max(1, W() - w());
    let y = Math.random() * Math.max(1, H() - h());
    let dx = (Math.random() < 0.5 ? -1 : 1) * 1.7;
    let dy = (Math.random() < 0.5 ? -1 : 1) * 1.7;
    let ci = Math.floor(Math.random() * COLORS.length);
    logo.style.color = COLORS[ci];
    const tick = () => {
      x += dx; y += dy;
      let bounced = false;
      if (x <= 0) { x = 0; dx = -dx; bounced = true; }
      else if (x + w() >= W()) { x = W() - w(); dx = -dx; bounced = true; }
      if (y <= 0) { y = 0; dy = -dy; bounced = true; }
      else if (y + h() >= H()) { y = H() - h(); dy = -dy; bounced = true; }
      if (bounced) {
        ci = (ci + 1 + Math.floor(Math.random() * 3)) % COLORS.length;
        logo.style.color = COLORS[ci];
      }
      logo.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(raf);
}

/* ---------------- Starfield ---------------- */
function mountStarfield(overlay) {
  const canvas = document.createElement("canvas");
  canvas.className = "ss-canvas";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const N = 220;
  const stars = [];
  for (let i = 0; i < N; i++) {
    stars.push({
      x: (Math.random() - 0.5) * canvas.width,
      y: (Math.random() - 0.5) * canvas.height,
      z: Math.random() * canvas.width,
    });
  }
  const SPEED = 4;
  let raf;
  const tick = () => {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.fillStyle = "#fff";
    for (const s of stars) {
      s.z -= SPEED;
      if (s.z <= 0) {
        s.x = (Math.random() - 0.5) * canvas.width;
        s.y = (Math.random() - 0.5) * canvas.height;
        s.z = canvas.width;
      }
      const k = 128 / s.z;
      const px = s.x * k + cx;
      const py = s.y * k + cy;
      if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) continue;
      const size = (1 - s.z / canvas.width) * 3 + 0.3;
      ctx.fillRect(px, py, size, size);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

/* ---------------- Mystify (bouncing polylines with color-cycling trails) -------- */
function mountMystify(overlay) {
  const canvas = document.createElement("canvas");
  canvas.className = "ss-canvas";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const VERTS = 5;
  const TRAIL = 24;
  function makePoly() {
    const v = [];
    for (let i = 0; i < VERTS; i++) {
      v.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        dx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
        dy: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
      });
    }
    return { v, trail: [], hue: Math.random() * 360, dHue: 0.5 + Math.random() * 0.5 };
  }
  const polys = [makePoly(), makePoly()];

  let raf;
  const tick = () => {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of polys) {
      for (const v of p.v) {
        v.x += v.dx; v.y += v.dy;
        if (v.x <= 0 || v.x >= canvas.width)  v.dx = -v.dx;
        if (v.y <= 0 || v.y >= canvas.height) v.dy = -v.dy;
      }
      p.trail.push(p.v.map(v => ({ x: v.x, y: v.y })));
      if (p.trail.length > TRAIL) p.trail.shift();
      p.hue = (p.hue + p.dHue) % 360;
      ctx.lineWidth = 1.6;
      p.trail.forEach((snap, i) => {
        const a = (i + 1) / p.trail.length;
        ctx.strokeStyle = `hsla(${p.hue}, 90%, 60%, ${a * 0.9})`;
        ctx.beginPath();
        snap.forEach((v, j) => j === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y));
        ctx.closePath();
        ctx.stroke();
      });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

/* ---------------- Bezier (classic Win98 default) -------------------------- */
function mountBezier(overlay) {
  const canvas = document.createElement("canvas");
  canvas.className = "ss-canvas";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const pts = Array.from({ length: 4 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    dx: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.4),
    dy: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.4),
  }));
  let hue = Math.random() * 360;

  let raf;
  const tick = () => {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of pts) {
      p.x += p.dx; p.y += p.dy;
      if (p.x <= 0 || p.x >= canvas.width)  p.dx = -p.dx;
      if (p.y <= 0 || p.y >= canvas.height) p.dy = -p.dy;
    }
    hue = (hue + 0.7) % 360;
    ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    ctx.stroke();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

/* ---------------- Flying Windows ----------------------------------------- */
function mountFlyingWindows(overlay) {
  const canvas = document.createElement("canvas");
  canvas.className = "ss-canvas";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const FLAGS = 36;
  const flags = [];
  function spawn() {
    return {
      x: (Math.random() - 0.5) * canvas.width  * 1.4,
      y: (Math.random() - 0.5) * canvas.height * 1.4,
      z: Math.random() * 1000 + 100,
    };
  }
  for (let i = 0; i < FLAGS; i++) flags.push(spawn());

  function drawFlag(cx, cy, s) {
    const half = s / 2;
    ctx.fillStyle = "#e74c3c"; ctx.fillRect(cx - half, cy - half, half - 1, half - 1);
    ctx.fillStyle = "#27ae60"; ctx.fillRect(cx + 1,    cy - half, half - 1, half - 1);
    ctx.fillStyle = "#2980b9"; ctx.fillRect(cx - half, cy + 1,    half - 1, half - 1);
    ctx.fillStyle = "#f1c40f"; ctx.fillRect(cx + 1,    cy + 1,    half - 1, half - 1);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - half, cy - half, s, s);
  }

  const SPEED = 6;
  let raf;
  const tick = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    flags.sort((a, b) => b.z - a.z);
    for (const f of flags) {
      f.z -= SPEED;
      if (f.z <= 1) Object.assign(f, spawn());
      const k = 220 / f.z;
      const px = f.x * k + cx;
      const py = f.y * k + cy;
      const size = (1 - f.z / 1100) * 90 + 6;
      if (px + size < 0 || px - size > canvas.width)  continue;
      if (py + size < 0 || py - size > canvas.height) continue;
      drawFlag(px, py, size);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

/* ---------------- 3D Pipes (faux-iso) ------------------------------------ */
function mountPipes(overlay) {
  const canvas = document.createElement("canvas");
  canvas.className = "ss-canvas";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const COS = Math.cos(Math.PI / 6);
  const SIN = Math.sin(Math.PI / 6);
  const CELL = 18;
  const H = CELL * 1.0;
  function project(g) {
    return {
      x: (g.x - g.y) * COS * CELL + canvas.width / 2,
      y: (g.x + g.y) * SIN * CELL + canvas.height / 2 - g.z * H,
    };
  }

  const DIRS = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ];
  const PIPE_COLORS = [
    "#e74c3c", "#27ae60", "#2980b9", "#f39c12",
    "#8e44ad", "#16a2b8", "#d35400", "#2ecc71",
  ];

  function spawnPipe() {
    return {
      pos: { x: 0, y: 0, z: 0 },
      dir: DIRS[Math.floor(Math.random() * DIRS.length)],
      color: PIPE_COLORS[Math.floor(Math.random() * PIPE_COLORS.length)],
      life: 0,
      maxLife: 80 + Math.floor(Math.random() * 60),
    };
  }
  const pipes = [spawnPipe(), spawnPipe(), spawnPipe()];

  function drawSegment(from, to, color) {
    const a = project(from);
    const b = project(to);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let raf;
  const tick = () => {
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      if (Math.random() < 0.18) {
        const next = DIRS[Math.floor(Math.random() * DIRS.length)];
        if (!(next.x === -p.dir.x && next.y === -p.dir.y && next.z === -p.dir.z)) {
          p.dir = next;
        }
      }
      const from = { ...p.pos };
      p.pos.x += p.dir.x;
      p.pos.y += p.dir.y;
      p.pos.z += p.dir.z;
      drawSegment(from, p.pos, p.color);
      p.life++;

      const head = project(p.pos);
      const off = head.x < -50 || head.x > canvas.width + 50 ||
                  head.y < -50 || head.y > canvas.height + 50;
      if (p.life > p.maxLife || off) {
        pipes[i] = spawnPipe();
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const wipeTimer = setInterval(() => {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, 1800);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(wipeTimer);
    window.removeEventListener("resize", resize);
  };
}
