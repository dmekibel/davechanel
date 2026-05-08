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

function renderDesktopIcons() {
  const ul = document.getElementById("desktop-icons");
  ul.innerHTML = "";

  // Heaven OS shortcut first
  for (const sc of DESKTOP_SHORTCUTS) {
    ul.appendChild(makeIcon({
      name: sc.name,
      iconHtml: sc.iconHtml,
      open: () => openProgram(sc.program),
    }));
  }

  // Then file-system shortcuts
  for (const item of rootDesktopItems()) {
    ul.appendChild(makeIcon({
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
    }));
  }
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

  li.addEventListener("dblclick", open);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  li.addEventListener("click", () => {
    document.querySelectorAll(".desktop-icon.selected").forEach(n => n.classList.remove("selected"));
    li.classList.add("selected");
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
