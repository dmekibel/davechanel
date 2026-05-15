// Unified OS-mode controller.
//
// Replaces the old wallpaper.js + icon-theme.js split with a single mode
// concept. Each mode is a self-contained aesthetic: chrome + wallpapers +
// icons all switch together. Inside a mode, the user picks one of N
// wallpapers ("display options").
//
// Persisted state:
//   - site.os-mode             → "win98" | "xp"
//   - site.wallpaper.win98     → one of WIN98.wallpapers ids
//   - site.wallpaper.xp        → one of XP.wallpapers ids
//
// Applied state on <body>:
//   - data-os="win98"|"xp"     → drives chrome CSS (Luna vs classic gray)
//   - data-wallpaper="<id>"    → drives wallpaper CSS (preserved name)
//   - data-icon-theme="win98"|"xp"  → drives icon set (preserved name)
//
// Events:
//   - "osmode-update" (detail: { mode })   when mode changes
//   - "icontheme-update" (detail: { theme }) for back-compat with renderers
//     that still listen to the old event (icons.js).

const KEY_MODE = "site.os-mode";
const KEY_WP   = (mode) => `site.wallpaper.${mode}`;

// Legacy keys we migrate from (read once, then delete)
const LEGACY_KEY_ICON = "site.icontheme";
const LEGACY_KEY_WP   = "heaven-os.wallpaper";

export const MODES = {
  win98: {
    id: "win98",
    label: "Windows 98",
    default_wallpaper: "teal",
    wallpapers: [
      { id: "teal",         label: "Classic Teal" },
      { id: "clouds",       label: "Clouds" },
      { id: "setup",        label: "Setup" },
      { id: "forest",       label: "Forest" },
      { id: "sandstone",    label: "Sandstone" },
      { id: "black-thatch", label: "Black Thatch" },
      { id: "triangles",    label: "Triangles" },
    ],
  },
  xp: {
    id: "xp",
    label: "Windows XP",
    default_wallpaper: "bliss",
    wallpapers: [
      { id: "bliss",            label: "Bliss" },
      { id: "azul",             label: "Azul" },
      { id: "autumn",           label: "Autumn" },
      { id: "crystal",          label: "Crystal" },
      { id: "red-moon-desert",  label: "Red Moon Desert" },
      { id: "stonehenge",       label: "Stonehenge" },
    ],
  },
};

export const MODE_LIST = Object.values(MODES);

// ---- Read / write ----
function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
function safeDel(k) { try { localStorage.removeItem(k); } catch (_) {} }

export function getMode() {
  const v = safeGet(KEY_MODE);
  return (v === "xp" || v === "win98") ? v : "win98";
}

export function getWallpaper(mode = getMode()) {
  const cfg = MODES[mode];
  if (!cfg) return MODES.win98.default_wallpaper;
  const v = safeGet(KEY_WP(mode));
  if (v && cfg.wallpapers.some(w => w.id === v)) return v;
  return cfg.default_wallpaper;
}

export function setMode(modeId) {
  if (!MODES[modeId]) return;
  safeSet(KEY_MODE, modeId);
  apply();
  try { window.dispatchEvent(new CustomEvent("osmode-update", { detail: { mode: modeId } })); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent("icontheme-update", { detail: { theme: modeId } })); } catch (_) {}
}

export function setWallpaper(id, mode = getMode()) {
  if (!MODES[mode]) return;
  if (!MODES[mode].wallpapers.some(w => w.id === id)) return;
  safeSet(KEY_WP(mode), id);
  apply();
}

// ---- Migration from legacy split keys ----
// Idempotent — runs once on first apply(). Reads old keys, derives new ones,
// then deletes the legacy entries.
let _migrated = false;
function migrateLegacy() {
  if (_migrated) return;
  _migrated = true;

  const legacyIcon = safeGet(LEGACY_KEY_ICON);
  const legacyWp   = safeGet(LEGACY_KEY_WP);

  // Derive mode from old icon theme
  if (legacyIcon && !safeGet(KEY_MODE)) {
    if (legacyIcon === "xp") safeSet(KEY_MODE, "xp");
    else safeSet(KEY_MODE, "win98");  // "classic" + "win98" both map to win98
  }

  // Derive wallpaper. The old wallpaper system had 5 options for what is
  // now win98 mode (teal/sky/clouds/purple/black). Map dropped ones to teal.
  if (legacyWp) {
    let wp;
    if (legacyWp === "teal" || legacyWp === "clouds") wp = legacyWp;
    else if (legacyWp === "heaven-sky") wp = "teal";  // older legacy id
    else wp = "teal";  // sky / purple / black → teal default
    if (!safeGet(KEY_WP("win98"))) safeSet(KEY_WP("win98"), wp);
  }

  // Don't delete legacy keys yet — leave them for one release in case we
  // need to roll back. Subsequent reads ignore them.
}

// ---- Apply to DOM ----
export function apply() {
  migrateLegacy();
  const mode = getMode();
  const wp   = getWallpaper(mode);
  if (document.body) {
    document.body.dataset.os = mode;
    document.body.dataset.wallpaper = wp;
    document.body.dataset.iconTheme = mode;  // back-compat for icon CSS
  }
  preloadAllIconSets();
}

// Warm the browser cache for every mode's icons so a swap doesn't flash.
let _preloadedIcons = false;
function preloadAllIconSets() {
  if (_preloadedIcons) return;
  _preloadedIcons = true;
  const ICONS = [
    "folder.png", "folder-open.png", "notepad.png", "my-computer.png",
    "recycle.png", "picture.png", "paint.png", "minesweeper.png",
    "briefcase.png", "mail.png", "movie.png", "gear.png", "help.png",
    "calculator.png",
  ];
  for (const folder of ["win98", "winxp"]) {
    for (const file of ICONS) {
      const img = new Image();
      img.src = `assets/icons/${folder}/${file}`;
    }
  }
}
