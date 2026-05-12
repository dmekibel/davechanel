// Heaven OS — Win98 cascading start menu.
// Top-level entries can be programs or submenus; submenus open to the right
// on hover and can themselves contain submenus.

import { ICONS, iconFor } from "./icons.js";
import { openProgram, openFile } from "./programs.js";
import { findByPath } from "./file-system.js";
import { t } from "./i18n.js";

const ARROW = `▶`;

const TREE = [
  { type: "item", program: "explorer",  label: "My Computer",       icon: ICONS.myComputer(16) },
  "sep",
  {
    type: "submenu", label: "Programs", icon: ICONS.folder(16),
    children: [
      { type: "item", program: "about",    label: "About Me",         icon: ICONS.notepad(16) },
      { type: "item", program: "showreel", label: "Showreel",         icon: ICONS.movie(16)   },
      { type: "item", program: "contact",  label: "Contact",          icon: ICONS.mail(16)    },
      "sep",
      {
        type: "submenu", label: "Accessories", icon: ICONS.folder(16),
        children: [
          { type: "item", program: "welcome",  label: "Welcome",   icon: ICONS.notepad(16) },
          { type: "item", program: "sleep",    label: "Screensaver", icon: ICONS.movie(16) },
        ],
      },
    ],
  },
  {
    type: "submenu", label: "Documents", icon: ICONS.folder(16),
    children: [
      { type: "item", program: "fine-art", label: "Fine Art",          icon: ICONS.picture(16)   },
      { type: "item", program: "balance",  label: "Balancē Creative",  icon: ICONS.briefcase(16) },
      { type: "item", program: "about",    label: "About Me.txt",      icon: ICONS.notepad(16)   },
    ],
  },
  {
    type: "submenu", label: "Settings", icon: ICONS.gear(16),
    children: [
      { type: "item", program: "settings",      label: "Display Properties...", icon: ICONS.myComputer(16) },
      { type: "item", program: "control-panel", label: "Control Panel",         icon: ICONS.gear(16) },
    ],
  },
  { type: "item", program: "find",      label: "Find...",       icon: ICONS.search(16) },
  { type: "item", program: "help",      label: "Help",          icon: ICONS.help(16)   },
  { type: "item", program: "run",       label: "Run...",        icon: ICONS.run(16)    },
  "sep",
  { type: "item", program: "sleep",     label: "Sleep",         icon: ICONS.movie(16)    },
  { type: "item", program: "logout",    label: "Log Out",       icon: ICONS.logout(16)   },
  { type: "item", program: "restart",   label: "Restart",       icon: ICONS.restart(16)  },
];

const openMenus = [];        // stack of open menu DOM nodes
let menuTimer = null;

export function buildStartMenu(rootEl) {
  rootEl.innerHTML = "";
  rootEl.appendChild(makeMenuList(TREE, /* depth */ 0));
}

function makeMenuList(items, depth) {
  const ul = document.createElement("ul");
  ul.className = "start-menu-items" + (depth > 0 ? " cascade" : "");
  for (const it of items) {
    if (it === "sep") {
      const li = document.createElement("li");
      li.className = "sep";
      li.setAttribute("role", "separator");
      ul.appendChild(li);
      continue;
    }
    const li = document.createElement("li");
    li.setAttribute("role", "menuitem");
    li.classList.add("sm-row");
    if (it.children) li.classList.add("has-children");

    const ic = document.createElement("span");
    ic.className = "sm-ic";
    if (it.icon) ic.innerHTML = it.icon;
    li.appendChild(ic);

    const lbl = document.createElement("span");
    lbl.className = "sm-lbl";
    lbl.textContent = t(it.label);
    li.appendChild(lbl);

    if (it.children) {
      const arrow = document.createElement("span");
      arrow.className = "sm-arrow";
      arrow.textContent = ARROW;
      li.appendChild(arrow);

      // Open submenu on hover (and on click for touch)
      const open = () => {
        clearTimeout(menuTimer);
        // close any peer submenus at this depth + below
        closeMenusFromDepth(depth + 1);
        const sub = makeMenuList(it.children, depth + 1);
        const wrap = document.createElement("nav");
        wrap.className = "start-menu cascade";
        wrap.dataset.depth = String(depth + 1);
        wrap.appendChild(sub);
        document.body.appendChild(wrap);
        const r = li.getBoundingClientRect();
        // Position to the right of the parent item, aligned with its top
        const subW = wrap.offsetWidth;
        let left = r.right - 2;
        if (left + subW > window.innerWidth) left = r.left - subW + 2;
        wrap.style.left = left + "px";
        wrap.style.top  = (r.top - 2) + "px";
        openMenus.push({ depth: depth + 1, el: wrap, parentLi: li });
      };

      li.addEventListener("mouseenter", () => {
        clearTimeout(menuTimer);
        open();
      });
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!openMenus.find(m => m.parentLi === li)) open();
      });
      li.addEventListener("mouseleave", () => {
        // small delay so the user can move into the submenu
        clearTimeout(menuTimer);
        menuTimer = setTimeout(() => {
          // if the cursor is inside any open menu element, keep them
          const hovered = openMenus.some(m => m.el.matches(":hover")) || li.matches(":hover");
          if (!hovered) closeMenusFromDepth(depth + 1);
        }, 220);
      });
    } else {
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllStartMenus();
        if (it.program) openProgram(it.program);
      });
    }
    ul.appendChild(li);
  }
  return ul;
}

function closeMenusFromDepth(d) {
  for (let i = openMenus.length - 1; i >= 0; i--) {
    if (openMenus[i].depth >= d) {
      openMenus[i].el.remove();
      openMenus.splice(i, 1);
    }
  }
}

export function closeAllStartMenus() {
  closeMenusFromDepth(1);
  // top-level start menu hidden by desktop.js
}
