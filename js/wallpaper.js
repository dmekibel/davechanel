// Heaven OS — wallpaper / desktop background controller.
// Persists choice in localStorage; applies a data-wallpaper attribute on <body>.

const KEY = "heaven-os.wallpaper";

export const WALLPAPERS = [
  { id: "heaven-sky", label: "Heaven Sky (default)" },
  { id: "teal",       label: "Classic Win98 Teal" },
  { id: "clouds",     label: "Pixel Clouds" },
  { id: "purple",     label: "Purple Twilight" },
  { id: "black",      label: "Black" },
];

export function getWallpaper() {
  try { return localStorage.getItem(KEY) || "heaven-sky"; }
  catch (_) { return "heaven-sky"; }
}

export function setWallpaper(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
  applyWallpaper();
}

export function applyWallpaper() {
  const id = getWallpaper();
  document.body.dataset.wallpaper = id;
}
