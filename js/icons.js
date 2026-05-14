// Heaven OS — Win98-flavored pixel-art icons (inline SVG)
// Designed at 16x16 viewBox, rendered crisp via shape-rendering.
// Use at any size — they'll stay pixelated.

const wrap = (inner, size) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

const FOLDER = `
  <path d="M0 4 L5 4 L7 5 L15 5 L15 13 L0 13 Z" fill="#fdd55d" stroke="#000" stroke-width="1"/>
  <path d="M1 5 L5 5 L7 6 L14 6" stroke="#fff8c0" stroke-width="1" fill="none"/>
  <path d="M0 13 L15 13" stroke="#a07300" stroke-width="0"/>
`;
const FOLDER_OPEN = `
  <path d="M0 4 L5 4 L7 5 L15 5 L15 8 L2 8 L0 13 Z" fill="#fdd55d" stroke="#000" stroke-width="1"/>
  <path d="M2 8 L4 13 L15 13 L13 8 Z" fill="#fff080" stroke="#000" stroke-width="1"/>
`;
const DOCUMENT = `
  <path d="M2 1 L11 1 L14 4 L14 14 L2 14 Z" fill="#fff" stroke="#000" stroke-width="1"/>
  <path d="M11 1 L11 4 L14 4" stroke="#000" stroke-width="1" fill="none"/>
  <rect x="4" y="6" width="6" height="1" fill="#000"/>
  <rect x="4" y="8" width="7" height="1" fill="#000"/>
  <rect x="4" y="10" width="5" height="1" fill="#000"/>
`;
const NOTEPAD = `
  <path d="M2 1 L11 1 L14 4 L14 14 L2 14 Z" fill="#fff" stroke="#000" stroke-width="1"/>
  <path d="M11 1 L11 4 L14 4" stroke="#000" stroke-width="1" fill="none"/>
  <rect x="4" y="6" width="7" height="1" fill="#0040a0"/>
  <rect x="4" y="8" width="7" height="1" fill="#0040a0"/>
  <rect x="4" y="10" width="5" height="1" fill="#0040a0"/>
`;
const MY_COMPUTER = `
  <rect x="1" y="2" width="14" height="9"  fill="#cdcdcd" stroke="#000"/>
  <rect x="2" y="3" width="12" height="7"  fill="#0040a0"/>
  <rect x="3" y="4" width="3"  height="1"  fill="#80c0ff"/>
  <rect x="3" y="6" width="6"  height="1"  fill="#80c0ff"/>
  <rect x="6" y="11" width="4" height="1"  fill="#cdcdcd" stroke="#000"/>
  <rect x="3" y="13" width="10" height="2" fill="#cdcdcd" stroke="#000"/>
`;
const RECYCLE = `
  <path d="M3 4 L13 4 L12 14 L4 14 Z" fill="#a0a0c0" stroke="#000" stroke-width="1"/>
  <rect x="2" y="2" width="12" height="2" fill="#a0a0c0" stroke="#000" stroke-width="1"/>
  <rect x="6" y="1" width="4" height="1" fill="#a0a0c0" stroke="#000" stroke-width="1"/>
  <rect x="6" y="6" width="1" height="6" fill="#000"/>
  <rect x="9" y="6" width="1" height="6" fill="#000"/>
`;
const PICTURE = `
  <rect x="1" y="2" width="14" height="11" fill="#fff" stroke="#000"/>
  <rect x="2" y="3" width="12" height="9" fill="#80c0ff"/>
  <circle cx="11" cy="6" r="1.5" fill="#fff080"/>
  <path d="M2 12 L5 8 L7 10 L10 6 L14 12 Z" fill="#208040"/>
`;
const PAINT = `
  <rect x="2" y="1" width="12" height="11" fill="#fff" stroke="#000"/>
  <rect x="3" y="2" width="2" height="2" fill="#d63a1e"/>
  <rect x="6" y="2" width="2" height="2" fill="#fdd55d"/>
  <rect x="9" y="2" width="2" height="2" fill="#208040"/>
  <rect x="3" y="5" width="2" height="2" fill="#1976d2"/>
  <rect x="6" y="5" width="2" height="2" fill="#7b1fa2"/>
  <rect x="9" y="5" width="2" height="2" fill="#f57c00"/>
  <path d="M11 11 L13 9 L15 11 L13 13 Z" fill="#cdcdcd" stroke="#000"/>
  <rect x="4" y="13" width="8" height="2" fill="#cdcdcd" stroke="#000"/>
`;
const MINESWEEPER = `
  <rect x="1" y="1" width="14" height="14" fill="#c3c3c3" stroke="#000"/>
  <rect x="2" y="2" width="12" height="12" fill="#808080"/>
  <circle cx="8" cy="8" r="3.5" fill="#000"/>
  <rect x="7" y="3" width="2" height="2" fill="#000"/>
  <rect x="3" y="7" width="2" height="2" fill="#000"/>
  <rect x="11" y="7" width="2" height="2" fill="#000"/>
  <rect x="7" y="11" width="2" height="2" fill="#000"/>
  <rect x="6" y="6" width="1" height="1" fill="#fff"/>
`;
const BRIEFCASE = `
  <rect x="6" y="3" width="4" height="2" fill="none" stroke="#000"/>
  <rect x="1" y="5" width="14" height="9" fill="#704020" stroke="#000"/>
  <rect x="1" y="8" width="14" height="1" fill="#000"/>
  <rect x="7" y="8" width="2" height="2" fill="#fdd55d" stroke="#000"/>
`;
const MAIL = `
  <rect x="1" y="3" width="14" height="10" fill="#fff" stroke="#000"/>
  <path d="M1 3 L8 9 L15 3" stroke="#000" fill="none"/>
  <path d="M1 13 L6 8" stroke="#000" fill="none"/>
  <path d="M15 13 L10 8" stroke="#000" fill="none"/>
`;
const MOVIE = `
  <rect x="1" y="3" width="14" height="10" fill="#202020" stroke="#000"/>
  <rect x="1" y="3" width="2" height="1" fill="#fff"/>
  <rect x="1" y="5" width="2" height="1" fill="#fff"/>
  <rect x="1" y="7" width="2" height="1" fill="#fff"/>
  <rect x="1" y="9" width="2" height="1" fill="#fff"/>
  <rect x="1" y="11" width="2" height="1" fill="#fff"/>
  <rect x="13" y="3" width="2" height="1" fill="#fff"/>
  <rect x="13" y="5" width="2" height="1" fill="#fff"/>
  <rect x="13" y="7" width="2" height="1" fill="#fff"/>
  <rect x="13" y="9" width="2" height="1" fill="#fff"/>
  <rect x="13" y="11" width="2" height="1" fill="#fff"/>
  <path d="M5 5 L11 8 L5 11 Z" fill="#fdd55d"/>
`;
const ARROW_LEFT  = `<path d="M11 3 L5 8 L11 13 L11 11 L8 8 L11 5 Z" fill="#000"/>`;
const ARROW_RIGHT = `<path d="M5 3 L11 8 L5 13 L5 11 L8 8 L5 5 Z" fill="#000"/>`;
const ARROW_UP    = `<path d="M3 11 L8 5 L13 11 L11 11 L8 8 L5 11 Z" fill="#000"/>`;
const GEAR = `
  <rect x="7" y="0" width="2" height="2" fill="#5a5a5a"/>
  <rect x="7" y="14" width="2" height="2" fill="#5a5a5a"/>
  <rect x="0" y="7" width="2" height="2" fill="#5a5a5a"/>
  <rect x="14" y="7" width="2" height="2" fill="#5a5a5a"/>
  <rect x="2" y="2" width="2" height="2" fill="#5a5a5a"/>
  <rect x="12" y="2" width="2" height="2" fill="#5a5a5a"/>
  <rect x="2" y="12" width="2" height="2" fill="#5a5a5a"/>
  <rect x="12" y="12" width="2" height="2" fill="#5a5a5a"/>
  <rect x="3" y="3" width="10" height="10" fill="#c3c3c3" stroke="#5a5a5a" stroke-width="1"/>
  <rect x="6" y="6" width="4" height="4" fill="#fff" stroke="#5a5a5a" stroke-width="1"/>
`;
const SEARCH = `
  <circle cx="6" cy="6" r="4" fill="none" stroke="#000" stroke-width="1.5"/>
  <path d="M9 9 L13 13" stroke="#000" stroke-width="2"/>
`;
const HELP = `
  <rect x="2" y="1" width="12" height="14" fill="#fff" stroke="#000"/>
  <text x="8" y="11" font-family="Tahoma,sans-serif" font-size="10" font-weight="700" fill="#0040a0" text-anchor="middle">?</text>
`;
const RUN = `
  <rect x="2" y="2" width="12" height="12" fill="#fff" stroke="#000"/>
  <path d="M4 11 L4 5 L6 5 L8 8 L10 5 L12 5 L12 11 L10 11 L10 7 L8 10 L6 7 L6 11 Z" fill="#000"/>
`;
// Log Off — a key
const LOGOUT = `
  <circle cx="5" cy="8" r="3" fill="none" stroke="#000" stroke-width="1.4"/>
  <rect x="4" y="7" width="2" height="2" fill="#dba23a"/>
  <rect x="7" y="7" width="7" height="2" fill="#dba23a" stroke="#000" stroke-width="1"/>
  <rect x="11" y="9" width="2" height="2" fill="#dba23a" stroke="#000" stroke-width="1"/>
  <rect x="13" y="9" width="1" height="2" fill="#dba23a" stroke="#000" stroke-width="1"/>
`;
// Restart — circular arrow
const RESTART = `
  <path d="M8 2 A 6 6 0 1 1 2.5 6" stroke="#0066d0" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M1 4 L5 2 L4 6 Z" fill="#0066d0"/>
`;
// Power — for Shut Down
const POWER = `
  <circle cx="8" cy="9" r="5" fill="none" stroke="#d63a1e" stroke-width="2"/>
  <rect x="7" y="2" width="2" height="6" fill="#d63a1e"/>
  <rect x="7.4" y="2.4" width="1.2" height="5.2" fill="#fff"/>
`;

