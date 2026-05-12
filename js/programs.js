// Heaven OS — programs
// Each program builds DOM content for a window. The window manager wraps it
// in chrome and handles drag/resize.

import { openWindow, closeWindow } from "./window-manager.js";
import { FS, findByPath } from "./file-system.js";
import { ICONS, iconFor } from "./icons.js";
import { startScreensaver } from "./screensaver.js";
import { WALLPAPERS, getWallpaper, setWallpaper } from "./wallpaper.js";
import { showContextMenu } from "./context-menu.js";
import { t } from "./i18n.js";

// ---- Notepad --------------------------------------------------------

async function loadText(file) {
  // Pick the language-appropriate body if available
  const lang = (typeof t === "function" && t("Sleep") !== "Sleep") ? "ru" : "en";
  const ruData = file.dataRu, ruSrc = file.srcRu;
  if (lang === "ru") {
    if (ruData != null) return ruData;
    if (ruSrc) {
      try {
        const r = await fetch(ruSrc);
        if (r.ok) return await r.text();
      } catch (_) {}
    }
  }
  if (file.data != null) return file.data;
  if (file.src) {
    try {
      const r = await fetch(file.src);
      if (r.ok) return await r.text();
    } catch (e) { /* fall through */ }
  }
  return "(empty)";
}

export async function openNotepad(file) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;height:100%;";

  const menu = document.createElement("div");
  menu.className = "window-menubar";
  for (const m of ["File", "Edit", "Search", "Help"]) {
    const span = document.createElement("span");
    span.className = "menu-item";
    span.textContent = m;
    menu.appendChild(span);
  }
  wrap.appendChild(menu);

  // Scrollable notepad body (this is what gets the Win98 scrollbar)
  const body = document.createElement("div");
  body.className = "notepad";
  body.style.flex = "1";
  body.style.overflow = "auto";
  body.style.minHeight = "0";
  const pre = document.createElement("pre");
  pre.textContent = await loadText(file);
  body.appendChild(pre);
  wrap.appendChild(body);

  return openWindow({
    title: t(file.name),
    icon: ICONS.notepad(14),
    iconHtml: true,
    content: wrap,
    width: 580,
    height: 480,
  });
}

// ---- Compose (Contact) ---------------------------------------------

export function openCompose() {
  const wrap = document.createElement("div");
  wrap.className = "compose";

  wrap.innerHTML = `
    <div class="header">
      <b>To:</b><span>David Mekibel</span>
      <b>Subject:</b><span>Let's talk</span>
    </div>
    <div class="body">
      <dl>
        <dt>Email</dt>          <dd><a href="mailto:dmekibel@gmail.com">dmekibel@gmail.com</a></dd>
        <dt>Instagram</dt>      <dd><a href="https://instagram.com/dalledave" target="_blank" rel="noopener">@dalledave</a> &nbsp;·&nbsp; <a href="https://instagram.com/mikdavidu" target="_blank" rel="noopener">@mikdavidu</a></dd>
        <dt>LinkedIn</dt>       <dd><a href="https://www.linkedin.com/in/david-mekibel" target="_blank" rel="noopener">linkedin.com/in/david-mekibel</a></dd>
        <dt>Studio</dt>         <dd><a href="https://balance-creative.com" target="_blank" rel="noopener">balance-creative.com</a></dd>
      </dl>
      <p style="margin-top:16px;color:#666;font-size:12px;">
        Based between Moscow and Israel. Fully remote.
      </p>
    </div>
  `;

  return openWindow({
    title: "Contact",
    icon: ICONS.mail(14),
    iconHtml: true,
    content: wrap,
    width: 520,
    height: 360,
  });
}

// ---- Media Player (Showreel) ---------------------------------------

export function openShowreel(file) {
  const wrap = document.createElement("div");
  wrap.className = "showreel";
  wrap.textContent = "▶  SHOWREEL — coming soon";
  return openWindow({
    title: t(file?.name || "Showreel.mpg"),
    icon: ICONS.movie(14),
    iconHtml: true,
    content: wrap,
    width: 640,
    height: 400,
  });
}

// ---- File Explorer (Win98) ------------------------------------------

