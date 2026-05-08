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

  // Default-grid positioning for icons that don't have a saved position yet.
  // Single column down the left edge, with a gentle wrap on tall stacks.
  const COL_W = 96;
  const ROW_H = 86;
  const PAD_X = 12;
  const PAD_Y = 12;
  for (let i = 0; i < all.length; i++) {
    const meta = all[i];
    const li = makeIcon({ name: meta.name, iconHtml: meta.iconHtml, open: meta.open });
    const pos = saved[meta.name];
    let x, y;
    if (pos) {
      [x, y] = pos;
    } else {
      const col = Math.floor(i / 6);
      const row = i % 6;
      x = PAD_X + col * COL_W;
      y = PAD_Y + row * ROW_H;
    }
    li.style.left = x + "px";
    li.style.top  = y + "px";
    makeIconDraggable(li);
    ul.appendChild(li);
  }
}

function makeIconDraggable(li) {
  const desktop = document.getElementById("desktop");
  let dragged, startX, startY, originX, originY;

  const begin = (clientX, clientY, isTouch) => {
    dragged = false;
    startX = clientX;
    startY = clientY;
    originX = li.offsetLeft;
    originY = li.offsetTop;

    const move = (cx, cy, e) => {
      const dx = cx - startX;
      const dy = cy - startY;
      if (!dragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragged = true;
      li.classList.add("dragging");
      if (e && e.cancelable) e.preventDefault();
      const dRect = desktop.getBoundingClientRect();
      const w = li.offsetWidth, h = li.offsetHeight;
      const nx = Math.max(0, Math.min(dRect.width  - w, originX + dx));
      const ny = Math.max(0, Math.min(dRect.height - h, originY + dy));
      li.style.left = nx + "px";
      li.style.top  = ny + "px";
    };
    const onMouseMove = (e) => move(e.clientX, e.clientY, e);
    const onTouchMove = (e) => {
      const p = e.touches[0] || e.changedTouches[0];
      if (p) move(p.clientX, p.clientY, e);
    };
    const cleanup = () => {
      li.classList.remove("dragging");
      if (dragged) {
        saveIconPosition(li.querySelector(".icon-label").textContent, li.offsetLeft, li.offsetTop);
        li.dataset.justDragged = "1";
        setTimeout(() => delete li.dataset.justDragged, 50);
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

  // touch / coarse-pointer devices: single-tap opens.
  // mouse / fine-pointer: single-click selects, double-click opens.
  const isCoarse = () => matchMedia("(pointer: coarse)").matches;

  li.addEventListener("dblclick", () => {
    if (li.dataset.justDragged === "1") return;
    open();
  });
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  li.addEventListener("click", () => {
    if (li.dataset.justDragged === "1") return;
    if (isCoarse()) {
      open();
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
