// UI scale — CSS zoom applied to <body>. Persists in localStorage.

const KEY = "site.scale";
export const SCALES = [75, 90, 100, 110, 125, 150, 175, 200];

export function getScale() {
  const v = parseInt((typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "100", 10);
  return SCALES.includes(v) ? v : 100;
}

export function setScale(v) {
  if (!SCALES.includes(v)) return;
  try { localStorage.setItem(KEY, String(v)); } catch (_) {}
  applyScale();
}

export function applyScale() {
  if (!document.body) return;
  document.body.style.zoom = (getScale() / 100).toFixed(2);
}