export function openExplorer(startPath = []) {
  // History for Back / Forward
  const history = [[...startPath]];
  let histIdx = 0;
  const expanded = new Set(["Mekibel:"]);  // tree nodes that are expanded

  // Container
  const wrap = document.createElement("div");
  wrap.className = "explorer";

  // ---- Menu bar (functional dropdowns) -----------------------------
  const menubar = document.createElement("div");
  menubar.className = "exp-menubar";
  // Defer building items until after the main render functions exist
  // (we attach the menu defs below, since they reference goBack etc.).

  // ---- Toolbar ------------------------------------------------------
  const toolbar = document.createElement("div");
  toolbar.className = "exp-toolbar";

  const mkTool = (label, iconSvg, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "exp-tool";
    const ic = document.createElement("span");
    ic.className = "tool-ic";
    ic.innerHTML = iconSvg;
    b.appendChild(ic);
    const t = document.createElement("span");
    t.className = "tool-lbl";
    t.textContent = label;
    b.appendChild(t);
    b.addEventListener("click", onClick);
    return b;
  };

  const backBtn = mkTool("Back",    ICONS.arrowLeft(20),  () => goBack());
  const fwdBtn  = mkTool("Forward", ICONS.arrowRight(20), () => goForward());
  const upBtn   = mkTool("Up",      ICONS.arrowUp(20),    () => goUp());

  toolbar.appendChild(backBtn);
  toolbar.appendChild(fwdBtn);
  const sep1 = document.createElement("span"); sep1.className = "sep"; toolbar.appendChild(sep1);
  toolbar.appendChild(upBtn);

  // ---- Address bar --------------------------------------------------
  const addr = document.createElement("div");
  addr.className = "exp-address";
  const addrLabel = document.createElement("label");
  addrLabel.textContent = "Address:";
  const addrField = document.createElement("div");
  addrField.className = "field";
  addr.appendChild(addrLabel);
  addr.appendChild(addrField);

  // ---- Body (tree + pane) ------------------------------------------
  const body = document.createElement("div");
  body.className = "exp-body";

  const tree = document.createElement("div");
  tree.className = "exp-tree";

  const pane = document.createElement("div");
  pane.className = "exp-pane";
  const grid = document.createElement("div");
  grid.className = "exp-grid";
  pane.appendChild(grid);

  body.appendChild(tree);
  body.appendChild(pane);

  // ---- Status bar ---------------------------------------------------
  const status = document.createElement("div");
  status.className = "exp-statusbar";
  const sCount = document.createElement("span"); sCount.className = "panel"; status.appendChild(sCount);
  const sPath  = document.createElement("span"); sPath.className  = "panel flex"; status.appendChild(sPath);

  wrap.appendChild(menubar);
  wrap.appendChild(toolbar);
  wrap.appendChild(addr);
  wrap.appendChild(body);
  wrap.appendChild(status);

  // ---- State / navigation ------------------------------------------

  let currentPath = [...startPath];
  let winId = null;
  let currentView = "large";   // large | small | list

  function setView(view) {
    currentView = view;
    grid.className = "exp-grid view-" + view;
    render();
  }
  grid.classList.add("view-large");

  // ---- Marquee selection + tap-empty context menu (in the right pane) ----
  attachPaneMarquee(pane, grid, () => setView, () => currentView);

  function attachPaneMarquee(paneEl, gridEl, getSetView, getCurView) {
    let lastEmptyTap = 0;
    let lastTouchAt  = 0;   // suppress synthesized mouse events after touch
    const start = (clientX, clientY, isTouchEv) => {
      if (paneEl.scrollLeft || paneEl.scrollTop) { /* still proceed */ }
      const pRect = paneEl.getBoundingClientRect();
      const x0 = clientX - pRect.left + paneEl.scrollLeft;
      const y0 = clientY - pRect.top  + paneEl.scrollTop;
      let dragged = false;
      let mq = null;

      // Clear tile selection on tap-empty unless drag begins
      const initiallySelected = new Set([...paneEl.querySelectorAll(".exp-tile.selected")]);
      paneEl.querySelectorAll(".exp-tile.selected").forEach(n => n.classList.remove("selected"));

      const move = (cx, cy, e) => {
        const dx = cx - clientX;
        const dy = cy - clientY;
        if (!dragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        dragged = true;
        if (!mq) {
          mq = document.createElement("div");
          mq.className = "marquee";
          paneEl.appendChild(mq);
        }
        if (e && e.cancelable) e.preventDefault();
        const x1 = cx - pRect.left + paneEl.scrollLeft;
        const y1 = cy - pRect.top  + paneEl.scrollTop;
        const left = Math.min(x0, x1);
        const top  = Math.min(y0, y1);
        const w    = Math.abs(x1 - x0);
        const h    = Math.abs(y1 - y0);
        mq.style.left   = left + "px";
        mq.style.top    = top  + "px";
        mq.style.width  = w    + "px";
        mq.style.height = h    + "px";

        const right = left + w, bottom = top + h;
        paneEl.querySelectorAll(".exp-tile").forEach(tile => {
          const r = tile.getBoundingClientRect();
          const tL = r.left   - pRect.left + paneEl.scrollLeft;
          const tT = r.top    - pRect.top  + paneEl.scrollTop;
          const tR = r.right  - pRect.left + paneEl.scrollLeft;
          const tB = r.bottom - pRect.top  + paneEl.scrollTop;
          const inMq = !(tR < left || tL > right || tB < top || tT > bottom);
          tile.classList.toggle("selected", inMq);
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
        // DOUBLE tap on empty pane → context menu. Single tap just clears
        // selection (already done at start).
        if (!dragged) {
          const now = Date.now();
          if (now - lastEmptyTap < 500) {
            lastEmptyTap = 0;
            showExplorerContextMenu(clientX, clientY);
          } else {
            lastEmptyTap = now;
          }
        }
      };

      if (isTouchEv) {
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend",  cleanup);
        document.addEventListener("touchcancel", cleanup);
      } else {
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup",   cleanup);
      }
    };

    paneEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (Date.now() - lastTouchAt < 800) return;   // synthesized after touch, ignore
      if (e.target.closest(".exp-tile")) return;
      start(e.clientX, e.clientY, false);
    });
    paneEl.addEventListener("touchstart", (e) => {
      lastTouchAt = Date.now();
      if (e.target.closest(".exp-tile")) return;
      const p = e.touches[0];
      if (!p) return;
      start(p.clientX, p.clientY, true);
    }, { passive: true });
    paneEl.addEventListener("touchend", () => { lastTouchAt = Date.now(); }, { passive: true });
    paneEl.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".exp-tile")) return;
      e.preventDefault();
      showExplorerContextMenu(e.clientX, e.clientY);
    });
    paneEl.addEventListener("dblclick", (e) => {
      if (e.target.closest(".exp-tile")) return;
      showExplorerContextMenu(e.clientX, e.clientY);
    });
  }

  function showExplorerContextMenu(x, y) {
    showContextMenu(x, y, [
      { label: "Refresh",            action: () => render() },
      "sep",
      { label: "View — Large Icons", action: () => setView("large") },
      { label: "View — Small Icons", action: () => setView("small") },
      { label: "View — List",        action: () => setView("list") },
      "sep",
      { label: "Display Properties...", action: () => openSettings() },
    ]);
  }

  function pathKey(path) {
    return ["Mekibel:", ...path].join("/");
  }

  function pushHistory(path) {
    history.length = histIdx + 1;
    history.push([...path]);
    histIdx = history.length - 1;
  }

  function goBack() {
    if (histIdx <= 0) return;
    histIdx -= 1;
    currentPath = [...history[histIdx]];
    render();
  }
  function goForward() {
    if (histIdx >= history.length - 1) return;
    histIdx += 1;
    currentPath = [...history[histIdx]];
    render();
  }
  function goUp() {
    if (currentPath.length === 0) return;
    navigateTo(currentPath.slice(0, -1));
  }
  function navigateTo(path) {
    const node = findByPath(path);
    if (!node) return;
    if (node.type === "file") {
      openFile(node);
      return;
    }
    currentPath = [...path];
    pushHistory(currentPath);
    // ensure ancestors are expanded
    let acc = "Mekibel:";
    expanded.add(acc);
    for (const seg of currentPath) {
      acc += "/" + seg;
      expanded.add(acc);
    }
    render();
  }

  // ---- Tree rendering ----------------------------------------------

  function renderTree() {
    tree.innerHTML = "";
    const ul = document.createElement("ul");
    ul.appendChild(treeRow(FS, [], 0));
    if (expanded.has("Mekibel:")) {
      const childrenUl = document.createElement("ul");
      for (const child of FS.children) {
        renderTreeNode(child, [child.name], 1, childrenUl);
      }
      ul.appendChild(childrenUl);
    }
    tree.appendChild(ul);
  }

  function renderTreeNode(node, path, depth, container) {
    container.appendChild(treeRow(node, path, depth));
    if (node.type === "folder" && expanded.has(pathKey(path)) && node.children?.length) {
      const sub = document.createElement("ul");
      for (const child of node.children) {
        renderTreeNode(child, [...path, child.name], depth + 1, sub);
      }
      container.appendChild(sub);
    }
  }

  function treeRow(node, path, depth) {
    const li = document.createElement("li");
    li.className = "row";
    if (path.length === currentPath.length && path.every((p, i) => p === currentPath[i]) && node.type === "folder") {
      li.classList.add("selected");
    }
    li.style.paddingLeft = (depth * 14) + "px";

    // twisty
    const tw = document.createElement("span");
    tw.className = "twisty";
    if (node.type === "folder" && node.children?.length) {
      const key = node === FS ? "Mekibel:" : pathKey(path);
      const isOpen = expanded.has(key);
      tw.innerHTML = `<span class="twisty-box">${isOpen ? "−" : "+"}</span>`;
      tw.addEventListener("click", (e) => {
        e.stopPropagation();
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        renderTree();
      });
    }
    li.appendChild(tw);

    // icon + label
    const ic = document.createElement("span");
    ic.className = "icon";
    if (node === FS) {
      ic.innerHTML = ICONS.myComputer(16);
    } else {
      ic.innerHTML = iconFor(node, 16);
    }
    li.appendChild(ic);
    const lbl = document.createElement("span");
    lbl.className = "tree-label";
    lbl.textContent = node === FS ? "Mekibel" : t(node.name);
    li.appendChild(lbl);

    li.addEventListener("click", () => {
      if (node === FS) { navigateTo([]); return; }
      if (node.type === "folder") navigateTo(path);
      else if (node.type === "file") openFile(node);   // single-click opens files in the tree
    });
    li.addEventListener("dblclick", () => {
      if (node === FS) return;
      if (node.type === "file") openFile(node);
    });
    // Touch double-tap fallback (covers older iOS where dblclick is flaky)
    let lastTap = 0;
    li.addEventListener("touchend", (e) => {
      if (e.changedTouches.length !== 1) return;
      const now = Date.now();
      if (now - lastTap < 350) {
        lastTap = 0;
        if (node === FS) navigateTo([]);
        else if (node.type === "folder") navigateTo(path);
        else openFile(node);
      } else {
        lastTap = now;
      }
    });
    return li;
  }

  // ---- Pane rendering ----------------------------------------------

  function render() {
    const node = findByPath(currentPath) || FS;
    const titleName = currentPath.length ? currentPath[currentPath.length - 1] : "Mekibel";

    // address
    addrField.innerHTML = "";
    const ic = document.createElement("span");
    ic.className = "icon";
    ic.innerHTML = currentPath.length === 0 ? ICONS.myComputer(16) : iconFor(node, 16);
    addrField.appendChild(ic);
    const txt = document.createElement("span");
    txt.textContent = "Mekibel:" + (currentPath.length ? "\\" + currentPath.join("\\") : "");
    addrField.appendChild(txt);

    // toolbar enable/disable
    backBtn.toggleAttribute("disabled", histIdx <= 0);
    fwdBtn.toggleAttribute("disabled", histIdx >= history.length - 1);
    upBtn.toggleAttribute("disabled", currentPath.length === 0);

    // grid
    grid.innerHTML = "";
    const items = node.children || [];
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "exp-empty";
      empty.textContent = "(this folder is empty)";
      grid.appendChild(empty);
    } else {
      for (const child of items) {
        const tile = document.createElement("div");
        tile.className = "exp-tile";
        tile.tabIndex = 0;
        const tIc = document.createElement("div");
        tIc.className = "ic";
        tIc.innerHTML = iconFor(child, 32);
        const tLbl = document.createElement("div");
        tLbl.className = "lbl";
        tLbl.textContent = t(child.name);
        tile.appendChild(tIc);
        tile.appendChild(tLbl);

        const open = () => {
          if (child.type === "folder") navigateTo([...currentPath, child.name]);
          else openFile(child);
        };
        const select = () => {
          grid.querySelectorAll(".exp-tile.selected").forEach(n => n.classList.remove("selected"));
          tile.classList.add("selected");
        };
        tile.addEventListener("click", select);
        tile.addEventListener("dblclick", open);
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        });
        // Touch: manual double-tap detection (dblclick is unreliable on mobile)
        let lastTap = 0;
        tile.addEventListener("touchend", (e) => {
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
        grid.appendChild(tile);
      }
    }

    // status
    sCount.textContent = `${items.length} object(s)`;
    sPath.textContent  = "Mekibel:" + (currentPath.length ? "\\" + currentPath.join("\\") : "");

    // tree
    renderTree();

    // window title
    if (winId != null) {
      const wEl = document.querySelector(`[data-win-id="${winId}"]`);
      if (wEl) {
        const titleSpan = wEl.querySelector(".window-title span:last-child");
        if (titleSpan) titleSpan.textContent = titleName;
        wEl.setAttribute("aria-label", titleName);
      }
    }
  }

  // ---- Build the menu bar (now that render/goBack/etc are defined) ----
  buildMenuBar();

  function buildMenuBar() {
    menubar.innerHTML = "";
    const labelDefs = [
      ["File", "F"], ["Edit", "E"], ["View", "V"], ["Go", "G"],
      ["Favorites", "a"], ["Tools", "T"], ["Help", "H"],
    ];
    const menus = {
      "File": [
        { label: "Open", disabled: true, accel: "O" },
        "sep",
        { label: "Close", action: () => { if (winId != null) closeWindow(winId); }, accel: "C" },
      ],
      "Edit": [
        { label: "Undo", disabled: true },
        "sep",
        { label: "Cut", disabled: true },
        { label: "Copy", disabled: true },
        { label: "Paste", disabled: true },
        "sep",
        { label: "Select All", action: selectAllTiles, accel: "A" },
        { label: "Invert Selection", disabled: true },
      ],
      "View": [
        { label: "Refresh", action: render, accel: "R" },
        "sep",
        { label: "Large Icons", action: () => setView("large"), accel: "L" },
        { label: "Small Icons", action: () => setView("small"), accel: "m" },
        { label: "List",        action: () => setView("list"),  accel: "L" },
        { label: "Details",     disabled: true },
      ],
      "Go": [
        { label: "Back",         action: goBack, accel: "B", disabledIf: () => histIdx <= 0 },
        { label: "Forward",      action: goForward, accel: "F", disabledIf: () => histIdx >= history.length - 1 },
        { label: "Up One Level", action: goUp, accel: "U", disabledIf: () => currentPath.length === 0 },
        "sep",
        { label: "Home",         action: () => navigateTo([]), accel: "H" },
      ],
      "Favorites": [
        { label: "Add to Favorites", disabled: true },
      ],
      "Tools": [
        { label: "Folder Options", disabled: true },
      ],
      "Help": [
        { label: "About this portfolio", action: openAbout, accel: "A" },
      ],
    };
    for (const [label, accel] of labelDefs) {
      const item = document.createElement("span");
      item.className = "menu-item";
      item.dataset.menu = label;
      const ti = label.indexOf(accel);
      const tLbl = t(label);
      const acc = label[ti];
      const ai = tLbl.indexOf(acc);
      if (ai >= 0) {
        item.innerHTML = tLbl.slice(0, ai) + `<u>${tLbl[ai]}</u>` + tLbl.slice(ai + 1);
      } else {
        item.textContent = tLbl;
      }
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.classList.contains("open")) { closeAllDropdowns(); return; }
        openDropdown(item, menus[label]);
      });
      menubar.appendChild(item);
    }
  }

  function selectAllTiles() {
    grid.querySelectorAll(".exp-tile").forEach(n => n.classList.add("selected"));
  }
  function openAbout() {
    const div = document.createElement("div");
    div.style.cssText = "padding:18px 22px;font-family:Tahoma,sans-serif;font-size:12px;line-height:1.5;color:#000;background:#fff;";
    div.innerHTML = `
      <div style="font-family:'VT323',monospace;font-size:32px;margin-bottom:8px;color:#00007f;">Mekibel</div>
      <p>A retro-styled portfolio of <b>David Mekibel</b>.</p>
      <p>Russian-Israeli artist. Co-founder of Balancē Creative.</p>
      <p style="margin-top:18px;color:#666;">2026</p>
    `;
    openWindow({ title: t("About this portfolio"), icon: ICONS.myComputer(14), iconHtml: true, content: div, width: 380, height: 280 });
  }

  function openDropdown(anchorEl, items) {
    closeAllDropdowns();
    anchorEl.classList.add("open");
    const rect = anchorEl.getBoundingClientRect();
    const dd = document.createElement("div");
    dd.className = "menu-dropdown";
    dd.style.left = rect.left + "px";
    dd.style.top  = rect.bottom + "px";
    for (const it of items) {
      if (it === "sep") {
        const s = document.createElement("div");
        s.className = "sep";
        dd.appendChild(s);
        continue;
      }
      const isDisabled = it.disabled || (it.disabledIf && it.disabledIf());
      const row = document.createElement("div");
      row.className = "item" + (isDisabled ? " disabled" : "");
      const lbl = t(it.label);
      if (it.accel) {
        const ai = lbl.indexOf(it.accel);
        if (ai >= 0) {
          row.innerHTML = lbl.slice(0, ai) + `<u>${lbl[ai]}</u>` + lbl.slice(ai + 1);
        } else {
          row.textContent = lbl;
        }
      } else {
        row.textContent = lbl;
      }
      if (!isDisabled && it.action) {
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAllDropdowns();
          it.action();
        });
      }
      dd.appendChild(row);
    }
    document.body.appendChild(dd);

    const closer = (e) => {
      if (!dd.contains(e.target) && e.target !== anchorEl) {
        closeAllDropdowns();
        document.removeEventListener("mousedown", closer);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closer), 0);
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".menu-dropdown").forEach(n => n.remove());
    document.querySelectorAll(".exp-menubar .menu-item.open").forEach(n => n.classList.remove("open"));
  }

  render();

  const initialTitle = currentPath.length ? t(currentPath[currentPath.length - 1]) : "Mekibel";
  winId = openWindow({
    title: initialTitle,
    icon: currentPath.length === 0 ? ICONS.myComputer(14) : iconFor(findByPath(currentPath), 14),
    iconHtml: true,
    content: wrap,
    width: 760,
    height: 480,
    flush: true,
  });
  // tag the window so we can find it later for title updates
  const wEl = [...document.querySelectorAll(".window")].find(el => el.getAttribute("aria-label") === (currentPath.length ? currentPath[currentPath.length - 1] : "Mekibel"));
  if (wEl) wEl.dataset.winId = String(winId);
  return winId;
}

