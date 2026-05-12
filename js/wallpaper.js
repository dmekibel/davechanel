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
  document.body.dataset.wallpaper = id;
}
