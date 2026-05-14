// Icon theme: "win98" (default) or "xp". Persists in localStorage and
// dispatches an "icontheme-update" event so renderers can re-paint.

const KEY = "site.icontheme";

export const ICON_THEMES = [
  { id: "win98", label: "Windows 98" },
  // XP theme is parked: the Null Tale atlas needs interactive position
  // mapping via /icon-picker.html before it produces correct icons.
  // Re-enable once XP positions are added to icons.js (XP object).
  // { id: "xp", label: "Windows XP (coming soon)" },
];

export function getIconTheme() {
  try { return localStorage.getItem(KEY) || "win98"; }
  catch (_) { return "win98"; }
}

export function setIconTheme(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
  applyIconTheme();
  try { window.dispatchEvent(new CustomEvent("icontheme-update", { detail: { theme: id } })); } catch (_) {}
}

export function applyIconTheme() {
  const id = getIconTheme();
  if (document.body) document.body.dataset.iconTheme = id;
}