// Real Win98 PNG icons (from win98icons.alexmeub.com) live in
// /assets/icons/win98/. Rendered as <img> so they keep crisp pixel-art
// edges. The little SVGs above are kept for chrome elements we couldn't
// find a Win98 equivalent for (arrows, search, run, logout, restart,
// power, document).
import { getIconTheme } from "./icon-theme.js";

function png98(file, s) {
  return `<img class="ico ico-png" src="assets/icons/win98/${file}" width="${s}" height="${s}" alt="" draggable="false" style="image-rendering:pixelated">`;
}
// XP icons live in a 736×704 sprite atlas of 32px tiles. (col, row) →
// CSS background-position with image-rendering: pixelated. Positions
// below are best-guess from visual inspection — refine via the
// /icon-picker.html tool when you find a better tile.
const ATLAS_URL = "assets/icons/winxp/WinIcons_32.png";
const ATLAS_W = 736, ATLAS_H = 704, TILE = 32;
function xpSprite(col, row, s) {
  const k = s / TILE;
  const sx = col * TILE * k, sy = row * TILE * k;
  return `<span class="ico ico-xp" style="display:inline-block;width:${s}px;height:${s}px;background:url('${ATLAS_URL}') -${sx}px -${sy}px / ${ATLAS_W * k}px ${ATLAS_H * k}px no-repeat;image-rendering:pixelated;vertical-align:middle"></span>`;
}
function make(win98File, xpPos) {
  return (s = 16) => {
    if (getIconTheme() === "xp" && xpPos) return xpSprite(xpPos.col, xpPos.row, s);
    return png98(win98File, s);
  };
}
// XP tile positions (col, row) — initial guesses. Replace via icon-picker.html.
const XP = {
  folder:      { col:  5, row:  0 },
  folderOpen:  { col:  2, row:  3 },
  recycle:     { col:  0, row:  2 },
  help:        { col:  2, row:  1 },
  notepad:     { col:  2, row:  4 },
  picture:     { col:  0, row:  4 },
  paint:       { col:  4, row:  4 },
  myComputer:  { col:  1, row:  9 },
  briefcase:   { col:  6, row:  8 },
  mail:        { col:  4, row:  2 },
  movie:       { col:  4, row: 12 },
  minesweeper: { col:  3, row: 16 },
  gear:        { col:  4, row:  8 },
  calculator:  { col:  2, row:  6 },
};

