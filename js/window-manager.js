// Heaven OS — window manager
// Vanilla JS. No deps. Each Window is a real DOM node managed by this module.

const root = () => document.getElementById("windows-root");
const taskbarEntries = () => document.getElementById("taskbar-entries");

let nextId = 1;
let topZ = 10;
const windows = new Map();   // id -> WindowRecord

const isMobile = () => window.matchMedia("(max-width: 720px)").matches;

function bringToFront(id) {
  const rec = windows.get(id);
  if (!rec) return;
  topZ += 1;
  rec.el.style.zIndex = String(topZ);
  for (const [otherId, other] of windows) {
    other.el.classList.toggle("active", otherId === id);
    const tb = other.taskbar;
    if (tb) tb.classList.toggle("active", otherId === id);
  }
}

function focusWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  if (rec.el.classList.contains("minimized")) {
    rec.el.classList.remove("minimized");
  }
  bringToFront(id);
}

function makeTitlebar(rec) {
  const bar = document.createElement("div");
  bar.className = "window-titlebar";

  const titleEl = document.createElement("div");
  titleEl.className = "window-title";
  if (rec.icon) {
    const ic = document.createElement("span");
    ic.className = "window-title-icon";
    if (rec.iconHtml) ic.innerHTML = rec.icon;
    else ic.textContent = rec.icon;
    titleEl.appendChild(ic);
  }
  const txt = document.createElement("span");
  txt.textContent = rec.title;
  titleEl.appendChild(txt);

  const ctrls = document.createElement("div");
  ctrls.className = "window-controls";

  const mkBtn = (label, ariaLabel, handler) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "window-button";
    b.textContent = label;
    b.setAttribute("aria-label", ariaLabel);
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => { e.stopPropagation(); handler(); });
    return b;
  };

  ctrls.appendChild(mkBtn("_", "Minimize", () => minimize(rec.id)));
  ctrls.appendChild(mkBtn("□", "Maximize", () => toggleMaximize(rec.id)));
  ctrls.appendChild(mkBtn("×", "Close",    () => closeWindow(rec.id)));

  bar.appendChild(titleEl);
  bar.appendChild(ctrls);

  // Drag
  bar.addEventListener("mousedown", (e) => startDrag(rec.id, e));
  // Touch
  bar.addEventListener("touchstart", (e) => startDrag(rec.id, e.touches[0], true), { passive: true });

  // Double-click titlebar = toggle maximize (Win98 behavior)
  bar.addEventListener("dblclick", () => toggleMaximize(rec.id));

  return bar;
}

function makeResizeHandles(rec) {
  const dirs = ["n", "s", "w", "e", "nw", "ne", "sw", "se"];
  const frag = document.createDocumentFragment();
  for (const d of dirs) {
    const h = document.createElement("div");
    h.className = `resize-handle rh-${d}`;
    h.dataset.dir = d;
    h.addEventListener("mousedown", (e) => startResize(rec.id, d, e, false));
    h.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(rec.id, d, e.touches[0], true);
    }, { passive: false });
    frag.appendChild(h);
  }
  return frag;
}

function startDrag(id, ev, isTouch = false) {
  const rec = windows.get(id);
  if (!rec || rec.maximized) return;
  bringToFront(id);
  const startX = ev.clientX;
  const startY = ev.clientY;
  const origLeft = rec.el.offsetLeft;
  const origTop  = rec.el.offsetTop;

  const onMove = (e) => {
    const p = isTouch ? (e.touches ? e.touches[0] : e) : e;
    let nx = origLeft + (p.clientX - startX);
    let ny = origTop  + (p.clientY - startY);
    // keep titlebar reachable
    const tbH = 30;
    nx = Math.max(-rec.el.offsetWidth + 80, Math.min(window.innerWidth - 40, nx));
    ny = Math.max(0, Math.min(window.innerHeight - tbH - 22, ny));
    rec.el.style.left = nx + "px";
    rec.el.style.top  = ny + "px";
  };
  const onUp = () => {
    document.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
    document.removeEventListener(isTouch ? "touchend"  : "mouseup",   onUp);
  };
  document.addEventListener(isTouch ? "touchmove" : "mousemove", onMove, { passive: false });
  document.addEventListener(isTouch ? "touchend"  : "mouseup",   onUp);
}

