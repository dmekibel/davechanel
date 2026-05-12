// Wallpaper / desktop background controller.
// Persists choice in localStorage; applies a data-wallpaper attribute on <body>.
// The wallpaper paints inside .desktop only — body stays solid black so the
// iOS safe-area side bands read as a deliberate device-bezel frame.

const KEY = "heaven-os.wallpaper";

export const WALLPAPERS = [
  { id: "teal",   label: "Classic Win98 Teal (default)" },
  { id: "sky",    label: "Sky" },
  { id: "clouds", label: "Pixel Clouds" },
  { id: "purple", label: "Purple Twilight" },
  { id: "black",  label: "Black" },
];

export function getWallpaper() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "heaven-sky") return "sky";   // migrate legacy id
    return v || "teal";
  } catch (_) { return "teal"; }
}

export function setWallpaper(id) {
  try { localStorage.setItem(KEY, id); } catch (_) {}
  applyWallpaper();
}

export function applyWallpaper() {
  const id = getWallpaper();
  if (document.body) document.body.dataset.wallpaper = id;
}
