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

  // Clamp inside viewport. innerWidth/innerHeight are unzoomed CSS px.
  const r = menu.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = r.width / z, h = r.height / z;
  let nx = x, ny = y;
  if (nx + w > vw) nx = Math.max(4, vw - w - 4);
  if (ny + h > vh) ny = Math.max(4, vh - h - 4);
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
