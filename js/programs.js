// Heaven OS — programs
// Each program builds DOM content for a window. The window manager wraps it
// in chrome and handles drag/resize.

import { openWindow } from "./window-manager.js";
import { FS, findByPath } from "./file-system.js";

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
    icon: file.icon || "📝",
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
    icon: "✉",
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
    icon: "🎬",
    content: wrap,
    width: 640,
    height: 400,
  });
}

// ---- File Explorer (folder browser) --------------------------------

export function openExplorer(startPath = []) {
  const root = findByPath(startPath) || FS;

  const wrap = document.createElement("div");
  wrap.className = "explorer";

  // Tree (left): roots only for now (v1 — simple, expand in v0.3)
  const treeWrap = document.createElement("div");
  treeWrap.className = "tree";
  const treeUl = document.createElement("ul");
  for (const child of FS.children) {
    if (child.type !== "folder") continue;
    const li = document.createElement("li");
    li.className = "folder";
    li.textContent = child.name;
    li.addEventListener("dblclick", () => navigateTo([child.name]));
    li.addEventListener("click", () => navigateTo([child.name]));
    treeUl.appendChild(li);
  }
  treeWrap.appendChild(treeUl);

  // Pane (right)
  const pane = document.createElement("div");
  pane.className = "pane";

  const breadcrumb = document.createElement("div");
  breadcrumb.style.cssText = "font-family:Tahoma,sans-serif;font-size:12px;border-bottom:1px solid #888;padding-bottom:6px;margin-bottom:8px;";

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill, 88px);gap:14px;padding:6px 0;";

  let currentPath = [...startPath];

  function navigateTo(path) {
    const node = findByPath(path);
    if (!node || node.type !== "folder") {
      // it's a file — open with appropriate program
      if (node && node.type === "file") openFile(node);
      return;
    }
    currentPath = path;
    render();
  }

  function render() {
    breadcrumb.innerHTML = "";
    const segs = ["Heaven OS:", ...currentPath];
    segs.forEach((seg, i) => {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = seg;
      a.style.color = "#1010a0";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo(currentPath.slice(0, i));
      });
      breadcrumb.appendChild(a);
      if (i < segs.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = " \\ ";
        sep.style.color = "#666";
        breadcrumb.appendChild(sep);
      }
    });

    const node = findByPath(currentPath) || FS;
    grid.innerHTML = "";
    if (!node.children || node.children.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#666;font-family:Tahoma;font-size:12px;padding:20px;";
      empty.textContent = "(this folder is empty)";
      grid.appendChild(empty);
      return;
    }
    for (const child of node.children) {
      const tile = document.createElement("div");
      tile.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;cursor:default;font-family:Tahoma;font-size:11px;text-align:center;";
      const ic = document.createElement("div");
      ic.textContent = child.icon || (child.type === "folder" ? "📁" : "📄");
      ic.style.cssText = "font-size:36px;line-height:1;";
      const lbl = document.createElement("div");
      lbl.textContent = child.name;
      lbl.style.cssText = "max-width:84px;word-wrap:break-word;line-height:1.15;";
      tile.appendChild(ic);
      tile.appendChild(lbl);
      tile.addEventListener("dblclick", () => {
        if (child.type === "folder") navigateTo([...currentPath, child.name]);
        else openFile(child);
      });
      grid.appendChild(tile);
    }
  }

  pane.appendChild(breadcrumb);
  pane.appendChild(grid);
  wrap.appendChild(treeWrap);
  wrap.appendChild(pane);

  render();

  // Make the explorer use the chrome flush (no white inset, since we have our own panes)
  const id = openWindow({
    title: currentPath.length ? currentPath[currentPath.length - 1] : "Heaven OS",
    icon: "📁",
    content: wrap,
    width: 720,
    height: 460,
  });
  // Mark content as flush-styled
  const win = document.querySelector(`[role="dialog"][aria-label="${currentPath.length ? currentPath[currentPath.length - 1] : "Heaven OS"}"] .window-content`);
  if (win) win.classList.add("flush");
  return id;
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
