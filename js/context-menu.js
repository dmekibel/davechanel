// Mekibel — shared Win98-styled context menu.
// Used by desktop empty-space tap and explorer empty-pane tap.

import { t } from "./i18n.js";
import { currentZoom } from "./scale.js";

export function showContextMenu(x, y, items) {
  closeContextMenu();
  // Pointer coords arrive post-zoom; CSS positioning is interpreted in
  // pre-zoom body-internal pixels. Divide to put the menu under the cursor.
  const z = currentZoom();
  x = x / z;
  y = y / z;
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.style.left = x + "px";
  menu.style.top  = y + "px";

  for (const it of items) {
    if (it === "sep") {
      const sep = document.createElement("div");
      sep.className = "sep";
      menu.appendChild(sep);
      continue;
    }
    const row = document.createElement("div");
    row.className = "item" + (it.disabled ? " disabled" : "");
    row.textContent = t(it.label);
    if (!it.disabled && it.action) {
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        closeContextMenu();
        it.action();
      });
    }
    menu.appendChild(row);
  }
  document.body.appendChild(menu);

  // Clamp inside the viewport in body-internal CSS px. offsetWidth /
  // offsetHeight are always pre-zoom (body-internal); innerWidth /
  // innerHeight are viewport / zoom (also body-internal). Both in the
  // same coord space — clamp left, right, top, bottom edges.
  const menuW = menu.offsetWidth;
  const menuH = menu.offsetHeight;
  const vw = window.innerWidth  / z;
  const vh = window.innerHeight / z;
  const margin = 4;
  let nx = x, ny = y;
  if (nx + menuW + margin > vw) nx = vw - menuW - margin;
  if (ny + menuH + margin > vh) ny = vh - menuH - margin;
  nx = Math.max(margin, nx);
  ny = Math.max(margin, ny);
  menu.style.left = nx + "px";
  menu.style.top  = ny + "px";

  setTimeout(() => {
    const closer = (e) => {
      if (!menu.contains(e.target)) {
        closeContextMenu();
        document.removeEventListener("mousedown", closer, true);
        document.removeEventListener("touchstart", closer, true);
      }
    };
    document.addEventListener("mousedown", closer, true);
    document.addEventListener("touchstart", closer, true);
  }, 0);
}

export function closeContextMenu() {
  document.querySelectorAll(".ctx-menu").forEach(n => n.remove());
}
