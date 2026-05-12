// UI scale — applied to <body> via CSS `zoom`. Works correctly across
// Chrome, Edge, Safari, and iOS for visual scaling AND keeps fixed-
// positioned chrome (taskbar, etc.) visible. Pointer-event coords on
// iOS WebKit can drift slightly at extreme zoom (marquee origin offset),
// which is why mobile defaults to 100% — but the user can opt in.

const KEY = "site.scale";
export const SCALES = [75, 90, 100, 110, 125, 150];

export function isTouchDevice() {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

export function getScale() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored != null) {
      const v = parseInt(stored, 10);
      if (SCALES.includes(v)) return v;
    }
  } catch (_) {}
  // Default: 110% on desktops (pointer: fine), 100% on touch.
  if (typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches) return 110;
  return 100;
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