export const ICONS = {
  folder:      make("folder.png",       XP.folder),
  folderOpen:  make("folder-open.png",  XP.folderOpen),
  document:    (s = 16) => wrap(DOCUMENT, s),
  notepad:     make("notepad.png",      XP.notepad),
  myComputer:  make("my-computer.png",  XP.myComputer),
  recycle:     make("recycle.png",      XP.recycle),
  picture:     make("picture.png",      XP.picture),
  paint:       make("paint.png",        XP.paint),
  minesweeper: make("minesweeper.png",  XP.minesweeper),
  briefcase:   make("briefcase.png",    XP.briefcase),
  mail:        make("mail.png",         XP.mail),
  movie:       make("movie.png",        XP.movie),
  gear:        make("gear.png",         XP.gear),
  help:        make("help.png",         XP.help),
  calculator:  make("calculator.png",   XP.calculator),
  arrowLeft:   (s = 16) => wrap(ARROW_LEFT, s),
  arrowRight:  (s = 16) => wrap(ARROW_RIGHT, s),
  arrowUp:     (s = 16) => wrap(ARROW_UP, s),
  search:      (s = 16) => wrap(SEARCH, s),
  run:         (s = 16) => wrap(RUN, s),
  logout:      (s = 16) => wrap(LOGOUT, s),
  restart:     (s = 16) => wrap(RESTART, s),
  power:       (s = 16) => wrap(POWER, s),
};

// Map a file-system node to its icon string.
export function iconFor(node, size = 16) {
  if (!node) return ICONS.document(size);
  if (node === "myComputer") return ICONS.myComputer(size);
  if (node.type === "folder") {
    // Folders always look like folders so it's obvious there's stuff inside.
    // Recycle Bin is the one special case — it has its own iconic shape.
    if (node.name === "Recycle Bin") return ICONS.recycle(size);
    return ICONS.folder(size);
  }
  switch (node.kind) {
    case "notepad": return ICONS.notepad(size);
    case "compose": return ICONS.mail(size);
    case "media":   return ICONS.movie(size);
    case "image":   return ICONS.picture(size);
  }
  return ICONS.document(size);
}
