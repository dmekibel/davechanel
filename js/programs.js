// Heaven OS — programs
// Each program builds DOM content for a window. The window manager wraps it
// in chrome and handles drag/resize.

import { openWindow } from "./window-manager.js";
import { FS, findByPath } from "./file-system.js";
import { ICONS, iconFor } from "./icons.js";

// ---- Notepad --------------------------------------------------------

async function loadText(file) {
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
  const root = document.createElement("div");
  root.className = "notepad";

  const menu = document.createElement("div");
  menu.className = "window-menubar";
  for (const m of ["File", "Edit", "Search", "Help"]) {
    const span = document.createElement("span");
    span.className = "menu-item";
    span.textContent = m;
    menu.appendChild(span);
  }

  const text = await loadText(file);
  const pre = document.createElement("pre");
  pre.style.margin = "0";
  pre.textContent = text;
  root.appendChild(pre);

  // Window expects a single content element; wrap menu+notepad
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.height = "100%";
  wrap.appendChild(menu);
  const scroller = document.createElement("div");
  scroller.style.flex = "1";
  scroller.style.overflow = "auto";
  scroller.style.background = "#fff";
  scroller.appendChild(root);
  wrap.appendChild(scroller);

  return openWindow({
    title: file.name,
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
    title: file?.name || "Showreel.mpg",
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
  const expanded = new Set(["Heaven OS:"]);  // tree nodes that are expanded

  // Container
  const wrap = document.createElement("div");
  wrap.className = "explorer";

  // ---- Menu bar -----------------------------------------------------
  const menubar = document.createElement("div");
  menubar.className = "exp-menubar";
  for (const [label, accel] of [
    ["File", "F"], ["Edit", "E"], ["View", "V"], ["Go", "G"],
    ["Favorites", "a"], ["Tools", "T"], ["Help", "H"],
  ]) {
    const item = document.createElement("span");
    item.className = "menu-item";
    const i = label.indexOf(accel);
    if (i >= 0) {
      item.innerHTML = label.slice(0, i) + `<u>${label[i]}</u>` + label.slice(i + 1);
    } else {
      item.textContent = label;
    }
    menubar.appendChild(item);
  }

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

  function pathKey(path) {
    return ["Heaven OS:", ...path].join("/");
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
    let acc = "Heaven OS:";
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
    if (expanded.has("Heaven OS:")) {
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
      const key = node === FS ? "Heaven OS:" : pathKey(path);
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
    lbl.textContent = node === FS ? "Heaven OS" : node.name;
    li.appendChild(lbl);

    li.addEventListener("click", () => {
      if (node === FS) { navigateTo([]); return; }
      if (node.type === "folder") navigateTo(path);
    });
    li.addEventListener("dblclick", () => {
      if (node === FS) return;
      if (node.type === "file") openFile(node);
    });
    return li;
  }

  // ---- Pane rendering ----------------------------------------------

  function render() {
    const node = findByPath(currentPath) || FS;
    const titleName = currentPath.length ? currentPath[currentPath.length - 1] : "Heaven OS";

    // address
    addrField.innerHTML = "";
    const ic = document.createElement("span");
    ic.className = "icon";
    ic.innerHTML = currentPath.length === 0 ? ICONS.myComputer(16) : iconFor(node, 16);
    addrField.appendChild(ic);
    const txt = document.createElement("span");
    txt.textContent = "Heaven OS:" + (currentPath.length ? "\\" + currentPath.join("\\") : "");
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
        tLbl.textContent = child.name;
        tile.appendChild(tIc);
        tile.appendChild(tLbl);

        const open = () => {
          if (child.type === "folder") navigateTo([...currentPath, child.name]);
          else openFile(child);
        };
        tile.addEventListener("click", () => {
          grid.querySelectorAll(".exp-tile.selected").forEach(n => n.classList.remove("selected"));
          tile.classList.add("selected");
        });
        tile.addEventListener("dblclick", open);
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        });
        grid.appendChild(tile);
      }
    }

    // status
    sCount.textContent = `${items.length} object(s)`;
    sPath.textContent  = "Heaven OS:" + (currentPath.length ? "\\" + currentPath.join("\\") : "");

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

  render();

  const initialTitle = currentPath.length ? currentPath[currentPath.length - 1] : "Heaven OS";
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
  const wEl = [...document.querySelectorAll(".window")].find(el => el.getAttribute("aria-label") === (currentPath.length ? currentPath[currentPath.length - 1] : "Heaven OS"));
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
    case "fine-art":  return openExplorer(["Fine Art"]);
    case "balance":   return openExplorer(["Balancē Creative"]);
    case "about":     return openNotepad(findByPath(["About Me.txt"]));
    case "showreel":  return openShowreel(findByPath(["Showreel.mpg"]));
    case "contact":   return openCompose();
    case "recycle":   return openExplorer(["Recycle Bin"]);
    case "explorer":  return openExplorer([]);
    default:          return null;
  }
}
