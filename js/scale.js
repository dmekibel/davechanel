// UI scale — applied to <body> via CSS `zoom`. Works correctly across
// Chrome, Edge, Safari, and iOS for visual scaling AND keeps fixed-
// positioned chrome (taskbar, etc.) visible. Pointer-event coords on
// iOS WebKit can drift slightly at extreme zoom (marquee origin offset),
// which is why mobile defaults to 100% — but the user can opt in.

const KEY = "site.scale";
export const SCALES = [75, 90, 100, 110, 115, 125, 135, 150];

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
  // Default: 110% on desktops (pointer: fine), 125% on touch (much
  // easier to hit small Win98 buttons with a finger).
  if (typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches) return 110;
  return 125;
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
  _rz = 0; // the zoom changed — invalidate the measured rect-scale immediately
}

// Current scale multiplier applied to <body>. Used by code that mixes
// viewport POINTER coordinates (clientX/Y) with body-internal CSS pixel
// values. Pointer coords are visual px on every engine we've seen, so
// dividing them by the zoom value is correct (proven by the Paint
// touch-draw fix, which David verified on his iPhone).
export function currentZoom() {
  return getScale() / 100;
}

// How getBoundingClientRect() coordinates relate to body-internal layout px
// — MEASURED, not assumed. Desktop Chromium reports rects in visual px
// (scaled by the body zoom), so this returns ≈ the zoom value. Some iOS
// WebKit versions report rects UNSCALED under CSS zoom (already layout px),
// so this returns ≈ 1. Every game-geometry conversion of a rect must divide
// by THIS, not by currentZoom(), or positions are off by the zoom factor on
// one engine or the other (the stickman "floating above everything" bug).
let _rz = 0, _rzAt = 0;
export function rectZoom() {
  const now = (typeof performance !== "undefined" ? performance.now() : 0);
  if (_rz && now - _rzAt < 500) return _rz;
  const b = document.body;
  if (!b || !b.offsetWidth) return getScale() / 100; // pre-layout: assume spec behavior
  const w = b.getBoundingClientRect().width;
  _rz = w > 0 ? w / b.offsetWidth : getScale() / 100;
  _rzAt = now;
  return _rz;
}
