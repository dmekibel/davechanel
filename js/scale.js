// UI scale — applied to <body> via CSS `zoom` (well-behaved on Chrome/Edge
// desktop, which is the target audience for scaling). Touch devices keep
// scale=100: iOS WebKit's `zoom` is buggy with fixed-positioned children,
// and `transform: scale()` causes the taskbar to disappear inside the
// transformed body, so neither approach is safe to expose on touch.
// The OS pinch-zoom on touch fills the same use case anyway.

const KEY = "site.scale";
export const SCALES = [75, 90, 100, 110, 125, 150, 175, 200];

export function isTouchDevice() {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

export function getScale() {
  if (isTouchDevice()) return 100;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored != null) {
      const v = parseInt(stored, 10);
      if (SCALES.includes(v)) return v;
    }
  } catch (_) {}
  // Default 110% on desktop.
  return 110;
}

export function setScale(v) {
  if (!SCALES.includes(v)) return;
  try { localStorage.setItem(KEY, String(v)); } catch (_) {}
  applyScale();
}

export function applyScale() {
  if (!document.body) return;
  const z = getScale() / 100;
  const b = document.body;
  // Wipe any transform-scale leftover from v0.37 so old visitors don't
  // see a doubly-scaled UI when this build deploys.
  b.style.transform = "";
  b.style.transformOrigin = "";
  b.style.width  = "";
  b.style.height = "";
  b.style.zoom = z === 1 ? "" : z.toFixed(2);
}

// Current scale multiplier applied to <body>. Used by code that mixes
// viewport pointer coordinates with body-internal CSS pixel values.
export function currentZoom() {
  return getScale() / 100;
}
