// Icon theme: "win98" (default) or "xp". Persists in localStorage and
// dispatches an "icontheme-update" event so renderers can re-paint.

const KEY = "site.icontheme";

export const ICON_THEMES = [
  { id: "classic", label: "Classic (hand-drawn SVGs)" },
  { id: "win98",   label: "Windows 98" },
  { id: "xp",      label: "Windows XP" },
];

export function getIconTheme() {
  try { return localStorage.getItem(KEY) || "classic"; }
  catch (_) { return "classic"; }
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