function startResize(id, dir, ev, isTouch = false) {
  if (!isTouch) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  const rec = windows.get(id);
  if (!rec || rec.maximized) return;
  bringToFront(id);
  const startX = ev.clientX;
  const startY = ev.clientY;
  const startW = rec.el.offsetWidth;
  const startH = rec.el.offsetHeight;
  const startL = rec.el.offsetLeft;
  const startT = rec.el.offsetTop;
  const minW = 240, minH = 140;

  const onMove = (e) => {
    if (isTouch && e.cancelable) e.preventDefault();
    const p = isTouch ? (e.touches?.[0] || e.changedTouches?.[0]) : e;
    if (!p) return;
    const dx = p.clientX - startX;
    const dy = p.clientY - startY;
    let w = startW, h = startH, l = startL, t = startT;
    if (dir.includes("e")) w = Math.max(minW, startW + dx);
    if (dir.includes("s")) h = Math.max(minH, startH + dy);
    if (dir.includes("w")) {
      const newW = Math.max(minW, startW - dx);
      l = startL + (startW - newW);
      w = newW;
    }
    if (dir.includes("n")) {
      const newH = Math.max(minH, startH - dy);
      t = startT + (startH - newH);
      h = newH;
    }
    rec.el.style.width  = w + "px";
    rec.el.style.height = h + "px";
    rec.el.style.left   = l + "px";
    rec.el.style.top    = t + "px";
  };
  const onUp = () => {
    document.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
    document.removeEventListener(isTouch ? "touchend"  : "mouseup",   onUp);
  };
  document.addEventListener(isTouch ? "touchmove" : "mousemove", onMove, { passive: false });
  document.addEventListener(isTouch ? "touchend"  : "mouseup",   onUp);
}

function makeTaskbarEntry(rec) {
  const li = document.createElement("li");
  li.className = "taskbar-entry";
  li.dataset.windowId = String(rec.id);

  const ic = document.createElement("span");
  if (rec.iconHtml && rec.icon) ic.innerHTML = rec.icon;
  else ic.textContent = rec.icon || "▣";
  ic.style.flex = "0 0 auto";
  ic.style.display = "inline-flex";
  ic.style.alignItems = "center";
  const lbl = document.createElement("span");
  lbl.textContent = rec.title;
  lbl.style.overflow = "hidden";
  lbl.style.textOverflow = "ellipsis";
  li.appendChild(ic);
  li.appendChild(lbl);

  li.addEventListener("click", () => {
    if (rec.el.classList.contains("minimized")) {
      rec.el.classList.remove("minimized");
      bringToFront(rec.id);
    } else if (Number(rec.el.style.zIndex || 0) === topZ) {
      // active window clicked -> minimize
      minimize(rec.id);
    } else {
      bringToFront(rec.id);
    }
  });

  taskbarEntries().appendChild(li);
  return li;
}

