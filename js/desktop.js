// Heaven OS — desktop init: icons, start menu, clock

import { rootDesktopItems } from "./file-system.js";
import { openProgram, openFile } from "./programs.js";
import { ICONS, iconFor } from "./icons.js";

const PROG_FOR = {
  "Fine Art": "fine-art",
  "Balancē Creative": "balance",
  "Recycle Bin": "recycle",
};

// Synthetic desktop shortcuts that don't live in the FS but appear on the desktop.
const DESKTOP_SHORTCUTS = [
  { name: "My Computer", iconHtml: ICONS.myComputer(32), program: "explorer" },
];

export function initDesktop() {
  document.title = "Heaven OS — David Mekibel";
  renderDesktopIcons();
  initStartMenu();
  initClock();
  initMarquee();
}

const POS_KEY = "heaven-os.icon-positions";

function loadIconPositions() {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || "{}"); }
  catch (_) { return {}; }
}
function saveIconPosition(name, x, y) {
  try {
    const all = loadIconPositions();
    all[name] = [x, y];
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch (_) {}
}

function renderDesktopIcons() {
  const ul = document.getElementById("desktop-icons");
  ul.innerHTML = "";

  const saved = loadIconPositions();
  const all = [
    ...DESKTOP_SHORTCUTS.map(sc => ({
      name: sc.name,
      iconHtml: sc.iconHtml,
      open: () => openProgram(sc.program),
    })),
    ...rootDesktopItems().map(item => ({
      name: item.name,
      iconHtml: iconFor(item, 32),
      open: () => {
        if (item.type === "folder") {
          const prog = PROG_FOR[item.name];
          if (prog) return openProgram(prog);
        } else {
          return openFile(item);
        }
      },
    })),
  ];

  // Default-grid positioning for icons that don't have a saved position.
  // Single column down the left edge.
  // We clamp every position (saved or default) to the current viewport so
  // positions persisted on a wider screen don't end up off-screen / hugging
  // the right edge on a narrower screen.
  const desktopEl = document.getElementById("desktop");
  const dW = desktopEl?.clientWidth  || window.innerWidth;
  const dH = desktopEl?.clientHeight || (window.innerHeight - 30);
  const ICON_W = 84;
  const ICON_H = 80;
  const maxX = Math.max(GRID_X0, dW - ICON_W - GRID_X0);
  const maxY = Math.max(GRID_Y0, dH - ICON_H - GRID_Y0);

  for (let i = 0; i < all.length; i++) {
    const meta = all[i];
    const li = makeIcon({ name: meta.name, iconHtml: meta.iconHtml, open: meta.open });
    const pos = saved[meta.name];
    const col = Math.floor(i / 6);
    const row = i % 6;
    let x = pos ? pos[0] : GRID_X0 + col * CELL_W;
    let y = pos ? pos[1] : GRID_Y0 + row * CELL_H;
    x = Math.max(GRID_X0, Math.min(maxX, x));
    y = Math.max(GRID_Y0, Math.min(maxY, y));
    li.style.left = x + "px";
    li.style.top  = y + "px";
    makeIconDraggable(li);
    ul.appendChild(li);
  }
}

// Grid spec — desktop icons snap to this on release.
const GRID_X0 = 12;
const GRID_Y0 = 12;
const CELL_W  = 96;
const CELL_H  = 86;

function snapToGrid(x, y) {
  const col = Math.max(0, Math.round((x - GRID_X0) / CELL_W));
  const row = Math.max(0, Math.round((y - GRID_Y0) / CELL_H));
  return [GRID_X0 + col * CELL_W, GRID_Y0 + row * CELL_H];
}

function makeIconDraggable(li) {
  const desktop = document.getElementById("desktop");

  const begin = (clientX, clientY, isTouch) => {
    // If THIS icon is part of a multi-selection, drag all selected icons together.
    // Otherwise drag just this one.
    const moveGroup = li.classList.contains("selected")
      ? [...document.querySelectorAll(".desktop-icon.selected")]
      : [li];
    const startPositions = moveGroup.map(el => ({
      el, x: el.offsetLeft, y: el.offsetTop,
    }));
    let dragged = false;

    const move = (cx, cy, e) => {
      const dx = cx - clientX;
      const dy = cy - clientY;
      if (!dragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragged = true;
      if (e && e.cancelable) e.preventDefault();
      const dRect = desktop.getBoundingClientRect();
      for (const sp of startPositions) {
        sp.el.classList.add("dragging");
        const w = sp.el.offsetWidth, h = sp.el.offsetHeight;
        const nx = Math.max(0, Math.min(dRect.width  - w, sp.x + dx));
        const ny = Math.max(0, Math.min(dRect.height - h, sp.y + dy));
        sp.el.style.left = nx + "px";
        sp.el.style.top  = ny + "px";
      }
    };
    const onMouseMove = (e) => move(e.clientX, e.clientY, e);
    const onTouchMove = (e) => {
      const p = e.touches[0] || e.changedTouches[0];
      if (p) move(p.clientX, p.clientY, e);
    };
    const cleanup = () => {
      for (const sp of startPositions) sp.el.classList.remove("dragging");
      if (dragged) {
        // Snap each to grid + persist
        const dRect = desktop.getBoundingClientRect();
        for (const sp of startPositions) {
          const [sx, sy] = snapToGrid(sp.el.offsetLeft, sp.el.offsetTop);
          const w = sp.el.offsetWidth, h = sp.el.offsetHeight;
          const fx = Math.max(0, Math.min(dRect.width  - w, sx));
          const fy = Math.max(0, Math.min(dRect.height - h, sy));
          sp.el.style.left = fx + "px";
          sp.el.style.top  = fy + "px";
          saveIconPosition(sp.el.querySelector(".icon-label").textContent, fx, fy);
          sp.el.dataset.justDragged = "1";
          setTimeout(() => delete sp.el.dataset.justDragged, 50);
        }
      }
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   cleanup);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  cleanup);
      document.removeEventListener("touchcancel", cleanup);
    };

    if (isTouch) {
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend",  cleanup);
      document.addEventListener("touchcancel", cleanup);
    } else {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup",   cleanup);
    }
  };

  li.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    begin(e.clientX, e.clientY, false);
  });
  li.addEventListener("touchstart", (e) => {
    const p = e.touches[0];
    if (!p) return;
    e.stopPropagation();
    begin(p.clientX, p.clientY, true);
  }, { passive: true });
}

