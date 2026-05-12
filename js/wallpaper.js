// Heaven OS — wallpaper / desktop background controller.
// Persists choice in localStorage; applies a data-wallpaper attribute on <body>.

const KEY = "heaven-os.wallpaper";

export const WALLPAPERS = [
  { id: "teal",       label: "Classic Win98 Teal (default)" },
  { id: "heaven-sky", label: "Sky" },
  { id: "clouds",     label: "Pixel Clouds" },
  { id: "purple",     label: "Purple Twilight" },
  { id: "black",      label: "Black" },
];

export function getWallpaper() {
  try { return localStorage.getItem(KEY) || "teal"; }
  catch (_) { return "teal"; }
}

export function setWallpaper(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
  applyWallpaper();
}

export function applyWallpaper() {
  const id = getWallpaper();
  // Apply to BOTH html and body so the iPhone landscape safe-area
  // side bands match the desktop color (no white gutters on the sides).
  document.documentElement.dataset.wallpaper = id;
  if (document.body) document.body.dataset.wallpaper = id;
}
