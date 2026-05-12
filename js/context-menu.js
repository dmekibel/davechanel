// Heaven OS — shared Win98-styled context menu.
// Used by desktop empty-space tap and explorer empty-pane tap.

export function showContextMenu(x, y, items) {
  closeContextMenu();
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
    row.textContent = it.label;
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

  // Clamp inside viewport
  const r = menu.getBoundingClientRect();
  let nx = x, ny = y;
  if (r.right  > window.innerWidth)  nx = Math.max(4, window.innerWidth  - r.width  - 4);
  if (r.bottom > window.innerHeight) ny = Math.max(4, window.innerHeight - r.height - 4);
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
