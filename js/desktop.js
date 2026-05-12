// Heaven OS — desktop init: icons, start menu, clock

import { rootDesktopItems } from "./file-system.js";
import { openProgram, openFile } from "./programs.js";
import { ICONS, iconFor } from "./icons.js";
import { buildStartMenu, closeAllStartMenus } from "./start-menu.js";
import { showContextMenu, closeContextMenu } from "./context-menu.js";
import { t } from "./i18n.js";
import { currentZoom } from "./scale.js";

const PROG_FOR = {
  "Fine Art": "fine-art",
  "Balancē Creative": "balance",
  "Recycle Bin": "recycle",
};

// Synthetic desktop shortcuts that don't live in the FS but appear on the desktop.
// Image Viewer is intentionally NOT a desktop shortcut — it opens automatically
// when you tap an image file inside My Computer.
const DESKTOP_SHORTCUTS = [
  { name: "My Computer", iconHtml: ICONS.myComputer(32),  program: "explorer"    },
  { name: "Paint",       iconHtml: ICONS.paint(32),       program: "paint"       },
  { name: "Minesweeper", iconHtml: ICONS.minesweeper(32), program: "minesweeper" },
];

export function initDesktop() {
  document.title = "David Mekibel";
  renderDesktopIcons();
  initStartMenu();
  initClock();
  initMarquee();
  initReflow();

  // Live language switching — re-render anything that displays translated
  // text without a full page reload.
  window.addEventListener("languagechange", () => {
    renderDesktopIcons();
    const menuEl = document.getElementById("start-menu");
    if (menuEl) buildStartMenu(menuEl);
  });
}