// ---- Generic file opener -------------------------------------------

export function openFile(file) {
  switch (file.kind) {
    case "notepad": return openNotepad(file);
    case "compose": return openCompose();
    case "media":   return openShowreel(file);
    case "html":    return openNotepad(file);
    default:        return openNotepad(file);
  }
}

// ---- Public API: open by program id (used by desktop icons + start menu)

export function openProgram(progId) {
  switch (progId) {
    case "fine-art":     return openExplorer(["Fine Art"]);
    case "balance":      return openExplorer(["Balancē Creative"]);
    case "about":        return openNotepad(findByPath(["About Me.txt"]));
    case "showreel":     return openShowreel(findByPath(["Showreel.mpg"]));
    case "contact":      return openCompose();
    case "recycle":      return openExplorer(["Recycle Bin"]);
    case "explorer":     return openExplorer([]);
    case "logout":       return logout();
    case "restart":      return restart();
    case "sleep":        return startScreensaver();
    case "welcome":      return openWelcome();
    case "settings":     return openSettings();
    case "control-panel":return openSettings();
    case "find":         return openStub("Find Files",  "Find / search isn't wired up yet.");
    case "help":         return openStub("Help", "Help system isn't wired up yet. Check the file explorer for now.");
    case "run":          return openStub("Run", "There's nothing to run. This isn't a real OS.");
    default:             return null;
  }
}