function initMarquee() {
  const desktopEl = document.getElementById("desktop");

  const start = (clientX, clientY, additive, isTouch) => {
    const dRect = desktopEl.getBoundingClientRect();
    const x0 = clientX - dRect.left;
    const y0 = clientY - dRect.top;
    let dragged = false;
    let mq = null;

    const initiallySelected = new Set(
      [...desktopEl.querySelectorAll(".desktop-icon.selected")]
    );
    if (!additive) {
      desktopEl.querySelectorAll(".desktop-icon.selected")
        .forEach(n => n.classList.remove("selected"));
    }

    const move = (cx, cy, e) => {
      if (!dragged) {
        if (Math.abs(cx - clientX) < 2 && Math.abs(cy - clientY) < 2) return;
        dragged = true;
        mq = document.createElement("div");
        mq.className = "marquee";
        desktopEl.appendChild(mq);
      }
      if (e && e.cancelable) e.preventDefault();
      const x1 = cx - dRect.left;
      const y1 = cy - dRect.top;
      const left = Math.min(x0, x1);
      const top  = Math.min(y0, y1);
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      mq.style.left   = left + "px";
      mq.style.top    = top  + "px";
      mq.style.width  = w    + "px";
      mq.style.height = h    + "px";
      const right = left + w, bottom = top + h;
      desktopEl.querySelectorAll(".desktop-icon").forEach(icon => {
        const r = icon.getBoundingClientRect();
        const iL = r.left  - dRect.left;
        const iT = r.top   - dRect.top;
        const iR = r.right - dRect.left;
        const iB = r.bottom - dRect.top;
        const inMq = !(iR < left || iL > right || iB < top || iT > bottom);
        if (additive) {
          icon.classList.toggle("selected", initiallySelected.has(icon) || inMq);
        } else {
          icon.classList.toggle("selected", inMq);
        }
      });
    };

    const onMouseMove = (e) => move(e.clientX, e.clientY, e);
    const onTouchMove = (e) => {
      const p = e.touches[0] || e.changedTouches[0];
      if (p) move(p.clientX, p.clientY, e);
    };
    const cleanup = () => {
      if (mq) mq.remove();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   cleanup);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  cleanup);
      document.removeEventListener("touchcancel", cleanup);
    };

    if (isTouch) {
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend",  cleanup);
      document.addEventListener("touchcancel", cleanup);
    } else {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup",   cleanup);
    }
  };

  // Mouse
  desktopEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".desktop-icon")) return;
    if (e.target.closest(".window")) return;
    if (e.target.closest(".taskbar")) return;
    start(e.clientX, e.clientY, e.shiftKey, false);
  });

  // Touch
  desktopEl.addEventListener("touchstart", (e) => {
    if (e.target.closest(".desktop-icon")) return;
    if (e.target.closest(".window")) return;
    if (e.target.closest(".taskbar")) return;
    const p = e.touches[0];
    if (!p) return;
    start(p.clientX, p.clientY, false, true);
  }, { passive: true });
}

function makeIcon({ name, iconHtml, open }) {
  const li = document.createElement("li");
  li.className = "desktop-icon";
  li.tabIndex = 0;

  const ic = document.createElement("div");
  ic.className = "icon-img";
  if (iconHtml) ic.innerHTML = iconHtml;
  const lbl = document.createElement("div");
  lbl.className = "icon-label";
  lbl.textContent = name;
  li.appendChild(ic);
  li.appendChild(lbl);

  // Classic Win98: single click selects, double click opens. Same on every device.
  li.addEventListener("dblclick", () => {
    if (li.dataset.justDragged === "1") return;
    open();
  });
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  li.addEventListener("click", (e) => {
    if (li.dataset.justDragged === "1") return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle selection without clearing others
      li.classList.toggle("selected");
    } else {
      document.querySelectorAll(".desktop-icon.selected").forEach(n => n.classList.remove("selected"));
      li.classList.add("selected");
    }
  });
  return li;
}

function initStartMenu() {
  const btn = document.getElementById("start-btn");
  const menu = document.getElementById("start-menu");

  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) setOpen(false);
  });
  menu.addEventListener("click", (e) => {
    const li = e.target.closest("[data-program]");
    if (!li) return;
    const prog = li.dataset.program;
    setOpen(false);
    openProgram(prog);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

function initClock() {
  const el = document.getElementById("clock");
  const tick = () => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    el.textContent = (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  };
  tick();
  setInterval(tick, 30 * 1000);
}
