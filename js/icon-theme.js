// Icon theme: "win98" (default) or "xp". Persists in localStorage and
// dispatches an "icontheme-update" event so renderers can re-paint.

const KEY = "site.icontheme";

export const ICON_THEMES = [
  { id: "win98", label: "Windows 98" },
  { id: "xp",    label: "Windows XP" },
];

export function getIconTheme() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "classic") return "win98";   // migrate legacy stored value
    return v || "win98";
  } catch (_) { return "win98"; }
}

export function setIconTheme(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
  applyIconTheme();
  try { window.dispatchEvent(new CustomEvent("icontheme-update", { detail: { theme: id } })); } catch (_) {}
}

export function applyIconTheme() {
  const id = getIconTheme();
  if (document.body) document.body.dataset.iconTheme = id;
  preloadAllIconSets();
}

// Warm the browser cache for every theme's icon files so a switch
// doesn't paint blank icons while it waits for a fresh download.
let _preloadedThemes = false;
function preloadAllIconSets() {
  if (_preloadedThemes) return;
  _preloadedThemes = true;
  const ICONS_FILES = [
    "folder.png", "folder-open.png", "notepad.png", "my-computer.png",
    "recycle.png", "picture.png", "paint.png", "minesweeper.png",
    "briefcase.png", "mail.png", "movie.png", "gear.png", "help.png",
    "calculator.png",
  ];
  for (const folder of ["win98", "winxp"]) {
    for (const file of ICONS_FILES) {
      const img = new Image();
      img.src = `assets/icons/${folder}/${file}`;
    }
  }
}
