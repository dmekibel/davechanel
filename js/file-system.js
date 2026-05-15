// Virtual file system
// Pure data. The file explorer renders this; programs read from it.
//
// Node shape:
//   { name, type: "folder"|"file", icon?, kind?, children?, data? }
// kind on a file says how to open it: "notepad", "explorer", "media", "compose", "html", "image"
// data is the payload (string, url, html, or folder path).

import { FINE_ART } from "./fine-art-manifest.js";
import { UPSCALES } from "./upscale-manifest.js";

// Dev mode: ?dev=1 in the URL surfaces the "Upscale Tests" folder so
// David can review gpt-image-2 variants via the Image Viewer. Persists
// for the rest of the browser session so reloads keep the flag.
const isDev = (() => {
  try {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has("dev")) {
      sessionStorage.setItem("dev", params.get("dev") || "1");
    }
    return (sessionStorage.getItem("dev") || "") !== "" && sessionStorage.getItem("dev") !== "0";
  } catch (_) { return false; }
})();

export const FS = {
  name: "Mekibel",
  type: "folder",
  icon: "♁",
  children: [
    {
      name: "Fine Art",
      type: "folder",
      icon: "🖼",
      children: [
        {
          name: "Fine Art CV.txt",
          type: "file",
          icon: "📄",
          kind: "notepad",
          src: "content/fine-art-cv.txt",
        },
        // Fine-art images come from the auto-generated manifest.
        // Add new pieces by dropping the originals into content/images/
        // and running ./scripts/process-images.sh
        ...FINE_ART,
        // Dev-only — gpt-image-2 upscale variants for review, gated by ?dev=1
        ...(isDev ? [{
          name: "Upscale Tests (dev)",
          type: "folder",
          icon: "🔬",
          children: UPSCALES,
        }] : []),
      ],
    },
    {
      name: "Balancē Creative",
      type: "folder",
      icon: "◈",
      children: [
        {
          name: "Commercial CV.txt",
          type: "file",
          icon: "📄",
          kind: "notepad",
          src: "content/commercial-cv.txt",
        },
        {
          name: "About the studio.txt",
          type: "file",
          icon: "📄",
          kind: "notepad",
          data: `BALANCĒ CREATIVE
============================================================
A full-pipeline creative studio. Since 2020. Moscow.

We take brands through the whole arc: ideation, branding,
production. The specialty is cutting-edge AI visuals,
integrated with 3D, motion graphics, and VFX.

Co-founded by David Mekibel.

------------------------------------------------------------
SELECTED BRAND WORK
------------------------------------------------------------
  Aeroflot
  Redmond
  Winline
  Nature Siberica
  Ozon Fresh
  Dota 2
  Critical Ops
  IRI

------------------------------------------------------------
SELECTED MUSIC WORK  (via MIR Studios, since 2018)
------------------------------------------------------------
  Vera Brezhneva
  Dima Bilan
  Morgenshtern

------------------------------------------------------------
SERVICES
------------------------------------------------------------
  AI video / Generative AI
  3D and motion graphics
  Branding and art direction
  Full creative pipeline

------------------------------------------------------------
HIRE THE STUDIO
------------------------------------------------------------
  balance-creative.com
  hello@balance-creative.com
============================================================
`,
        },
        {
          name: "Brand Work",
          type: "folder",
          icon: "💼",
          children: [
            // Populate with brand projects in v0.3
          ],
        },
        {
          name: "Music Industry",
          type: "folder",
          icon: "🎵",
          children: [
            // Music videos, album covers, merch (via MIR Studios) — populated in v0.3
          ],
        },
      ],
    },
    {
      name: "About Me.txt",
      type: "file",
      icon: "📝",
      kind: "notepad",
      data: null,   // loaded from /content/about.txt at runtime
      src: "content/about.txt",
      srcRu: "content/about-me.ru.txt",
    },
    {
      name: "Showreel.mpg",
      type: "file",
      icon: "🎬",
      kind: "media",
      data: null,   // set when David provides reel link
    },
    {
      name: "Contact",
      type: "file",
      icon: "✉",
      kind: "compose",
    },
    {
      name: "Recycle Bin",
      type: "folder",
      icon: "🗑",
      children: [],
    },
  ],
};

// Walk helpers
export function findByPath(path) {
  // path is an array of names from root, e.g. ["Fine Art"]
  let node = FS;
  for (const name of path) {
    if (node.type !== "folder") return null;
    const next = node.children.find(c => c.name === name);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function rootFolders() {
  return FS.children.filter(c => c.type === "folder");
}

export function rootDesktopItems() {
  // Items shown as desktop shortcuts. Order matters.
  const wanted = ["Fine Art", "Balancē Creative", "About Me.txt", "Showreel.mpg", "Contact", "Recycle Bin"];
  return wanted
    .map(name => FS.children.find(c => c.name === name))
    .filter(Boolean);
}
