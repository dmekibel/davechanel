// Screensaver engine with multiple modes. Pick in Settings > Screen Saver.

const KEY = "site.screensaver";
export const SAVERS = [
  { id: "bounce",  label: "Bouncing David Mekibel" },
  { id: "stars",   label: "Starfield" },
  { id: "mystify", label: "Mystify" },
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
