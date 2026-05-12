// UI scale — CSS transform applied to <body>. Persists in localStorage.
// Touch devices always render at 100% (the OS pinch-zoom handles user scaling
// natively; layered scale on touch screws up coordinate math and never reads
// well next to system gestures).

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
  // Default 110% on desktops.
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
  // Use CSS transform (not the non-standard `zoom`, which is buggy on iOS
  // Safari). Compensate body's box so it visually fills the viewport.
  const b = document.body;
  b.style.transformOrigin = "top left";
  if (z === 1) {
    b.style.transform = "";
    b.style.width  = "";
    b.style.height = "";
  } else {
    b.style.transform = `scale(${z})`;
    b.style.width  = `${(100 / z).toFixed(4)}vw`;
    b.style.height = `${(100 / z).toFixed(4)}vh`;
  }
  // Clear legacy zoom in case an older build set it.
  b.style.zoom = "";
}

// Current scale multiplier applied to <body>. Used by code that mixes
// viewport pointer coordinates with body-internal CSS pixel values.
export function currentZoom() {
  return getScale() / 100;
}
