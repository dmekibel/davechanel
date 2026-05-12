// Heaven OS — virtual file system
// Pure data. The file explorer renders this; programs read from it.
//
// Node shape:
//   { name, type: "folder"|"file", icon?, kind?, children?, data? }
// kind on a file says how to open it: "notepad", "explorer", "media", "compose", "html"
// data is the payload (string, url, html, or folder path).

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
        // Populate with David's art pieces in v0.6
        // e.g. ArtPrize 2024 (Madonna / Mnemosyne), ArtPrize 2025 winning piece,
        // Heaven Inc, Transhuman, Cyber Pink, etc.
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