function openStub(title, message) {
  const div = document.createElement("div");
  div.style.cssText = "padding:18px 22px;font-family:Tahoma,sans-serif;font-size:12px;line-height:1.45;color:#000;background:#fff;height:100%;";
  div.innerHTML = `<p>${message}</p>`;
  return openWindow({ title, icon: ICONS.notepad(14), iconHtml: true, content: div, width: 360, height: 200 });
}

// Win98-styled combobox to replace the native <select> (which renders as
// the OS-native picker on iOS / Android, breaking the retro look).
function makeWin98Select(options, initial, onChange, opts = {}) {
  const root = document.createElement("div");
  root.className = "ws-select" + (opts.disabled ? " disabled" : "");
  root.tabIndex = opts.disabled ? -1 : 0;
  let current = options.find(o => o.value === initial) || options[0];

  const valueEl = document.createElement("span");
  valueEl.className = "ws-value";
  valueEl.textContent = current.label;

  const arrow = document.createElement("button");
  arrow.type = "button";
  arrow.className = "ws-arrow";
  arrow.tabIndex = -1;
  arrow.innerHTML = `<span aria-hidden="true">▼</span>`;
  if (opts.disabled) arrow.disabled = true;

  const listEl = document.createElement("ul");
  listEl.className = "ws-options";
  listEl.hidden = true;
  for (const o of options) {
    const li = document.createElement("li");
    li.dataset.value = o.value;
    li.textContent = o.label;
    if (o.value === current.value) li.classList.add("selected");
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      current = o;
      valueEl.textContent = o.label;
      listEl.querySelectorAll("li.selected").forEach(n => n.classList.remove("selected"));
      li.classList.add("selected");
      close();
      onChange(o.value);
    });
    listEl.appendChild(li);
  }

  root.appendChild(valueEl);
  root.appendChild(arrow);
  root.appendChild(listEl);

  function open() {
    if (opts.disabled) return;
    listEl.hidden = false;
    setTimeout(() => document.addEventListener("click", outsideClose), 0);
  }
  function close() {
    listEl.hidden = true;
    document.removeEventListener("click", outsideClose);
  }
  function outsideClose(e) {
    if (!root.contains(e.target)) close();
  }
  const toggle = (e) => {
    e.stopPropagation();
    if (listEl.hidden) open();
    else close();
  };
  valueEl.addEventListener("click", toggle);
  arrow.addEventListener("click", toggle);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(e); }
    if (e.key === "Escape") close();
  });

  return root;
}

