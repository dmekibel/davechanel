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
  renderDesktopIcons();
  initStartMenu();
  initClock();
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

  // click on empty desktop deselects
  document.getElementById("desktop").addEventListener("click", (e) => {
    if (e.target.id === "desktop" || e.target.id === "desktop-icons" || e.target.id === "windows-root") {
      document.querySelectorAll(".desktop-icon.selected").forEach(n => n.classList.remove("selected"));
    }
  });
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