export function openWindow({ title, icon, iconHtml = false, content, width = 520, height = 380, x, y, flush = false }) {
  // If a window with this title is already open (single-instance per program),
  // just focus it instead of opening a duplicate.
  for (const rec of windows.values()) {
    if (rec.title === title) {
      focusWindow(rec.id);
      return rec.id;
    }
  }

  const id = nextId++;
  const el = document.createElement("section");
  el.className = "window";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", title);

  const rec = { id, el, title, icon, iconHtml, maximized: false, prev: null, taskbar: null };
  windows.set(id, rec);

  // Position — cap to viewport so windows always fit on small screens.
  // Use the real taskbar height (it grows with iOS safe-area-inset-bottom).
  const vw = window.innerWidth;
  const taskbarH = document.getElementById("taskbar")?.offsetHeight || 30;
  const vh = window.innerHeight - taskbarH;
  const isNarrow = vw < 720;
  const minW = isNarrow ? 200 : 240;
  const minH = isNarrow ? 140 : 140;
  const w  = Math.max(minW, Math.min(width,  vw - 8));
  const h  = Math.max(minH, Math.min(height, vh - 8));
  // Cascade offset: subtle on desktop, none on mobile
  const offset = isNarrow ? 0 : Math.min((id - 1) * 24, 96);
  let cx = isNarrow ? Math.max(4, (vw - w) / 2) : Math.max(8, (vw - w) / 2 + offset);
  let cy = Math.max(4, (vh - h) / 2 + (isNarrow ? 0 : offset));
  // Final safety clamp so windows never start off-screen
  cx = Math.min(cx, vw - w - 4);
  cy = Math.min(cy, vh - h - 4);
  el.style.left   = (x ?? cx) + "px";
  el.style.top    = (y ?? cy) + "px";
  el.style.width  = w + "px";
  el.style.height = h + "px";

  el.appendChild(makeTitlebar(rec));

  // Content host
  const contentEl = document.createElement("div");
  contentEl.className = "window-content" + (flush ? " flush" : "");
  if (typeof content === "string") {
    contentEl.innerHTML = content;
  } else if (content instanceof Node) {
    contentEl.appendChild(content);
  }
  el.appendChild(contentEl);

  // Resize handles
  el.appendChild(makeResizeHandles(rec));

  // Bring to front when clicked anywhere
  el.addEventListener("mousedown", () => bringToFront(id), true);

  root().appendChild(el);
  rec.taskbar = makeTaskbarEntry(rec);
  bringToFront(id);
  return id;
}

export function minimize(id) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.el.classList.add("minimized");
  if (rec.taskbar) rec.taskbar.classList.remove("active");
}

export function toggleMaximize(id) {
  const rec = windows.get(id);
  if (!rec) return;
  if (rec.maximized) {
    rec.el.classList.remove("maximized");
    if (rec.prev) {
      rec.el.style.left   = rec.prev.left;
      rec.el.style.top    = rec.prev.top;
      rec.el.style.width  = rec.prev.width;
      rec.el.style.height = rec.prev.height;
    }
    rec.maximized = false;
  } else {
    rec.prev = {
      left:   rec.el.style.left,
      top:    rec.el.style.top,
      width:  rec.el.style.width,
      height: rec.el.style.height,
    };
    rec.el.classList.add("maximized");
    rec.el.style.left = "0px";
    rec.el.style.top  = "0px";
    rec.el.style.width  = window.innerWidth + "px";
    rec.el.style.height = (window.innerHeight - 30) + "px";
    rec.maximized = true;
  }
}

export function closeWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.el.remove();
  if (rec.taskbar) rec.taskbar.remove();
  windows.delete(id);
}

export function listOpenWindows() {
  return [...windows.values()].map(r => ({ id: r.id, title: r.title }));
}

// Re-fit windows on viewport changes (orientation flip, browser resize).
// Windows that were larger than the new viewport get shrunk;
// windows that ended up off-screen get clamped back.
function reflowOnResize() {
  const taskbarH = document.getElementById("taskbar")?.offsetHeight || 30;
  const margin = 8;
  for (const rec of windows.values()) {
    if (rec.maximized) {
      rec.el.style.left = "0px";
      rec.el.style.top  = "0px";
      rec.el.style.width  = window.innerWidth + "px";
      rec.el.style.height = (window.innerHeight - taskbarH) + "px";
      continue;
    }
    const maxW = window.innerWidth  - margin * 2;
    const maxH = window.innerHeight - taskbarH - margin * 2;
    let w = Math.max(240, Math.min(rec.el.offsetWidth,  maxW));
    let h = Math.max(140, Math.min(rec.el.offsetHeight, maxH));
    let l = Math.max(margin, Math.min(rec.el.offsetLeft, window.innerWidth - w - margin));
    let t = Math.max(margin, Math.min(rec.el.offsetTop,  window.innerHeight - taskbarH - h - margin));
    rec.el.style.left   = l + "px";
    rec.el.style.top    = t + "px";
    rec.el.style.width  = w + "px";
    rec.el.style.height = h + "px";
  }
}
window.addEventListener("resize", reflowOnResize);
window.addEventListener("orientationchange", () => setTimeout(reflowOnResize, 200));