export function openWelcome() {
  // 4 short pages, each with EN + RU body.
  const PAGES_EN = [
    {
      title: "Welcome",
      body: `
        <p>Welcome to the portfolio of <b>David Mekibel</b>.</p>
        <p>Sit back and relax as you take a brief tour of the options available on this screen.</p>
        <p>If you want to explore an option, just click it.</p>
      `,
    },
    {
      title: "Discover My Work",
      body: `
        <p>Open <b>Fine Art</b> for my artistic practice (ArtPrize 2024 + 2025 finalist).</p>
        <p>Open <b>Balancē Creative</b> for commercial work — brands, music, AI/3D pipelines.</p>
      `,
    },
    {
      title: "Get In Touch",
      body: `
        <p><a href="mailto:dmekibel@gmail.com">dmekibel@gmail.com</a></p>
        <p><a href="https://www.linkedin.com/in/david-mekibel" target="_blank" rel="noopener">linkedin.com/in/david-mekibel</a></p>
        <p><a href="https://instagram.com/dalledave" target="_blank" rel="noopener">@dalledave</a></p>
      `,
    },
    {
      title: "Tips",
      body: `
        <p>Drag windows by the titlebar. Drag icons to rearrange.</p>
        <p>Try <b>Start &gt; Settings</b> to change the wallpaper, or <b>Start &gt; Sleep</b> for the screensaver.</p>
      `,
    },
  ];
  const PAGES_RU = [
    {
      title: "Добро пожаловать",
      body: `
        <p>Добро пожаловать на сайт <b>Давида Мекибеля</b>.</p>
        <p>Расслабьтесь и пройдите краткий тур по разделам этого сайта.</p>
        <p>Чтобы открыть раздел, просто нажмите на него.</p>
      `,
    },
    {
      title: "Мои работы",
      body: `
        <p>Откройте <b>Изобразительное искусство</b> — финалист ArtPrize 2024 + 2025.</p>
        <p>Откройте <b>Balancē Creative</b> — коммерческие проекты: бренды, музыка, AI/3D-пайплайны.</p>
      `,
    },
    {
      title: "Контакты",
      body: `
        <p><a href="mailto:dmekibel@gmail.com">dmekibel@gmail.com</a></p>
        <p><a href="https://www.linkedin.com/in/david-mekibel" target="_blank" rel="noopener">linkedin.com/in/david-mekibel</a></p>
        <p><a href="https://instagram.com/dalledave" target="_blank" rel="noopener">@dalledave</a></p>
      `,
    },
    {
      title: "Советы",
      body: `
        <p>Перетаскивайте окна за заголовок. Перетаскивайте значки, чтобы их переставить.</p>
        <p>Попробуйте <b>Пуск &gt; Настройки</b> чтобы сменить обои, или <b>Пуск &gt; Сон</b> для заставки.</p>
      `,
    },
  ];
  const PAGES = () => (t("Welcome") === "Welcome" ? PAGES_EN : PAGES_RU);

  // Win98-style flag logo (Microsoft 4-square waving flag pattern, recolored)
  const FLAG_LOGO = `
    <svg viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
      <g>
        <polygon points="6,8 38,4 38,30 8,32"   fill="#e84a3a"/>
        <polygon points="40,4 70,2 70,28 40,30" fill="#3ad67a"/>
        <polygon points="8,34 38,32 38,58 10,60" fill="#3a8fd6"/>
        <polygon points="40,32 70,30 70,56 40,58" fill="#f0d040"/>
      </g>
      <text x="80" y="36" font-family="Tahoma, sans-serif" font-size="22"
            font-weight="700" fill="#000" letter-spacing="-0.5">David</text>
      <text x="80" y="56" font-family="Tahoma, sans-serif" font-size="18"
            font-weight="700" fill="#e84a3a" letter-spacing="-0.5">Mekibel</text>
    </svg>
  `;

  const wrap = document.createElement("div");
  wrap.className = "welcome";
  wrap.innerHTML = `
    <div class="welcome-body">
      <div class="welcome-side">
        <div class="welcome-side-logo">${FLAG_LOGO}</div>
        <div class="welcome-toc-label">CONTENTS</div>
        <ul class="welcome-toc" role="tablist"></ul>
      </div>
      <div class="welcome-right">
        <div class="welcome-title">Welcome</div>
        <div class="welcome-pane"></div>
      </div>
    </div>
    <div class="welcome-foot">
      <label class="welcome-showcheck"><input type="checkbox" checked> Show this screen each time the site loads.</label>
      <div class="welcome-buttons">
        <button class="welcome-btn back"  type="button">&lt; Back</button>
        <button class="welcome-btn next"  type="button">Next &gt;</button>
        <button class="welcome-btn close" type="button">Close</button>
      </div>
    </div>
  `;

  const toc       = wrap.querySelector(".welcome-toc");
  const pane      = wrap.querySelector(".welcome-pane");
  const titleEl   = wrap.querySelector(".welcome-title");
  const backBtn   = wrap.querySelector(".welcome-btn.back");
  const nextBtn   = wrap.querySelector(".welcome-btn.next");
  const closeBtn  = wrap.querySelector(".welcome-btn.close");

  const visited = new Set([0]);

  // Color-coded left bars: red, blue, green, yellow
  const COLORS = ["#e84a3a", "#3a8fd6", "#3ad67a", "#f0d040"];
  function buildToc() {
    toc.innerHTML = "";
    PAGES().forEach((p, i) => {
      const li = document.createElement("li");
      li.dataset.idx = String(i);
      li.style.setProperty("--bar", COLORS[i % COLORS.length]);
      li.innerHTML = `
        <span class="toc-bar"></span>
        <span class="toc-label">${p.title}</span>
        <span class="toc-check">✓</span>
      `;
      if (i === idx) li.classList.add("active");
      toc.appendChild(li);
    });
  }
  function render() {
    const pages = PAGES();
    visited.add(idx);
    toc.querySelectorAll("li").forEach((n, i) => {
      n.classList.toggle("active",  i === idx);
      n.classList.toggle("visited", visited.has(i) && i !== idx);
    });
    titleEl.textContent = pages[idx].title;
    pane.innerHTML = pages[idx].body;
    backBtn.toggleAttribute("disabled", idx === 0);
    nextBtn.toggleAttribute("disabled", idx === pages.length - 1);
  }

  toc.addEventListener("click", (e) => {
    const li = e.target.closest("[data-idx]");
    if (!li) return;
    idx = Number(li.dataset.idx);
    render();
  });
  backBtn.addEventListener("click", () => { if (idx > 0)                 { idx--; render(); } });
  nextBtn.addEventListener("click", () => { if (idx < PAGES().length - 1) { idx++; render(); } });

  render();

  // Re-render when language changes (instant translation, no reload)
  const onLang = () => { buildToc(); render(); };
  window.addEventListener("languagechange", onLang);

  const id = openWindow({
    title: "Welcome",
    icon: ICONS.notepad(14),
    iconHtml: true,
    content: wrap,
    width: 540,
    height: 340,
    flush: true,
  });
  closeBtn.addEventListener("click", () => closeWindow(id));
  return id;
}