// Re-lay-out the desktop icon grid only when the viewport ORIENTATION
// changes — not on every resize tick (mobile Chrome fires resize on
// address-bar collapse / keyboard show, which would cause flickery
// re-renders that look like the page is zooming).
function initReflow() {
  let timer = null;
  const portraitMql = window.matchMedia("(orientation: portrait)");
  let last = portraitMql.matches ? "p" : "l";
  const reflow = () => {
    const cur = portraitMql.matches ? "p" : "l";
    if (cur === last) return;
    last = cur;
    clearTimeout(timer);
    timer = setTimeout(() => renderDesktopIcons(), 220);
  };
  if (portraitMql.addEventListener) portraitMql.addEventListener("change", reflow);
  else if (portraitMql.addListener) portraitMql.addListener(reflow);
  window.addEventListener("orientationchange", reflow);
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

  // On touch devices (any orientation), always use the computed default
  // grid — saved positions from one orientation/viewport don't translate
  // to another. Only fine-pointer (mouse) devices get persisted positions.
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const saved = isTouch ? {} : loadIconPositions();
  const all = [
    ...DESKTOP_SHORTCUTS.map(sc => ({
      name: t(sc.name),
      iconHtml: sc.iconHtml,
      open: () => openProgram(sc.program),
    })),
    ...rootDesktopItems().map(item => ({
      name: t(item.name),
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
  // Items-per-column adapts to viewport height so icons never overflow
  // bottom (or, on landscape mobile, fall under the taskbar).
  const desktopEl = document.getElementById("desktop");
  const dW = desktopEl?.clientWidth  || window.innerWidth;
  const dH = desktopEl?.clientHeight || (window.innerHeight - 30);
  const cellW = gridCellWidth();
  const cellH = gridCellHeight();
  const ICON_W = cellW - 12;
  const ICON_H = cellH - 12;
  const maxX = Math.max(GRID_X0, dW - ICON_W - GRID_X0);
  const maxY = Math.max(GRID_Y0, dH - ICON_H - GRID_Y0);
  const itemsPerCol = Math.max(2, Math.floor((dH - GRID_Y0 * 2) / cellH));

  for (let i = 0; i < all.length; i++) {
    const meta = all[i];
    const li = makeIcon({ name: meta.name, iconHtml: meta.iconHtml, open: meta.open });
    const pos = saved[meta.name];
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    let x = pos ? pos[0] : GRID_X0 + col * cellW;
    let y = pos ? pos[1] : GRID_Y0 + row * cellH;
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
// On a touch device with a short viewport (landscape phone), shrink rows.
function gridCellHeight() {
  return (matchMedia("(pointer: coarse)").matches && window.innerHeight < 500) ? 64 : CELL_H;
}
function gridCellWidth() {
  return (matchMedia("(pointer: coarse)").matches && window.innerHeight < 500) ? 80 : CELL_W;
}

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
      // Pointer deltas arrive post-zoom; convert to body-internal px so
      // we can math against offsetLeft/Top (which are pre-zoom).
      const z = currentZoom();
      const dx = (cx - clientX) / z;
      const dy = (cy - clientY) / z;
      if (!dragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragged = true;
      if (e && e.cancelable) e.preventDefault();
      const dW = desktop.clientWidth, dH = desktop.clientHeight;
      for (const sp of startPositions) {
        sp.el.classList.add("dragging");
        const w = sp.el.offsetWidth, h = sp.el.offsetHeight;
        const nx = Math.max(0, Math.min(dW - w, sp.x + dx));
        const ny = Math.max(0, Math.min(dH - h, sp.y + dy));
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
        const dW = desktop.clientWidth, dH = desktop.clientHeight;
        for (const sp of startPositions) {
          const [sx, sy] = snapToGrid(sp.el.offsetLeft, sp.el.offsetTop);
          const w = sp.el.offsetWidth, h = sp.el.offsetHeight;
          const fx = Math.max(0, Math.min(dW - w, sx));
          const fy = Math.max(0, Math.min(dH - h, sy));
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
  let lastEmptyTap = 0;   // for desktop empty-area double-click → context menu
  let lastTouchAt = 0;    // suppress synthesized mouse events after touch

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
      // Work entirely in BODY-INTERNAL coords. Pointer deltas arrive post-
      // zoom; offsetLeft/Top/Width/Height are always pre-zoom. Mixing the
      // two (as we did before) was wrong on iOS WebKit where rect & offset
      // can disagree.
      const z = currentZoom();
      const xb1 = (cx - dRect.left) / z;
      const yb1 = (cy - dRect.top)  / z;
      const xb0 = x0 / z;
      const yb0 = y0 / z;
      const left = Math.min(xb0, xb1);
      const top  = Math.min(yb0, yb1);
      const w = Math.abs(xb1 - xb0);
      const h = Math.abs(yb1 - yb0);
      mq.style.left   = left + "px";
      mq.style.top    = top  + "px";
      mq.style.width  = w    + "px";
      mq.style.height = h    + "px";
      const right = left + w, bottom = top + h;
      desktopEl.querySelectorAll(".desktop-icon").forEach(icon => {
        const iL = icon.offsetLeft;
        const iT = icon.offsetTop;
        const iR = iL + icon.offsetWidth;
        const iB = iT + icon.offsetHeight;
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
      const wasDrag = !!mq;
      if (mq) mq.remove();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   cleanup);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  cleanup);
      document.removeEventListener("touchcancel", cleanup);
      // Touch only: double-tap empty space = context menu (mouse uses
      // right-click for that). Single tap still just deselects.
      if (!wasDrag && isTouch) {
        const now = Date.now();
        if (now - lastEmptyTap < 500) {
          lastEmptyTap = 0;
          showDesktopContextMenu(clientX, clientY);
        } else {
          lastEmptyTap = now;
        }
      }
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

  // Mouse desktop: right-click opens the context menu (no dblclick path —
  // double-tap is reserved for touch devices).
  desktopEl.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".desktop-icon")) return;
    if (e.target.closest(".window")) return;
    if (e.target.closest(".taskbar")) return;
    e.preventDefault();
    showDesktopContextMenu(e.clientX, e.clientY);
  });

  // Mouse
  desktopEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    // Ignore mousedown that browsers synthesize ~50–700ms after touchend
    if (Date.now() - lastTouchAt < 800) return;
    if (e.target.closest(".desktop-icon")) return;
    if (e.target.closest(".window")) return;
    if (e.target.closest(".taskbar")) return;
    start(e.clientX, e.clientY, e.shiftKey, false);
  });

  // Touch
  desktopEl.addEventListener("touchstart", (e) => {
    lastTouchAt = Date.now();
    if (e.target.closest(".desktop-icon")) return;
    if (e.target.closest(".window")) return;
    if (e.target.closest(".taskbar")) return;
    const p = e.touches[0];
    if (!p) return;
    start(p.clientX, p.clientY, false, true);
  }, { passive: true });
  desktopEl.addEventListener("touchend", () => { lastTouchAt = Date.now(); }, { passive: true });
}

function showDesktopContextMenu(x, y) {
  showContextMenu(x, y, [
    { label: "Refresh",                action: () => renderDesktopIcons() },
    "sep",
    { label: "Arrange Icons by name",  action: () => {
        try { localStorage.removeItem("heaven-os.icon-positions"); } catch (_) {}
        renderDesktopIcons();
      } },
    "sep",
    { label: "Display Properties...",  action: () => openProgram("settings") },
    { label: "About this portfolio",   action: () => openProgram("welcome") },
  ]);
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
  // Touch: manual double-tap detection — dblclick is unreliable on mobile.
  let lastTap = 0;
  li.addEventListener("touchend", (e) => {
    if (li.dataset.justDragged === "1") return;
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      lastTap = 0;
      e.preventDefault();
      open();
    } else {
      lastTap = now;
    }
  });
  return li;
}

function initStartMenu() {
  const btn = document.getElementById("start-btn");
  const menu = document.getElementById("start-menu");

  buildStartMenu(menu);

  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (!open) closeAllStartMenus();
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (menu.contains(e.target)) return;
    if (e.target.closest(".start-menu.cascade")) return;
    if (e.target === btn || btn.contains(e.target)) return;
    setOpen(false);
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