export function openSettings() {
  const initialWp = getWallpaper();
  let pendingWp = initialWp;

  const wrap = document.createElement("div");
  wrap.className = "settings";
  wrap.innerHTML = `
    <div class="settings-tabs" role="tablist">
      <button role="tab" data-tab="background" class="active">Background</button>
      <button role="tab" data-tab="screensaver">Screen Saver</button>
      <button role="tab" data-tab="appearance">Appearance</button>
      <button role="tab" data-tab="effects">Effects</button>
      <button role="tab" data-tab="settings">Settings</button>
    </div>
    <div class="settings-body"></div>
    <div class="settings-foot">
      <button class="settings-btn primary" type="button" data-act="ok">OK</button>
      <button class="settings-btn" type="button" data-act="cancel">Cancel</button>
      <button class="settings-btn" type="button" data-act="apply">Apply</button>
    </div>
  `;

  const body = wrap.querySelector(".settings-body");
  const tabs = wrap.querySelector(".settings-tabs");

  function renderTab(tab) {
    body.dataset.pane = tab;
    if (tab === "background") {
      body.innerHTML = `
        <div class="settings-preview">
          <div class="monitor">
            <div class="monitor-screen">
              <div class="mini-desk" data-wp="${pendingWp}"></div>
            </div>
            <div class="monitor-stand"></div>
            <div class="monitor-base"></div>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label">Wallpaper</label>
          <div class="wp-select-slot"></div>
        </div>
        <p class="settings-hint">Pick a wallpaper, then click <b>Apply</b> or <b>OK</b>. <b>Cancel</b> reverts.</p>
      `;
      const slot = body.querySelector(".wp-select-slot");
      const desk = body.querySelector(".mini-desk");
      const sel = makeWin98Select(
        WALLPAPERS.map(w => ({ value: w.id, label: w.label })),
        pendingWp,
        (val) => {
          pendingWp = val;
          desk.dataset.wp = pendingWp;
        }
      );
      slot.appendChild(sel);
    } else if (tab === "screensaver") {
      body.innerHTML = `
        <div class="settings-row">
          <label class="settings-label">Screen Saver</label>
          <div class="ss-select-slot"></div>
        </div>
        <p class="settings-hint">Activate manually from <b>Start &gt; Sleep</b>. Idle auto-trigger is not wired.</p>
      `;
      const slot = body.querySelector(".ss-select-slot");
      slot.appendChild(makeWin98Select(
        [{ value: "bouncing", label: "Bouncing David Mekibel" }],
        "bouncing",
        () => {},
        { disabled: true }
      ));
    } else if (tab === "appearance") {
      body.innerHTML = `
        <p class="settings-hint">Color schemes — coming soon.</p>
      `;
    } else if (tab === "effects") {
      body.innerHTML = `
        <p class="settings-hint">Menu fade, drop shadows, smooth scroll — coming soon.</p>
      `;
    } else if (tab === "settings") {
      body.innerHTML = `
        <div class="settings-row"><span class="settings-label">Display</span><span>Default Monitor</span></div>
        <div class="settings-row"><span class="settings-label">Colors</span><span>True Color (24 bit)</span></div>
        <div class="settings-row"><span class="settings-label">Screen area</span><span>fit to window</span></div>
      `;
    }
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    tabs.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    renderTab(btn.dataset.tab);
  });
  renderTab("background");

  const id = openWindow({
    title: "Display Properties",
    icon: ICONS.myComputer(14),
    iconHtml: true,
    content: wrap,
    width: 460,
    height: 420,
    flush: true,
  });

  wrap.querySelector('[data-act="ok"]').addEventListener("click", () => {
    setWallpaper(pendingWp);
    closeWindow(id);
  });
  wrap.querySelector('[data-act="cancel"]').addEventListener("click", () => {
    setWallpaper(initialWp);
    closeWindow(id);
  });
  wrap.querySelector('[data-act="apply"]').addEventListener("click", () => {
    setWallpaper(pendingWp);
  });
  return id;
}

function logout() {
  try { sessionStorage.removeItem("heaven-os.logged-in"); } catch (_) {}
  window.location.reload();
}

function restart() {
  // Same end state as logout (back to welcome screen) — kept as a separate
  // entry for the system-menu flavor. Could fade or flash in the future.
  try { sessionStorage.removeItem("heaven-os.logged-in"); } catch (_) {}
  window.location.reload();
}
